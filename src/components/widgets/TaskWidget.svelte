<!--
  任务管理 Widget
  支持看板视图、列表视图、日历视图等多种视图模式
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { fetchPost, openTab } from 'siyuan';
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

    export let app; // App 实例，用于打开文档
    export let plugin; // 插件实例，用于保存配置

    const STORAGE_KEY = 'task-widget-config';

    // 默认看板列配置
    const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
        {
            id: 'todo',
            title: '待办',
            status: 'todo' as TaskStatus,
            color: '#94a3b8',
            icon: '📋',
            order: 1
        },
        {
            id: 'in-progress',
            title: '进行中',
            status: 'in-progress' as TaskStatus,
            color: '#3b82f6',
            icon: '🚀',
            order: 2
        },
        {
            id: 'review',
            title: '审核中',
            status: 'review' as TaskStatus,
            color: '#f59e0b',
            icon: '👀',
            order: 3
        },
        {
            id: 'done',
            title: '已完成',
            status: 'done' as TaskStatus,
            color: '#10b981',
            icon: '✅',
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

    // 统计信息
    $: stats = calculateStats(filteredTasks);

    // 加载配置
    onMount(async () => {
        await loadConfig();
        await loadTasks();

        // 自动刷新
        if (config.preferences?.autoRefresh) {
            const interval = setInterval(loadTasks, (config.preferences.refreshInterval || 300) * 1000);
            return () => clearInterval(interval);
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

    // 加载任务数据
    function loadTasks() {
        loading = true;
        error = null;

        try {
            const sql = buildTaskQuery(config.filter);
            fetchPost('/api/query/sql', { stmt: sql }, (response) => {
                if (response && response.code === 0) {
                    allTasks = transformTasks(response.data);
                    updateFilteredTasks();
                } else {
                    error = response?.msg || '加载任务失败';
                }
                loading = false;
            });
        } catch (err) {
            console.error('Failed to load tasks:', err);
            error = '网络错误，请稍后重试';
            loading = false;
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
            setTimeout(() => {
                const taskElement = document.querySelector(
                    `.protyle-wysiwyg [data-node-id="${task.id}"]`
                );
                if (taskElement) {
                    taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        } catch (err) {
            console.error('Failed to open task:', err);
        }
    }

    // 处理任务移动（更新状态）
    function handleTaskMove(event: CustomEvent) {
        const { task, toStatus } = event.detail;

        try {
            // 判断是否需要更新 markdown（仅 todo/done 需要）
            let needUpdateMarkdown = false;
            let newMarkdown = task.markdown;

            if (toStatus === 'todo' || toStatus === 'in-progress' || toStatus === 'review') {
                // 这些状态都用 [ ]
                if (!task.markdown.match(/^[*-]\s*\[\s\]/)) {
                    newMarkdown = task.markdown.replace(/^([*-]\s*)\[.\]/, '$1[ ]');
                    needUpdateMarkdown = true;
                }
            } else if (toStatus === 'done' || toStatus === 'archived') {
                // 这些状态都用 [x]
                if (!task.markdown.match(/^[*-]\s*\[x\]/i)) {
                    newMarkdown = task.markdown.replace(/^([*-]\s*)\[.\]/, '$1[x]');
                    needUpdateMarkdown = true;
                }
            }

            // 准备自定义属性
            const attrs: Record<string, string> = {};
            if (toStatus === 'in-progress' || toStatus === 'review' || toStatus === 'archived') {
                // 需要设置 custom-task-status 属性
                attrs[TASK_ATTRS.STATUS] = toStatus;
            } else {
                // todo 和 done 不需要 custom-task-status，如果有的话需要移除
                // 通过设置为空字符串来移除属性
                if (task.customAttrs?.[TASK_ATTRS.STATUS]) {
                    attrs[TASK_ATTRS.STATUS] = '';
                }
            }

            // 先更新属性，再更新 markdown
            fetchPost('/api/attr/setBlockAttrs', {
                id: task.id,
                attrs: attrs
            }, (attrResponse) => {
                if (attrResponse && attrResponse.code === 0) {
                    // 如果需要更新 markdown
                    if (needUpdateMarkdown) {
                        fetchPost('/api/block/updateBlock', {
                            id: task.id,
                            dataType: 'markdown',
                            data: newMarkdown
                        }, (updateResponse) => {
                            if (updateResponse && updateResponse.code === 0) {
                                loadTasks();
                            } else {
                                console.error('Failed to update block:', updateResponse);
                            }
                        });
                    } else {
                        // 不需要更新 markdown，直接重新加载
                        loadTasks();
                    }
                } else {
                    console.error('Failed to set attrs:', attrResponse);
                }
            });
        } catch (err) {
            console.error('Failed to move task:', err);
        }
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

    // 处理优先级筛选变化
    function handlePriorityChange(event: CustomEvent) {
        config.filter.priorities = event.detail;
        updateFilteredTasks();
        saveConfig();
    }
</script>

<div class="task-widget">
    <!-- 头部 -->
    <div class="widget-header">
        <div class="title-section">
            <h3 class="widget-title">📝 任务</h3>
            {#if config.preferences?.showStats}
                <div class="stats-badges">
                    <span class="badge total">{stats.total}</span>
                    <span class="badge progress">{stats.inProgress}</span>
                    <span class="badge completed">{stats.completed}</span>
                </div>
            {/if}
        </div>

        <div class="actions">
            <!-- 视图切换 -->
            <div class="view-switcher">
                <button
                    class="view-btn"
                    class:active={config.currentView === 'kanban'}
                    on:click={() => switchView('kanban')}
                    title="看板视图"
                >
                    📊
                </button>
            </div>

            <!-- 操作按钮 -->
            <button class="icon-btn" on:click={loadTasks} title="刷新">
                🔄
            </button>
            <button
                class="icon-btn"
                class:active={!config.filter.showCompleted}
                on:click={toggleShowCompleted}
                title={config.filter.showCompleted ? '隐藏已完成' : '显示已完成'}
            >
                {config.filter.showCompleted ? '👁️' : '🙈'}
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
                📅 今日
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
        padding: 10px 12px;
        border-bottom: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .title-section {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .widget-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
    }

    .stats-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    .badge {
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 500;
        min-width: 24px;
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
        gap: 8px;
        align-items: center;
    }

    .view-switcher {
        display: flex;
        gap: 4px;
        background: var(--b3-theme-background);
        border-radius: 6px;
        padding: 4px;
    }

    .view-btn {
        padding: 4px 10px;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 4px;
        font-size: 14px;
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
        padding: 4px 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        cursor: pointer;
        border-radius: 4px;
        font-size: 14px;
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
        padding: 8px 12px;
        border-bottom: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        display: flex;
        gap: 12px;
        align-items: center;
        overflow-x: auto;
        overflow-y: hidden;
        flex-wrap: nowrap;
    }

    .filter-bar::-webkit-scrollbar {
        height: 4px;
    }

    .filter-bar::-webkit-scrollbar-thumb {
        background: var(--b3-theme-surface);
        border-radius: 2px;
    }

    .filter-bar::-webkit-scrollbar-thumb:hover {
        background: var(--b3-theme-primary-lighter);
    }

    .quick-filters {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-shrink: 0;
    }

    .filter-chip {
        padding: 4px 12px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        cursor: pointer;
        border-radius: 16px;
        font-size: 12px;
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
        min-width: 280px;
        width: 300px;
        max-width: 40%;
        flex-shrink: 0;
    }

    .date-filter-wrapper {
        min-width: 180px;
        width: 200px;
        flex-shrink: 0;
    }

    .priority-filter-wrapper {
        min-width: 160px;
        width: 180px;
        flex-shrink: 0;
    }

    .widget-content {
        flex: 1;
        overflow: hidden;
        position: relative;
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
