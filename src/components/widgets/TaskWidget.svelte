<!--
  任务管理 Widget
  支持看板视图、列表视图、日历视图等多种视图模式
  包含完成日期筛选功能
-->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fetchPost, openTab } from 'siyuan';
    import { ListTodo, RefreshCw, Eye, EyeOff, LayoutGrid, Plus, Settings } from 'lucide-svelte';
    import type {
        Task,
        TaskViewType,
        TaskWidgetConfig,
        TaskFilter,
        QuickFilterType,
        KanbanColumn,
        TaskStatus,
        SqlResponse
    } from '../../types/task';
    import {
        transformTasks,
        applyFilter,
        sortTasks,
        calculateStats,
        buildTaskQuery,
        TASK_ATTRS
    } from '../../libs/task-utils';
    import KanbanView from './task/KanbanView.svelte';
    import NotebookFilter from './task/NotebookFilter.svelte';
    import DateRangeSelector from './task/DateRangeSelector.svelte';
    import PriorityFilter from './task/PriorityFilter.svelte';
    import AddTaskDialog from './task/AddTaskDialog.svelte';
    import TaskSettingsDialog from './task/TaskSettingsDialog.svelte';

    export let app; // App 实例，用于打开文档
    export let plugin; // 插件实例，用于保存配置
    export let widgetId: string = ''; // 组件实例 ID，用于区分多个实例

    // 使用组件 ID 作为 storage key，确保每个实例独立存储
    $: STORAGE_KEY = widgetId ? `task-widget-config-${widgetId}` : 'task-widget-config';

    // 默认看板列配置
    const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
        {
            id: 'todo',
            title: '待办',
            status: 'todo' as TaskStatus,
            color: '#94a3b8',
            icon: '',
            order: 1
        },
        {
            id: 'in-progress',
            title: '进行中',
            status: 'in-progress' as TaskStatus,
            color: '#3b82f6',
            icon: '',
            order: 2
        },
        {
            id: 'review',
            title: '审核中',
            status: 'review' as TaskStatus,
            color: '#f59e0b',
            icon: '',
            order: 3
        },
        {
            id: 'done',
            title: '已完成',
            status: 'done' as TaskStatus,
            color: '#10b981',
            icon: '',
            order: 4
        }
    ];

    // 默认配置
    const DEFAULT_CONFIG: TaskWidgetConfig = {
        currentView: 'kanban',
        viewConfigs: {
            kanban: {
                columns: DEFAULT_KANBAN_COLUMNS,
                showEmptyColumns: true,
                groupBy: 'status',
                sortBy: 'created',
                sortOrder: 'desc'
            }
        },
        filter: {
            quickFilter: 'all',
            notebooks: {
                enabled: false,
                mode: 'include',
                notebookIds: []
            },
            showCompleted: true
        },
        preferences: {
            compactMode: false,
            showStats: true,
            autoRefresh: true,
            refreshInterval: 300 // 5分钟
        }
    };

    // 状态
    let config: TaskWidgetConfig = { ...DEFAULT_CONFIG };
    let allTasks: Task[] = [];
    let filteredTasks: Task[] = [];
    let loading = true;
    let error: string | null = null;
    let showSettings = false;
    let showAddDialog = false;
    let showSettingsDialog = false;
    let scrollTimeout: number | null = null;  // 滚动定时器
    let mounted = true;  // 组件挂载状态

    // 任务设置（日记笔记本等）
    let taskSettings = {
        dailyNoteNotebookId: '' // 日记笔记本ID
    };

    // 统计信息
    $: stats = calculateStats(filteredTasks);

    // 加载配置
    onMount(async () => {
        await loadConfig();
        await loadTaskSettings();
        await loadTasks();

        // 自动刷新
        if (config.preferences?.autoRefresh) {
            const interval = setInterval(loadTasks, (config.preferences.refreshInterval || 300) * 1000);
            return () => clearInterval(interval);
        }
    });

    // 组件销毁时清理
    onDestroy(() => {
        mounted = false;  // 标记组件已销毁
        if (scrollTimeout !== null) {
            clearTimeout(scrollTimeout);
        }
    });

    async function loadConfig() {
        if (!plugin) return;

        try {
            const savedConfig = await plugin.loadData(STORAGE_KEY);
            if (savedConfig) {
                config = { ...DEFAULT_CONFIG, ...savedConfig };

                // 将日期字符串转换回 Date 对象
                if (config.filter.dateFilters?.created) {
                    if (config.filter.dateFilters.created.start) {
                        config.filter.dateFilters.created.start = new Date(config.filter.dateFilters.created.start);
                    }
                    if (config.filter.dateFilters.created.end) {
                        config.filter.dateFilters.created.end = new Date(config.filter.dateFilters.created.end);
                    }
                }
                if (config.filter.dateFilters?.dueDate) {
                    if (config.filter.dateFilters.dueDate.start) {
                        config.filter.dateFilters.dueDate.start = new Date(config.filter.dateFilters.dueDate.start);
                    }
                    if (config.filter.dateFilters.dueDate.end) {
                        config.filter.dateFilters.dueDate.end = new Date(config.filter.dateFilters.dueDate.end);
                    }
                }
                if (config.filter.dateFilters?.completedDate) {
                    if (config.filter.dateFilters.completedDate.start) {
                        config.filter.dateFilters.completedDate.start = new Date(config.filter.dateFilters.completedDate.start);
                    }
                    if (config.filter.dateFilters.completedDate.end) {
                        config.filter.dateFilters.completedDate.end = new Date(config.filter.dateFilters.completedDate.end);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load task widget config:', err);
        }
    }

    async function saveConfig() {
        if (!plugin) return;

        try {
            await plugin.saveData(STORAGE_KEY, config);
        } catch (err) {
            console.error('Failed to save task widget config:', err);
        }
    }

    // 加载任务设置
    // 任务设置存储 key（使用 widgetId 区分不同实例）
    $: TASK_SETTINGS_KEY = widgetId ? `task-settings-${widgetId}` : 'task-settings';

    async function loadTaskSettings() {
        if (!plugin) return;

        try {
            const savedSettings = await plugin.loadData(TASK_SETTINGS_KEY);
            if (savedSettings) {
                taskSettings = { ...taskSettings, ...savedSettings };
            }
        } catch (err) {
            console.error('Failed to load task settings:', err);
        }
    }

    // 保存任务设置
    async function saveTaskSettings() {
        if (!plugin) return;

        try {
            await plugin.saveData(TASK_SETTINGS_KEY, taskSettings);
        } catch (err) {
            console.error('Failed to save task settings:', err);
        }
    }

    // 加载任务数据
    function loadTasks() {
        loading = true;
        error = null;

        try {
            const sql = buildTaskQuery(config.filter);
            fetchPost('/api/query/sql', { stmt: sql }, (response) => {
                // 检查组件是否已销毁
                if (!mounted) return;

                if (response && response.code === 0) {
                    allTasks = transformTasks(response.data);
                    updateFilteredTasks();
                } else {
                    error = response?.msg || '加载任务失败';
                }
                loading = false;
            });
        } catch (err) {
            if (!mounted) return;
            console.error('Failed to load tasks:', err);
            error = '网络错误，请稍后重试';
            loading = false;
        }
    }

    // 暴露刷新方法
    export function refresh() {
        loadTasks();
    }

    // 更新筛选后的任务
    function updateFilteredTasks() {
        let tasks = applyFilter(allTasks, config.filter);

        // 根据视图配置排序
        if (config.currentView === 'kanban' && config.viewConfigs.kanban) {
            const { sortBy, sortOrder } = config.viewConfigs.kanban;
            if (sortBy) {
                tasks = sortTasks(tasks, sortBy, sortOrder);
            }
        }

        filteredTasks = tasks;
    }

    // 切换视图
    function switchView(view: TaskViewType) {
        config.currentView = view;
        saveConfig();
    }

    // 处理笔记本筛选变化
    function handleNotebookFilterChange(event: CustomEvent) {
        config.filter.notebooks = event.detail;
        updateFilteredTasks();
        saveConfig();
    }

    // 处理任务点击（跳转到文档）
    function handleTaskClick(event: CustomEvent<Task>) {
        const task = event.detail;

        // 清理之前的滚动定时器，避免多个滚动冲突
        if (scrollTimeout !== null) {
            clearTimeout(scrollTimeout);
            scrollTimeout = null;
        }

        try {
            // 打开文档标签页
            openTab({
                app: app,
                doc: {
                    id: task.docId,
                    zoomIn: false
                }
            });

            // 延迟后滚动到任务块
            scrollTimeout = window.setTimeout(() => {
                const taskElement = document.querySelector(
                    `.protyle-wysiwyg [data-node-id="${task.id}"]`
                );
                if (taskElement) {
                    taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                scrollTimeout = null;
            }, 300);
        } catch (err) {
            console.error('Failed to open task:', err);
        }
    }

    // ==================== 任务更新核心系统 ====================

    /**
     * 统一的任务更新接口
     * @param task 要更新的任务
     * @param updates 更新内容
     */
    interface TaskUpdate {
        status?: TaskStatus;           // 任务状态
        dueDate?: Date | null;        // 截止日期（null 表示清除）
        priority?: string | null;     // 优先级（null 表示清除）
        archived?: boolean;           // 是否归档
    }

    /**
     * 核心函数：更新任务
     * - 乐观更新本地状态
     * - 按正确顺序同步到后端（markdown -> 属性）
     * - 自动保留所有原有属性
     */
    function updateTask(task: Task, updates: TaskUpdate) {
        try {
            // === 步骤1: 计算新状态和需要更新的内容 ===
            const newState = computeNewTaskState(task, updates);

            // === 步骤2: 乐观更新本地 ===
            applyOptimisticUpdate(task, newState);

            // === 步骤3: 同步到后端 ===
            syncTaskToBackend(task, newState);

        } catch (err) {
            console.error('Failed to update task:', err);
            showError('更新任务失败');
        }
    }

    /**
     * 计算任务的新状态
     */
    function computeNewTaskState(task: Task, updates: TaskUpdate) {
        const now = new Date();
        const newState: any = {};

        // 处理归档（优先级最高，会设置 status）
        if (updates.archived) {
            newState.status = 'archived';
            newState.completed = true;
            newState.archivedAt = now;
            newState.needUpdateMarkdown = true;
            newState.newMarkdown = task.markdown.replace(/^([*-]\s*)\[.\]/, '$1[x]');
        }
        // 处理状态变更（只有在不归档时才处理）
        else if (updates.status !== undefined) {
            newState.status = updates.status;
            newState.completed = updates.status === 'done' || updates.status === 'archived';

            // 判断是否需要更新 markdown
            const targetCheckbox = (updates.status === 'todo' || updates.status === 'in-progress' || updates.status === 'review') ? '[ ]' : '[x]';
            const currentCheckbox = task.markdown.match(/\[(.*?)\]/)?.[1] || ' ';
            newState.needUpdateMarkdown = currentCheckbox !== targetCheckbox.slice(1, -1);
            newState.newMarkdown = task.markdown.replace(/^([*-]\s*)\[.\]/, `$1${targetCheckbox}`);
        }

        // 处理截止日期变更
        if (updates.dueDate !== undefined) {
            newState.dueDate = updates.dueDate;
        }

        // 处理优先级变更
        if (updates.priority !== undefined) {
            newState.priority = updates.priority;
        }

        // 计算需要设置的属性
        newState.attrs = computeTaskAttributes(task, newState, now);

        return newState;
    }

    /**
     * 计算任务的所有属性（保留原有 + 更新变更）
     */
    function computeTaskAttributes(task: Task, newState: any, now: Date): Record<string, string> {
        // 复制所有原有属性
        const attrs: Record<string, string> = { ...(task.customAttrs || {}) };

        // 更新状态属性
        if (newState.status !== undefined) {
            const status = newState.status;
            if (status === 'in-progress' || status === 'review' || status === 'archived') {
                attrs[TASK_ATTRS.STATUS] = status;
            } else {
                attrs[TASK_ATTRS.STATUS] = '';  // 删除
            }

            // 更新完成时间
            if (status === 'done') {
                attrs[TASK_ATTRS.COMPLETED_TIME] = now.toISOString();
            } else if (status === 'todo' || status === 'in-progress' || status === 'review') {
                attrs[TASK_ATTRS.COMPLETED_TIME] = '';  // 删除
            }
        }

        // 更新归档时间
        if (newState.archivedAt) {
            attrs[TASK_ATTRS.ARCHIVED_TIME] = newState.archivedAt.toISOString();
            if (!attrs[TASK_ATTRS.COMPLETED_TIME]) {
                attrs[TASK_ATTRS.COMPLETED_TIME] = now.toISOString();
            }
        }

        // 更新截止日期
        if (newState.dueDate !== undefined) {
            attrs[TASK_ATTRS.DUE_DATE] = newState.dueDate ? newState.dueDate.toISOString() : '';
        }

        // 更新优先级
        if (newState.priority !== undefined) {
            attrs[TASK_ATTRS.PRIORITY] = newState.priority || '';
        }

        return attrs;
    }

    /**
     * 应用乐观更新到本地状态
     */
    function applyOptimisticUpdate(task: Task, newState: any) {
        // 使用深拷贝创建新任务对象
        const updatedTask = updateTaskLocalState(task, newState.status || task.status);

        // 应用其他更新
        if (newState.dueDate !== undefined) {
            updatedTask.dueDate = newState.dueDate;
            // 同步更新 customAttrs
            if (!updatedTask.customAttrs) updatedTask.customAttrs = {};
            updatedTask.customAttrs[TASK_ATTRS.DUE_DATE] = newState.dueDate ? newState.dueDate.toISOString() : '';
        }
        if (newState.priority !== undefined) {
            updatedTask.priority = newState.priority;
            // 同步更新 customAttrs
            if (!updatedTask.customAttrs) updatedTask.customAttrs = {};
            updatedTask.customAttrs[TASK_ATTRS.PRIORITY] = newState.priority || '';
        }
        if (newState.archivedAt) updatedTask.archivedAt = newState.archivedAt;

        // 更新本地任务列表
        allTasks = allTasks.map(t => t.id === task.id ? updatedTask : t);
        filteredTasks = filteredTasks.map(t => t.id === task.id ? updatedTask : t);
    }

    /**
     * 同步任务到后端（按正确顺序：markdown -> 属性）
     */
    function syncTaskToBackend(task: Task, newState: any) {
        // 如果需要更新 markdown，先更新它（因为 updateBlock 会清除属性）
        if (newState.needUpdateMarkdown) {
            fetchPost('/api/block/updateBlock', {
                id: task.id,
                dataType: 'markdown',
                data: newState.newMarkdown
            }, (response) => {
                if (response && response.code === 0) {
                    // markdown 更新成功后，设置所有属性
                    setTaskAttributesAPI(task.id, newState.attrs);
                } else {
                    console.error('Failed to update markdown:', response);
                    showError('更新任务失败');
                }
            });
        } else {
            // 不需要更新 markdown，直接设置属性
            setTaskAttributesAPI(task.id, newState.attrs);
        }
    }

    /**
     * 调用 API 设置任务属性
     */
    function setTaskAttributesAPI(taskId: string, attrs: Record<string, string>) {
        fetchPost('/api/attr/setBlockAttrs', {
            id: taskId,
            attrs: attrs
        }, (response) => {
            if (response && response.code === 0) {
                console.log('Task updated successfully:', taskId);
            } else {
                console.error('Failed to set attributes:', response);
                showError('更新任务属性失败');
            }
        });
    }

    // ==================== 事件处理函数（业务层） ====================

    // 处理任务移动（更新状态）
    function handleTaskMove(event: CustomEvent) {
        const { task, toStatus } = event.detail;
        updateTask(task, { status: toStatus });
    }

    // 辅助函数：更新任务的本地状态（用于乐观更新）
    function updateTaskLocalState(task: Task, toStatus: string): Task {
        // 使用 JSON 深度复制，避免引用问题
        const updatedTask: Task = JSON.parse(JSON.stringify(task));

        // 恢复 Date 对象（JSON.stringify 会将 Date 转为字符串）
        if (task.createdAt) updatedTask.createdAt = new Date(task.createdAt);
        if (task.updatedAt) updatedTask.updatedAt = new Date(task.updatedAt);
        if (task.dueDate) updatedTask.dueDate = new Date(task.dueDate);
        if (task.completedAt) updatedTask.completedAt = new Date(task.completedAt);
        if (task.archivedAt) updatedTask.archivedAt = new Date(task.archivedAt);

        // 更新状态
        updatedTask.status = toStatus as any;
        updatedTask.completed = toStatus === 'done' || toStatus === 'archived';

        // 更新 markdown
        if (toStatus === 'todo' || toStatus === 'in-progress' || toStatus === 'review') {
            updatedTask.markdown = updatedTask.markdown.replace(/^([*-]\s*)\[.\]/, '$1[ ]');
        } else if (toStatus === 'done' || toStatus === 'archived') {
            updatedTask.markdown = updatedTask.markdown.replace(/^([*-]\s*)\[.\]/, '$1[x]');
        }

        // 确保 customAttrs 存在
        if (!updatedTask.customAttrs) {
            updatedTask.customAttrs = {};
        }

        // 更新自定义属性
        if (toStatus === 'in-progress' || toStatus === 'review' || toStatus === 'archived') {
            updatedTask.customAttrs[TASK_ATTRS.STATUS] = toStatus;
        } else {
            delete updatedTask.customAttrs[TASK_ATTRS.STATUS];
        }

        // 更新完成时间
        if (toStatus === 'done') {
            const now = new Date();
            updatedTask.customAttrs[TASK_ATTRS.COMPLETED_TIME] = now.toISOString();
            updatedTask.completedAt = now;
        } else if (toStatus === 'todo' || toStatus === 'in-progress' || toStatus === 'review') {
            delete updatedTask.customAttrs[TASK_ATTRS.COMPLETED_TIME];
            updatedTask.completedAt = undefined;
        }

        return updatedTask;
    }

    // 处理看板列折叠
    function handleColumnCollapse(event: CustomEvent) {
        const { columnId, collapsed } = event.detail;
        if (config.viewConfigs.kanban) {
            const column = config.viewConfigs.kanban.columns.find(c => c.id === columnId);
            if (column) {
                column.collapsed = collapsed;
                saveConfig();
            }
        }
    }

    // 切换显示已完成
    function toggleShowCompleted() {
        config.filter.showCompleted = !config.filter.showCompleted;
        updateFilteredTasks();
        saveConfig();
    }

    // 设置快捷筛选
    function setQuickFilter(filter: QuickFilterType) {
        config.filter.quickFilter = filter;
        updateFilteredTasks();
        saveConfig();
    }

    // 处理创建日期筛选变化
    function handleCreatedDateChange(event: CustomEvent) {
        if (!config.filter.dateFilters) {
            config.filter.dateFilters = {};
        }
        config.filter.dateFilters.created = event.detail;
        updateFilteredTasks();
        saveConfig();
    }

    // 处理截止日期筛选变化
    function handleDueDateChange(event: CustomEvent) {
        if (!config.filter.dateFilters) {
            config.filter.dateFilters = {};
        }
        config.filter.dateFilters.dueDate = event.detail;
        updateFilteredTasks();
        saveConfig();
    }

    // 处理完成日期筛选变化
    function handleCompletedDateChange(event: CustomEvent) {
        if (!config.filter.dateFilters) {
            config.filter.dateFilters = {};
        }
        config.filter.dateFilters.completedDate = event.detail;
        updateFilteredTasks();
        saveConfig();
    }

    // 处理优先级筛选变化
    function handlePriorityChange(event: CustomEvent) {
        config.filter.priorities = event.detail;
        updateFilteredTasks();
        saveConfig();
    }

    // 处理任务截止日期变化
    function handleTaskDueDateChange(event: CustomEvent) {
        const { task, dueDate } = event.detail;
        updateTask(task, { dueDate });
    }

    // 处理任务优先级变化
    function handleTaskPriorityChange(event: CustomEvent) {
        const { task, priority } = event.detail;
        updateTask(task, { priority });
    }

    // 处理任务归档
    function handleTaskArchive(event: CustomEvent) {
        const { task } = event.detail;
        updateTask(task, { archived: true });
    }

    // ==================== 工具函数 ====================

    /**
     * Promise 包装 fetchPost
     */
    function fetchPostAsync(url: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            fetchPost(url, data, (response) => {
                if (response && response.code === 0) {
                    resolve(response);
                } else {
                    reject(new Error(response?.msg || `Request failed: ${url}`));
                }
            });
        });
    }

    /**
     * 显示成功通知
     */
    function showSuccess(msg: string) {
        fetchPost('/api/notification/pushMsg', { msg, timeout: 3000 });
    }

    /**
     * 显示错误通知
     */
    function showError(msg: string) {
        fetchPost('/api/notification/pushErrMsg', { msg, timeout: 5000 });
    }

    // ==================== 任务添加相关 ====================

    const TODO_HEADING_TEXT = '## 待办';

    /**
     * 使用 SQL 查询在指定文档下查找带有自定义属性标记的"待办"标题
     */
    async function findTodoHeadingBySQL(docId: string): Promise<string | null> {
        // 只通过属性查找，不依赖标题内容
        const sql = `
            SELECT id
            FROM blocks
            WHERE root_id = '${docId}'
              AND type = 'h'
              AND id IN (
                SELECT block_id
                FROM attributes
                WHERE name = '${TASK_ATTRS.DAILY_TODO_HEADING}'
                  AND value = 'true'
              )
            LIMIT 1
        `;

        try {
            const result = await fetchPostAsync('/api/query/sql', { stmt: sql });

            if (result.data && result.data.length > 0) {
                return result.data[0].id;
            }

            return null;
        } catch (err) {
            console.error('[AddTask] Failed to query todo heading:', err);
            return null;
        }
    }

    /**
     * 创建"待办"标题并设置标记属性
     */
    async function createTodoHeading(docId: string): Promise<string> {
        const result = await fetchPostAsync('/api/block/prependBlock', {
            dataType: 'markdown',
            data: TODO_HEADING_TEXT,
            parentID: docId
        });

        const headingId = result.data?.[0]?.doOperations?.[0]?.id;
        if (!headingId) {
            throw new Error('Failed to get heading ID from response');
        }

        // 设置标记属性用于后续识别
        await fetchPostAsync('/api/attr/setBlockAttrs', {
            id: headingId,
            attrs: { [TASK_ATTRS.DAILY_TODO_HEADING]: 'true' }
        });

        return headingId;
    }

    /**
     * 添加任务到指定标题下
     */
    async function addTaskToHeading(
        headingId: string,
        content: string,
        priority: string,
        dueDate: Date
    ): Promise<string> {
        // 添加任务块
        const result = await fetchPostAsync('/api/block/appendBlock', {
            dataType: 'markdown',
            data: `- [ ] ${content}`,
            parentID: headingId
        });

        const taskId = result.data?.[0]?.doOperations?.[0]?.id;
        if (!taskId) {
            throw new Error('Failed to get task ID from response');
        }

        // 设置任务属性（优先级、截止日期）
        const attrs: Record<string, string> = {};
        if (priority) attrs[TASK_ATTRS.PRIORITY] = priority;
        if (dueDate) attrs[TASK_ATTRS.DUE_DATE] = dueDate.toISOString();

        if (Object.keys(attrs).length > 0) {
            await fetchPostAsync('/api/attr/setBlockAttrs', {
                id: taskId,
                attrs: attrs
            });
        }

        return taskId;
    }

    /**
     * 处理添加新任务
     */
    async function handleAddTask(event: CustomEvent) {
        const { content, priority, dueDate } = event.detail;

        // 检查是否已设置日记笔记本
        if (!taskSettings.dailyNoteNotebookId) {
            showError('请先设置日记笔记本');
            showSettingsDialog = true;
            return;
        }

        try {
            // 1. 创建或获取今日日记
            const dailyNote = await fetchPostAsync('/api/filetree/createDailyNote', {
                notebook: taskSettings.dailyNoteNotebookId
            });
            const docId = dailyNote.data.id;

            // 2. 查找带标记属性的"待办"标题
            let todoHeadingId = await findTodoHeadingBySQL(docId);

            // 3. 如果不存在，创建新标题
            if (!todoHeadingId) {
                todoHeadingId = await createTodoHeading(docId);
            }

            // 4. 添加任务
            await addTaskToHeading(todoHeadingId, content, priority, dueDate);

            // 5. 刷新并通知
            loadTasks();
            showSuccess('✅ 任务已添加到今日日记');

        } catch (err) {
            console.error('[AddTask] Failed to add task:', err);
            showError(`❌ 添加任务失败: ${err.message || '未知错误'}`);
        }
    }

    // 打开添加任务对话框
    function openAddDialog() {
        showAddDialog = true;
    }

    // 关闭添加任务对话框
    function closeAddDialog() {
        showAddDialog = false;
    }

    // 打开设置对话框
    function openSettingsDialog() {
        showSettingsDialog = true;
    }

    // 关闭设置对话框
    function closeSettingsDialog() {
        showSettingsDialog = false;
    }

    // 保存设置
    function handleSaveSettings(event: CustomEvent) {
        taskSettings.dailyNoteNotebookId = event.detail.notebookId;
        saveTaskSettings();
    }
</script>

<div class="task-widget">
    <!-- 头部 -->
    <div class="widget-header">
        <div class="title-section">
            <h3 class="widget-title">
                <ListTodo size={16} style="vertical-align: -2px;" />
                任务
            </h3>
            {#if config.preferences?.showStats}
                <div class="stats-badges">
                    <span class="badge total">{stats.total}</span>
                    <span class="badge progress">{stats.inProgress}</span>
                    <span class="badge completed">{stats.completed}</span>
                </div>
            {/if}
        </div>

        <div class="actions">
            <!-- 新增任务按钮 -->
            <button class="add-btn" on:click={openAddDialog} title="添加任务到今日日记">
                <Plus size={14} />
                新增
            </button>

            <!-- 视图切换 -->
            <div class="view-switcher">
                <button
                    class="view-btn"
                    class:active={config.currentView === 'kanban'}
                    on:click={() => switchView('kanban')}
                    title="看板视图"
                >
                    <LayoutGrid size={14} />
                </button>
            </div>

            <!-- 操作按钮 -->
            <button class="icon-btn" on:click={loadTasks} title="刷新">
                <RefreshCw size={14} />
            </button>
            <button
                class="icon-btn"
                class:active={!config.filter.showCompleted}
                on:click={toggleShowCompleted}
                title={config.filter.showCompleted ? '隐藏已完成' : '显示已完成'}
            >
                {#if config.filter.showCompleted}
                    <Eye size={14} />
                {:else}
                    <EyeOff size={14} />
                {/if}
            </button>
            <button class="icon-btn" on:click={openSettingsDialog} title="设置">
                <Settings size={14} />
            </button>
        </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
        <!-- 快捷筛选 -->
        <div class="quick-filters">
            <button
                class="filter-chip"
                class:active={config.filter.quickFilter === 'all'}
                on:click={() => setQuickFilter('all')}
            >
                全部
            </button>
            <button
                class="filter-chip"
                class:active={config.filter.quickFilter === 'today'}
                on:click={() => setQuickFilter('today')}
            >
                今日
            </button>
        </div>

        <!-- 笔记本筛选 -->
        <div class="notebook-filter-wrapper">
            <NotebookFilter
                filter={config.filter.notebooks || { enabled: false, mode: 'include', notebookIds: [] }}
                on:change={handleNotebookFilterChange}
            />
        </div>

        <!-- 创建日期筛选 -->
        <div class="date-filter-wrapper">
            <DateRangeSelector
                placeholder="创建日期"
                filter={config.filter.dateFilters?.created || { enabled: false }}
                on:change={handleCreatedDateChange}
            />
        </div>

        <!-- 截止日期筛选 -->
        <div class="date-filter-wrapper">
            <DateRangeSelector
                placeholder="截止日期"
                filter={config.filter.dateFilters?.dueDate || { enabled: false }}
                on:change={handleDueDateChange}
            />
        </div>

        <!-- 完成日期筛选 -->
        <div class="date-filter-wrapper">
            <DateRangeSelector
                placeholder="完成日期"
                filter={config.filter.dateFilters?.completedDate || { enabled: false }}
                on:change={handleCompletedDateChange}
            />
        </div>

        <!-- 优先级筛选 -->
        <div class="priority-filter-wrapper">
            <PriorityFilter
                selectedPriorities={config.filter.priorities || []}
                on:change={handlePriorityChange}
            />
        </div>
    </div>

    <!-- 内容区域 -->
    <div class="widget-content">
        {#if loading}
            <div class="loading-state">
                <div class="spinner"></div>
                <p>加载任务中...</p>
            </div>
        {:else if error}
            <div class="error-state">
                <p>❌ {error}</p>
                <button class="retry-btn" on:click={loadTasks}>重试</button>
            </div>
        {:else if filteredTasks.length === 0}
            <div class="empty-state">
                <p>🎉 暂无任务</p>
                <p class="hint">所有任务都已完成或未找到符合条件的任务</p>
            </div>
        {:else}
            <!-- 看板视图 -->
            {#if config.currentView === 'kanban' && config.viewConfigs.kanban}
                <KanbanView
                    tasks={filteredTasks}
                    config={config.viewConfigs.kanban}
                    on:taskClick={handleTaskClick}
                    on:taskMove={handleTaskMove}
                    on:columnCollapse={handleColumnCollapse}
                    on:dueDateChange={handleTaskDueDateChange}
                    on:priorityChange={handleTaskPriorityChange}
                    on:archive={handleTaskArchive}
                />
            {/if}

            <!-- 其他视图（待实现） -->
            {#if config.currentView === 'list'}
                <div class="coming-soon">
                    <p>📋 列表视图</p>
                    <p class="hint">即将推出...</p>
                </div>
            {/if}

            {#if config.currentView === 'calendar'}
                <div class="coming-soon">
                    <p>📅 日历视图</p>
                    <p class="hint">即将推出...</p>
                </div>
            {/if}
        {/if}
    </div>

    <!-- 添加任务对话框 -->
    {#if showAddDialog}
        <AddTaskDialog
            on:submit={handleAddTask}
            on:close={closeAddDialog}
        />
    {/if}

    <!-- 设置对话框 -->
    {#if showSettingsDialog}
        <TaskSettingsDialog
            currentNotebookId={taskSettings.dailyNoteNotebookId}
            on:save={handleSaveSettings}
            on:close={closeSettingsDialog}
        />
    {/if}
</div>

<style>
    .task-widget {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--b3-theme-background);
        border-radius: 8px;
        overflow: hidden;
    }

    .widget-header {
        padding: 6px 10px;
        border-bottom: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .title-section {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .widget-title {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
    }

    .stats-badges {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }

    .badge {
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 500;
        min-width: 20px;
        text-align: center;
    }

    .badge.total {
        background: #e0e7ff;
        color: #4338ca;
    }

    .badge.progress {
        background: #dbeafe;
        color: #1e40af;
    }

    .badge.completed {
        background: #d1fae5;
        color: #065f46;
    }

    .actions {
        display: flex;
        gap: 6px;
        align-items: center;
    }

    .add-btn {
        padding: 3px 10px;
        border: none;
        background: var(--b3-theme-primary);
        color: white;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 3px;
    }

    .add-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .view-switcher {
        display: flex;
        gap: 2px;
        background: var(--b3-theme-background);
        border-radius: 4px;
        padding: 3px;
    }

    .view-btn {
        padding: 3px 8px;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 3px;
        font-size: 13px;
        transition: all 0.2s;
        opacity: 0.6;
    }

    .view-btn:not(:disabled):hover {
        opacity: 1;
        background: var(--b3-theme-surface);
    }

    .view-btn.active {
        opacity: 1;
        background: var(--b3-theme-primary);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .view-btn:disabled {
        cursor: not-allowed;
        opacity: 0.3;
    }

    .icon-btn {
        padding: 3px 6px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        cursor: pointer;
        border-radius: 4px;
        font-size: 13px;
        transition: all 0.2s;
    }

    .icon-btn:hover {
        background: var(--b3-theme-surface);
    }

    .icon-btn.active {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary);
    }

    /* 筛选栏样式 */
    .filter-bar {
        padding: 6px 10px;
        border-bottom: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        display: flex;
        gap: 6px;
        align-items: flex-start;
        flex-wrap: wrap;
        flex-shrink: 0;
        position: relative;
        z-index: 10;
    }

    .quick-filters {
        display: flex;
        gap: 4px;
        align-items: center;
        flex-shrink: 0;
    }

    .filter-chip {
        padding: 3px 10px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        cursor: pointer;
        border-radius: 12px;
        font-size: 11px;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .filter-chip:hover {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary);
    }

    .filter-chip.active {
        background: var(--b3-theme-primary);
        color: white;
        border-color: var(--b3-theme-primary);
    }

    .notebook-filter-wrapper {
        flex: 0 1 auto;
        width: auto;
        min-width: 0;
    }

    .date-filter-wrapper {
        flex: 0 1 auto;
        width: auto;
        min-width: 0;
    }

    .priority-filter-wrapper {
        flex: 0 1 auto;
        width: auto;
        min-width: 0;
    }

    .widget-content {
        flex: 1 1 auto;
        overflow: hidden;
        position: relative;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    .loading-state,
    .error-state,
    .empty-state,
    .coming-soon {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 16px;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid var(--b3-theme-surface);
        border-top-color: var(--b3-theme-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .error-state p,
    .empty-state p,
    .coming-soon p {
        margin: 0;
        font-size: 16px;
        color: var(--b3-theme-on-surface);
    }

    .hint {
        font-size: 14px !important;
        color: var(--b3-theme-on-surface-light) !important;
    }

    .retry-btn {
        padding: 8px 16px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-primary);
        color: white;
        cursor: pointer;
        border-radius: 6px;
        font-size: 14px;
        transition: all 0.2s;
    }

    .retry-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
</style>
