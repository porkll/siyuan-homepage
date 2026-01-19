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
        TaskBlock,
        SqlResponse,
        TaskStatusConfig
    } from '../../types/task';
    import {
        transformTasks,
        applyFilter,
        sortTasks,
        calculateStats,
        buildTaskQuery,
        parseCustomAttrs,
        parseTaskStatus,
        TASK_ATTRS,
        TASK_STATUS,
        DEFAULT_TASK_STATUS,
        getStatusConfig,
        getStatusLabel,
        isStatusCompleted
    } from '../../libs/task-utils';
    import { deepMerge } from '../../libs/utils';
    import { setBlockAttrs } from '../../api';
    import KanbanView from './task/KanbanView.svelte';
    import NotebookFilter from './task/NotebookFilter.svelte';
    import DateRangeSelector from './task/DateRangeSelector.svelte';
    import PriorityFilter from './task/PriorityFilter.svelte';
    import AddTaskDialog from './task/AddTaskDialog.svelte';
    import TaskSettingsDialog from './task/TaskSettingsDialog.svelte';
    import { DEFAULT_STATUS_CONFIG } from '../../libs/task-utils';

    // ==================== 数据迁移配置常量 ====================
    const MIGRATION_DEBOUNCE_MS = 2 * 60 * 1000;  // 防抖间隔：2分钟
    const MIGRATION_BATCH_SIZE = 10;              // 每批处理任务数
    const MIGRATION_BATCH_INTERVAL_MS = 300;      // 批次间隔：300ms
    const MIGRATION_IDLE_TIMEOUT_MS = 2000;       // IdleCallback 超时：2秒
    const MIGRATION_FALLBACK_DELAY_MS = 100;      // setTimeout 降级延迟：100ms

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
            status: TASK_STATUS.TODO,
            color: '#94a3b8',
            icon: '',
            order: 1
        },
        {
            id: 'in-progress',
            title: '进行中',
            status: TASK_STATUS.IN_PROGRESS,
            color: '#3b82f6',
            icon: '',
            order: 2
        },
        {
            id: 'review',
            title: '审核中',
            status: TASK_STATUS.REVIEW,
            color: '#f59e0b',
            icon: '',
            order: 3
        },
        {
            id: 'done',
            title: '已完成',
            status: TASK_STATUS.DONE,
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
        statusConfig: DEFAULT_STATUS_CONFIG,
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

    // 任务设置（日记笔记本、快捷状态等）
    let taskSettings = {
        dailyNoteNotebookId: '', // 日记笔记本ID
        quickStatusChange: TASK_STATUS.ARCHIVED as TaskStatus // 快捷状态变更的目标状态
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

        // ✅ 清理定时器
        if (scrollTimeout !== null) {
            clearTimeout(scrollTimeout);
        }

        // ✅ 取消待处理的迁移任务，防止资源泄漏
        cancelPendingMigration();
    });

    async function loadConfig() {
        if (!plugin) return;

        try {
            const savedConfig = await plugin.loadData(STORAGE_KEY);
            if (savedConfig) {
                // 使用深度合并而不是浅合并
                config = deepMerge(DEFAULT_CONFIG, savedConfig);

                console.log('[TaskWidget] Config loaded:', {
                    kanbanColumns: config.viewConfigs.kanban.columns.map(c => ({ id: c.id, status: c.status, order: c.order }))
                });

                // 确保"其他"状态存在（向后兼容）
                if (config.statusConfig && !config.statusConfig.statuses.some(s => s.id === '__other__')) {
                    config.statusConfig.statuses.push({
                        id: '__other__',
                        label: '其他',
                        isCompleted: false
                    });
                    console.log('[TaskWidget] Added __other__ status for backward compatibility');
                }

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
            } else {
                console.log('[TaskWidget] No saved config found, using default');
            }
        } catch (err) {
            console.error('Failed to load task widget config:', err);
        }
    }

    async function saveConfig() {
        if (!plugin) return;

        try {
            await plugin.saveData(STORAGE_KEY, config);
            console.log('[TaskWidget] Config saved:', {
                kanbanColumns: config.viewConfigs.kanban.columns.map(c => ({ id: c.id, status: c.status, order: c.order }))
            });
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
        console.log('[loadTasks] 开始加载任务');
        loading = true;
        error = null;

        try {
            const sql = buildTaskQuery(config.filter);
            fetchPost('/api/query/sql', { stmt: sql }, (response) => {
                // 检查组件是否已销毁
                if (!mounted) {
                    console.log('[loadTasks] 组件已销毁，放弃更新');
                    return;
                }

                if (response && response.code === 0) {
                    console.log('[loadTasks] 查询成功，任务数:', response.data.length);
                    allTasks = transformTasks(response.data);

                    // 将未定义状态的任务归类为"其他"
                    const definedStatusIds = config.statusConfig?.statuses.map(s => s.id) || [];
                    allTasks = allTasks.map(task => {
                        if (!definedStatusIds.includes(task.status)) {
                            return { ...task, status: '__other__' };
                        }
                        return task;
                    });

                    updateFilteredTasks();
                    console.log('[loadTasks] 更新完成，allTasks:', allTasks.length, 'filteredTasks:', filteredTasks.length);

                    // ✅ 立即显示 UI
                    loading = false;

                    // ✅ 异步检测并迁移数据，不阻塞 UI
                    setTimeout(() => {
                        console.log('[loadTasks] 准备检查数据迁移');
                        checkAndMigrateTaskStatus(response.data);
                    }, 0);
                } else {
                    console.error('[loadTasks] 查询失败:', response?.msg);
                    error = response?.msg || '加载任务失败';
                    loading = false;
                }
            });
        } catch (err) {
            if (!mounted) return;
            console.error('[loadTasks] 异常:', err);
            error = '网络错误，请稍后重试';
            loading = false;
        }
    }

    // 暴露刷新方法
    export function refresh() {
        loadTasks();
    }

    // ==================== 数据迁移逻辑 ====================

    // 防重复检测标记和回调 ID
    let migrationInProgress = false;
    let lastMigrationCheck = 0;
    let migrationTimerId: number | null = null;
    let migrationIdleCallbackId: number | null = null;

    /**
     * 检测并迁移缺少 status 属性的任务
     * ✅ 只处理未完成状态（todo、in-progress、review）
     * ✅ 轻量级检测，快速返回，不阻塞 UI
     * ✅ 防止资源泄漏和并发问题
     */
    function checkAndMigrateTaskStatus(blocks: TaskBlock[]) {
        console.log(`[数据迁移] checkAndMigrateTaskStatus 被调用，blocks 数量:`, blocks?.length || 0);

        // ✅ 检查组件是否已销毁
        if (!mounted || !blocks || blocks.length === 0) {
            console.log(`[数据迁移] 跳过：mounted=${mounted}, blocks=${blocks?.length || 0}`);
            return;
        }

        // 防抖：配置的时间间隔内只检测一次
        const now = Date.now();
        if (migrationInProgress || (now - lastMigrationCheck < MIGRATION_DEBOUNCE_MS)) {
            console.log(`[数据迁移] 跳过检测 (inProgress: ${migrationInProgress}, 距上次: ${Math.floor((now - lastMigrationCheck) / 1000)}s)`);
            return;
        }

        console.log(`[数据迁移] 通过防抖检查，开始检测需要迁移的任务`);
        lastMigrationCheck = now;

        // 快速检测：只遍历一次，收集需要迁移的任务
        const tasksToMigrate: Array<{ id: string; status: TaskStatus }> = [];

        for (const block of blocks) {
            const customAttrs = parseCustomAttrs(block.ial);

            // 如果没有 status 属性
            if (!customAttrs[TASK_ATTRS.STATUS]) {
                const { status } = parseTaskStatus(block.markdown);

                // ✅ 只处理未完成状态：todo、in-progress、review
                if (status === TASK_STATUS.TODO || status === TASK_STATUS.IN_PROGRESS || status === TASK_STATUS.REVIEW) {
                    tasksToMigrate.push({ id: block.id, status });
                }
            }
        }

        // 没有需要迁移的任务，立即返回
        if (tasksToMigrate.length === 0) {
            console.log(`[数据迁移] 无需迁移，所有任务都有 status 属性`);
            return;
        }

        console.log(`[数据迁移] 检测到 ${tasksToMigrate.length} 个未完成任务需要添加 status 属性`);

        // ✅ 先取消之前的待处理任务（如果有），确保最多只有一个迁移任务
        cancelPendingMigration();

        // ✅ 设置标志，防止并发
        migrationInProgress = true;

        // 使用 requestIdleCallback 在浏览器空闲时执行迁移
        // 如果浏览器不支持，降级为 setTimeout
        const startMigration = () => {
            // ✅ 再次检查组件是否已销毁
            if (!mounted) {
                console.log(`[数据迁移] 组件已销毁，取消迁移`);
                migrationInProgress = false;
                return;
            }

            console.log(`[数据迁移] 开始执行迁移任务`);
            migrateTaskStatusInBackground(tasksToMigrate)
                .finally(() => {
                    console.log(`[数据迁移] 迁移任务完成，重置状态标志`);
                    migrationInProgress = false;
                    migrationTimerId = null;
                    migrationIdleCallbackId = null;
                });
        };

        if (typeof requestIdleCallback !== 'undefined') {
            migrationIdleCallbackId = requestIdleCallback(startMigration, { timeout: MIGRATION_IDLE_TIMEOUT_MS });
            console.log(`[数据迁移] 已注册 IdleCallback，等待浏览器空闲`);
        } else {
            migrationTimerId = setTimeout(startMigration, MIGRATION_FALLBACK_DELAY_MS) as unknown as number;
            console.log(`[数据迁移] 已注册 Timer，${MIGRATION_FALLBACK_DELAY_MS}ms 后执行`);
        }
    }

    /**
     * 取消待处理的迁移任务
     */
    function cancelPendingMigration() {
        if (migrationTimerId !== null) {
            clearTimeout(migrationTimerId);
            migrationTimerId = null;
        }
        if (migrationIdleCallbackId !== null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(migrationIdleCallbackId);
            migrationIdleCallbackId = null;
        }
        migrationInProgress = false;
    }

    /**
     * 在后台批量迁移任务状态属性
     * ✅ 分批处理，使用配置的批次大小和间隔
     * ✅ 每批处理前检查组件状态，避免资源泄漏
     */
    async function migrateTaskStatusInBackground(tasks: Array<{ id: string; status: TaskStatus }>) {
        const totalBatches = Math.ceil(tasks.length / MIGRATION_BATCH_SIZE);

        console.log(`[数据迁移] 开始迁移，共 ${tasks.length} 个任务，分 ${totalBatches} 批处理`);

        for (let i = 0; i < totalBatches; i++) {
            // ✅ 每批处理前检查组件是否已销毁
            if (!mounted) {
                console.log(`[数据迁移] 组件已销毁，中止迁移`);
                return;
            }

            const start = i * MIGRATION_BATCH_SIZE;
            const end = Math.min(start + MIGRATION_BATCH_SIZE, tasks.length);
            const batch = tasks.slice(start, end);

            try {
                // 批量并发更新当前批次
                const promises = batch.map(task =>
                    setBlockAttrs(task.id, {
                        [TASK_ATTRS.STATUS]: task.status
                    }).catch(err => {
                        console.error(`[数据迁移] 更新任务 ${task.id} 失败:`, err);
                        return null;
                    })
                );

                await Promise.all(promises);

                console.log(`[数据迁移] 完成第 ${i + 1}/${totalBatches} 批，已迁移 ${end}/${tasks.length} 个任务`);
            } catch (err) {
                console.error(`[数据迁移] 批次 ${i + 1} 处理失败:`, err);
            }

            // 每批之间间隔，避免对系统造成压力
            if (i < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, MIGRATION_BATCH_INTERVAL_MS));
            }
        }

        console.log(`[数据迁移] 全部完成，共迁移 ${tasks.length} 个任务`);

        // ✅ 迁移完成后重新加载任务，确保 UI 显示最新数据
        if (mounted) {
            console.log(`[数据迁移] 迁移完成，准备重新加载任务以更新 UI`);
            console.log(`[数据迁移] 当前 allTasks 数量:`, allTasks.length);
            console.log(`[数据迁移] 当前 filteredTasks 数量:`, filteredTasks.length);
            loadTasks();
        }
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
            newState.status = TASK_STATUS.ARCHIVED;
            newState.completed = true;
            newState.archivedAt = now;
            newState.needUpdateMarkdown = true;
            newState.newMarkdown = task.markdown.replace(/^([*-]\s*)\[.\]/, '$1[x]');
        }
        // 处理状态变更（只有在不归档时才处理）
        else if (updates.status !== undefined) {
            newState.status = updates.status;
            newState.completed = updates.status === TASK_STATUS.DONE || updates.status === TASK_STATUS.ARCHIVED;

            // 判断是否需要更新 markdown
            const targetCheckbox = (updates.status === TASK_STATUS.TODO || updates.status === TASK_STATUS.IN_PROGRESS || updates.status === TASK_STATUS.REVIEW) ? '[ ]' : '[x]';
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
            // 所有状态都保留 status 属性，便于统一查询和管理
            attrs[TASK_ATTRS.STATUS] = status;

            // 更新完成时间
            if (status === TASK_STATUS.DONE) {
                attrs[TASK_ATTRS.COMPLETED_TIME] = now.toISOString();
            } else if (status === TASK_STATUS.TODO || status === TASK_STATUS.IN_PROGRESS || status === TASK_STATUS.REVIEW) {
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
        updatedTask.completed = toStatus === TASK_STATUS.DONE || toStatus === TASK_STATUS.ARCHIVED;

        // 更新 markdown
        if (toStatus === TASK_STATUS.TODO || toStatus === TASK_STATUS.IN_PROGRESS || toStatus === TASK_STATUS.REVIEW) {
            updatedTask.markdown = updatedTask.markdown.replace(/^([*-]\s*)\[.\]/, '$1[ ]');
        } else if (toStatus === TASK_STATUS.DONE || toStatus === TASK_STATUS.ARCHIVED) {
            updatedTask.markdown = updatedTask.markdown.replace(/^([*-]\s*)\[.\]/, '$1[x]');
        }

        // 确保 customAttrs 存在
        if (!updatedTask.customAttrs) {
            updatedTask.customAttrs = {};
        }

        // 更新自定义属性
        // 所有状态都保留 status 属性，保持与后端逻辑一致
        updatedTask.customAttrs[TASK_ATTRS.STATUS] = toStatus;

        // 更新完成时间
        if (toStatus === TASK_STATUS.DONE) {
            const now = new Date();
            updatedTask.customAttrs[TASK_ATTRS.COMPLETED_TIME] = now.toISOString();
            updatedTask.completedAt = now;
        } else if (toStatus === TASK_STATUS.TODO || toStatus === TASK_STATUS.IN_PROGRESS || toStatus === TASK_STATUS.REVIEW) {
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

    // 处理任务状态变更
    function handleTaskStatusChange(event: CustomEvent) {
        const { task, status } = event.detail;
        updateTask(task, { status });
    }

    // 处理任务排除（不纳入管理范围）
    async function handleTaskExcludeFromManagement(event: CustomEvent) {
        const { task } = event.detail;

        try {
            // 先调用 API 设置排除属性
            await setBlockAttrs(task.id, {
                [TASK_ATTRS.EXCLUDE_FROM_MANAGEMENT]: 'true'
            });

            // API 成功后，从本地列表中移除该任务
            allTasks = allTasks.filter(t => t.id !== task.id);
            filteredTasks = filteredTasks.filter(t => t.id !== task.id);

            showSuccess('✅ 任务已排除，不再纳入管理范围');
        } catch (err) {
            console.error('Failed to exclude task:', err);
            showError('❌ 操作失败，请重试');
        }
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

        // 设置任务属性（状态、优先级、截止日期）
        const attrs: Record<string, string> = {
            [TASK_ATTRS.STATUS]: DEFAULT_TASK_STATUS  // 新任务默认状态
        };
        if (priority) attrs[TASK_ATTRS.PRIORITY] = priority;
        if (dueDate) attrs[TASK_ATTRS.DUE_DATE] = dueDate.toISOString();

        await fetchPostAsync('/api/attr/setBlockAttrs', {
            id: taskId,
            attrs: attrs
        });

        return taskId;
    }

    /**
     * 处理添加新任务（使用乐观更新）
     */
    async function handleAddTask(event: CustomEvent) {
        const { content, priority, dueDate } = event.detail;

        // 检查是否已设置日记笔记本
        if (!taskSettings.dailyNoteNotebookId) {
            showError('请先设置日记笔记本');
            showSettingsDialog = true;
            return;
        }

        // 生成临时任务 ID（用于乐观更新）
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const now = new Date();

        // 1. 创建临时任务对象（乐观更新）
        const optimisticTask: Task = {
            id: tempId,
            content: content,
            markdown: `- [ ] ${content}`,
            completed: false,
            status: DEFAULT_TASK_STATUS,
            priority: priority || undefined,
            dueDate: dueDate || undefined,
            createdAt: now,
            updatedAt: now,
            docId: '', // 待后端返回
            docName: '今日日记',
            notebookId: taskSettings.dailyNoteNotebookId,
            notebookName: '',
            customAttrs: {
                [TASK_ATTRS.STATUS]: DEFAULT_TASK_STATUS,
                ...(priority && { [TASK_ATTRS.PRIORITY]: priority }),
                ...(dueDate && { [TASK_ATTRS.DUE_DATE]: dueDate.toISOString() })
            }
        };

        // 2. 立即添加到本地状态（乐观更新）
        allTasks = [optimisticTask, ...allTasks];

        // 重新筛选，但确保临时任务总是可见
        let newFiltered = applyFilter(allTasks, config.filter);

        // 如果临时任务被筛选掉了，强制添加它（让用户看到即时反馈）
        if (!newFiltered.find(t => t.id === tempId)) {
            newFiltered = [optimisticTask, ...newFiltered];
        }

        filteredTasks = newFiltered;

        // 3. 显示乐观反馈（对话框会自动在 100ms 后关闭）
        showSuccess('✅ 正在添加任务...');

        try {
            // 4. 异步添加到后端
            const dailyNote = await fetchPostAsync('/api/filetree/createDailyNote', {
                notebook: taskSettings.dailyNoteNotebookId
            });
            const docId = dailyNote.data.id;

            let todoHeadingId = await findTodoHeadingBySQL(docId);
            if (!todoHeadingId) {
                todoHeadingId = await createTodoHeading(docId);
            }

            const realTaskId = await addTaskToHeading(todoHeadingId, content, priority, dueDate);

            // 5. 直接用真实 ID 更新临时任务（不需要查询数据库）
            console.log('[AddTask] 用真实 ID 替换临时任务:', { tempId, realTaskId });

            // 更新 allTasks：把临时任务替换为真实任务
            allTasks = allTasks.map(t => {
                if (t.id === tempId) {
                    return {
                        ...t,
                        id: realTaskId,
                        docId: docId
                    };
                }
                return t;
            });

            // 更新 filteredTasks：把临时任务替换为真实任务
            filteredTasks = filteredTasks.map(t => {
                if (t.id === tempId) {
                    return {
                        ...t,
                        id: realTaskId,
                        docId: docId
                    };
                }
                return t;
            });

            console.log('[AddTask] 任务 ID 已更新，allTasks count:', allTasks.length);
            console.log('[AddTask] filteredTasks count:', filteredTasks.length);

            showSuccess('✅ 任务已添加到今日日记');

        } catch (err) {
            console.error('[AddTask] Failed to add task:', err);

            // 6. 后端失败，移除乐观添加的任务
            allTasks = allTasks.filter(t => t.id !== tempId);
            updateFilteredTasks();

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
        const { notebookId, statusConfig } = event.detail;

        console.log('[TaskWidget] Saving settings:', { notebookId, statusConfig });

        // 保存笔记本设置
        taskSettings.dailyNoteNotebookId = notebookId;
        saveTaskSettings();

        // 保存状态配置
        if (statusConfig) {
            config.statusConfig = statusConfig;

            // 从状态配置更新看板列
            updateKanbanColumnsFromStatusConfig(statusConfig);

            saveConfig();
        }
    }

    // 从状态配置更新看板列
    function updateKanbanColumnsFromStatusConfig(statusConfig: TaskStatusConfig) {
        const visibleStatuses = statusConfig.statuses.filter(s =>
            statusConfig.visibleColumns.includes(s.id)
        );

        config.viewConfigs.kanban = config.viewConfigs.kanban || {
            columns: [],
            showEmptyColumns: true,
            groupBy: 'status',
            sortBy: 'created',
            sortOrder: 'desc'
        };

        config.viewConfigs.kanban.columns = visibleStatuses.map((status, index) => ({
            id: status.id,
            title: status.label,
            status: status.id,
            color: '#94a3b8', // 可以后续扩展支持自定义颜色
            icon: '',
            order: index + 1
        }));

        console.log('[TaskWidget] Updated kanban columns:', config.viewConfigs.kanban.columns);
    }

    // 批量修改状态处理
    async function handleBatchStatusChange(event: CustomEvent) {
        const { fromStatus, toStatus, tasks } = event.detail;

        console.log('[TaskWidget] Batch status change:', { fromStatus, toStatus, count: tasks.length });

        if (tasks.length === 0) {
            showError('没有找到需要修改的任务');
            return;
        }

        // 检查是否需要更新 markdown（状态改变是否影响 checkbox）
        const toStatusDef = config.statusConfig?.statuses.find(s => s.id === toStatus);
        const needUpdateCheckbox = toStatusDef ? toStatusDef.isCompleted : false;

        // 如果批量较大且需要更新 markdown，给出警告
        if (tasks.length > 50 && needUpdateCheckbox) {
            if (!confirm(`即将修改 ${tasks.length} 个任务的状态（每个任务需要2个API请求），这可能需要较长时间。是否继续？`)) {
                return;
            }
        }

        // 记录成功和失败的任务
        let successTasks: Task[] = [];
        let failedTasks: Task[] = [];

        try {
            // 显示处理中的提示
            loading = true;

            // 根据任务数量动态调整批次大小
            const batchSize = tasks.length > 100 ? 5 : 10; // 超过100个任务时减小批次
            const batchDelay = tasks.length > 100 ? 500 : 300; // 超过100个任务时增加延迟

            console.log(`[TaskWidget] 第1轮处理: ${tasks.length} 个任务，批次大小 ${batchSize}，延迟 ${batchDelay}ms`);

            // 第一轮：批量更新任务状态
            for (let i = 0; i < tasks.length; i += batchSize) {
                const batch = tasks.slice(i, Math.min(i + batchSize, tasks.length));

                console.log(`[TaskWidget] 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(tasks.length / batchSize)}`);

                // 使用 Promise.allSettled 而不是 Promise.all，这样单个失败不会中断整个批次
                const results = await Promise.allSettled(
                    batch.map(task => updateTaskWithPromise(task, { status: toStatus }))
                );

                // 收集成功和失败的任务
                results.forEach((result, index) => {
                    const task = batch[index];
                    if (result.status === 'fulfilled') {
                        successTasks.push(task);
                    } else {
                        failedTasks.push(task);
                        console.error(`[TaskWidget] 任务 ${task.id} 失败:`, result.reason);
                    }
                });

                // 短暂延迟，避免请求过快
                if (i + batchSize < tasks.length) {
                    await new Promise(resolve => setTimeout(resolve, batchDelay));
                }
            }

            // 第二轮：重试失败的任务（只重试一次）
            if (failedTasks.length > 0) {
                console.log(`[TaskWidget] 第2轮重试: ${failedTasks.length} 个失败任务`);

                const retryTasks = [...failedTasks];
                failedTasks = []; // 清空失败列表，准备收集重试后仍失败的任务

                // 重试时使用更小的批次和更长的延迟
                const retryBatchSize = 3;
                const retryDelay = 800;

                for (let i = 0; i < retryTasks.length; i += retryBatchSize) {
                    const batch = retryTasks.slice(i, Math.min(i + retryBatchSize, retryTasks.length));

                    console.log(`[TaskWidget] 重试批次 ${Math.floor(i / retryBatchSize) + 1}/${Math.ceil(retryTasks.length / retryBatchSize)}`);

                    const results = await Promise.allSettled(
                        batch.map(task => updateTaskWithPromise(task, { status: toStatus }))
                    );

                    results.forEach((result, index) => {
                        const task = batch[index];
                        if (result.status === 'fulfilled') {
                            successTasks.push(task);
                            console.log(`[TaskWidget] 重试成功: ${task.id}`);
                        } else {
                            failedTasks.push(task);
                            console.error(`[TaskWidget] 重试仍失败: ${task.id}`, result.reason);
                        }
                    });

                    // 重试时使用更长的延迟
                    if (i + retryBatchSize < retryTasks.length) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }

            // 更新本地显示（已通过乐观更新完成，只需刷新筛选）
            updateFilteredTasks();

            // 显示结果
            if (failedTasks.length === 0) {
                showSuccess(`✅ 成功修改 ${successTasks.length} 个任务`);
                console.log(`[TaskWidget] 批量操作完成: 成功 ${successTasks.length} 个`);
            } else {
                const message = `部分完成: 成功 ${successTasks.length} 个，失败 ${failedTasks.length} 个（详见控制台）`;
                showError(message);
                console.error('[TaskWidget] 最终失败的任务:', failedTasks.map(t => ({ id: t.id, content: t.content })));
            }

        } catch (error) {
            console.error('[TaskWidget] Batch status change failed:', error);
            showError('批量修改出现异常');
        } finally {
            loading = false;
        }
    }

    /**
     * Promise 版本的任务更新（用于批量操作）
     * 不做乐观更新，由调用方统一处理
     */
    function updateTaskWithPromise(task: Task, updates: TaskUpdate): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // === 步骤1: 计算新状态和需要更新的内容 ===
                const newState = computeNewTaskState(task, updates);

                // === 步骤2: 乐观更新本地（批量操作时每个任务都更新） ===
                applyOptimisticUpdate(task, newState);

                // === 步骤3: 同步到后端 ===
                syncTaskToBackendWithPromise(task, newState)
                    .then(() => resolve())
                    .catch((err) => {
                        // 如果后端失败，回滚本地状态
                        console.error(`[TaskWidget] Failed to sync task ${task.id}, will not rollback optimistic update`);
                        reject(err);
                    });

            } catch (err) {
                console.error('Failed to update task:', err);
                reject(err);
            }
        });
    }

    /**
     * Promise 版本的后端同步（用于批量操作）
     */
    function syncTaskToBackendWithPromise(task: Task, newState: any): Promise<void> {
        return new Promise((resolve, reject) => {
            // 如果需要更新 markdown，先更新它（因为 updateBlock 会清除属性）
            if (newState.needUpdateMarkdown) {
                fetchPost('/api/block/updateBlock', {
                    id: task.id,
                    dataType: 'markdown',
                    data: newState.newMarkdown
                }, (response) => {
                    if (response && response.code === 0) {
                        // markdown 更新成功后，设置所有属性
                        setTaskAttributesAPIWithPromise(task.id, newState.attrs)
                            .then(() => resolve())
                            .catch((err) => reject(err));
                    } else {
                        console.error('Failed to update markdown:', response);
                        reject(new Error('更新 Markdown 失败'));
                    }
                });
            } else {
                // 不需要更新 markdown，直接设置属性
                setTaskAttributesAPIWithPromise(task.id, newState.attrs)
                    .then(() => resolve())
                    .catch((err) => reject(err));
            }
        });
    }

    /**
     * Promise 版本的属性设置 API（用于批量操作）
     */
    function setTaskAttributesAPIWithPromise(taskId: string, attrs: Record<string, string>): Promise<void> {
        return new Promise((resolve, reject) => {
            fetchPost('/api/attr/setBlockAttrs', {
                id: taskId,
                attrs: attrs
            }, (response) => {
                if (response && response.code === 0) {
                    resolve();
                } else {
                    console.error('Failed to set attributes:', response);
                    reject(new Error('设置属性失败'));
                }
            });
        });
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
                    statusConfig={config.statusConfig}
                    on:taskClick={handleTaskClick}
                    on:taskMove={handleTaskMove}
                    on:columnCollapse={handleColumnCollapse}
                    on:dueDateChange={handleTaskDueDateChange}
                    on:priorityChange={handleTaskPriorityChange}
                    on:statusChange={handleTaskStatusChange}
                    on:excludeFromManagement={handleTaskExcludeFromManagement}
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
            statusConfig={config.statusConfig}
            tasks={allTasks}
            on:save={handleSaveSettings}
            on:batchStatusChange={handleBatchStatusChange}
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
