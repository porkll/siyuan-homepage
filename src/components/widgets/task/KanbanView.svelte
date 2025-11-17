<!--
  看板视图组件
  类似 Trello/Jira 的看板布局，支持拖拽排序
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task, KanbanColumn, KanbanViewConfig } from '../../../types/task';
    import { groupByStatus } from '../../../libs/task-utils';

    export let tasks: Task[] = [];
    export let config: KanbanViewConfig;

    const dispatch = createEventDispatcher<{
        taskClick: Task;
        taskMove: { task: Task; fromStatus: string; toStatus: string };
        columnCollapse: { columnId: string; collapsed: boolean };
    }>();

    // 按列组织任务
    $: tasksByColumn = organizeTasksByColumn(tasks, config.columns);

    function organizeTasksByColumn(tasks: Task[], columns: KanbanColumn[]) {
        const grouped = groupByStatus(tasks);
        const result = new Map<string, Task[]>();

        for (const column of columns) {
            result.set(column.id, grouped.get(column.status) || []);
        }

        return result;
    }

    // 拖拽相关
    let draggedTask: Task | null = null;
    let draggedFromColumn: string | null = null;

    function handleDragStart(task: Task, columnId: string) {
        draggedTask = task;
        draggedFromColumn = columnId;
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    function handleDrop(event: DragEvent, targetColumnId: string) {
        event.preventDefault();

        if (!draggedTask || !draggedFromColumn) return;

        const targetColumn = config.columns.find(c => c.id === targetColumnId);
        if (!targetColumn) return;

        // 触发任务移动事件
        dispatch('taskMove', {
            task: draggedTask,
            fromStatus: draggedFromColumn,
            toStatus: targetColumn.status
        });

        draggedTask = null;
        draggedFromColumn = null;
    }

    function handleTaskClick(task: Task) {
        dispatch('taskClick', task);
    }

    function toggleColumn(columnId: string) {
        const column = config.columns.find(c => c.id === columnId);
        if (column) {
            dispatch('columnCollapse', {
                columnId,
                collapsed: !column.collapsed
            });
        }
    }

    // 优先级颜色映射
    const priorityColors = {
        urgent: '#ef4444',
        high: '#f97316',
        medium: '#eab308',
        low: '#6b7280'
    };

    // 格式化日期
    function formatDate(date: Date): string {
        const now = new Date();
        const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '明天';
        if (diffDays === -1) return '昨天';
        if (diffDays < 0) return `逾期 ${-diffDays} 天`;
        if (diffDays < 7) return `${diffDays} 天后`;

        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }

    // 检查是否逾期
    function isOverdue(task: Task): boolean {
        return !task.completed && task.dueDate ? task.dueDate < new Date() : false;
    }

    // 截断文本
    function truncateText(text: string, maxLength: number = 100): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
</script>

<div class="kanban-view">
    <div class="kanban-columns">
        {#each config.columns as column (column.id)}
            {@const columnTasks = tasksByColumn.get(column.id) || []}
            {#if config.showEmptyColumns || columnTasks.length > 0}
                <div
                    class="kanban-column"
                    class:collapsed={column.collapsed}
                    on:dragover={handleDragOver}
                    on:drop={(e) => handleDrop(e, column.id)}
                >
                    <!-- 列头 -->
                    <div class="column-header" style:border-color={column.color || '#e5e7eb'}>
                        <div class="column-title">
                            {#if column.icon}
                                <span class="column-icon">{column.icon}</span>
                            {/if}
                            <span class="column-name">{column.title}</span>
                            <span class="task-count">{columnTasks.length}</span>
                        </div>
                        <button
                            class="collapse-btn"
                            on:click={() => toggleColumn(column.id)}
                            aria-label={column.collapsed ? '展开' : '折叠'}
                        >
                            {column.collapsed ? '▶' : '▼'}
                        </button>
                    </div>

                    <!-- 任务列表 -->
                    {#if !column.collapsed}
                        <div class="column-content">
                            {#if columnTasks.length === 0}
                                <div class="empty-state">暂无任务</div>
                            {:else}
                                {#each columnTasks as task (task.id)}
                                    <div
                                        class="task-card"
                                        class:overdue={isOverdue(task)}
                                        draggable="true"
                                        on:dragstart={() => handleDragStart(task, column.id)}
                                        on:click={() => handleTaskClick(task)}
                                    >
                                        <!-- 优先级标记 -->
                                        {#if task.priority}
                                            <div
                                                class="priority-indicator"
                                                style:background-color={priorityColors[task.priority]}
                                            />
                                        {/if}

                                        <!-- 任务内容 -->
                                        <div class="task-content" title={task.content}>
                                            {truncateText(task.content)}
                                        </div>

                                        <!-- 任务元信息 -->
                                        <div class="task-meta">
                                            <!-- 截止日期 -->
                                            {#if task.dueDate}
                                                <span
                                                    class="due-date"
                                                    class:overdue={isOverdue(task)}
                                                >
                                                    📅 {formatDate(task.dueDate)}
                                                </span>
                                            {/if}

                                            <!-- 标签 -->
                                            {#if task.tags && task.tags.length > 0}
                                                <div class="tags">
                                                    {#each task.tags.slice(0, 3) as tag}
                                                        <span class="tag">{tag}</span>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>

                                        <!-- 文档信息 -->
                                        <div class="task-source">
                                            <span class="doc-name" title={task.docPath}>
                                                📄 {task.docName}
                                            </span>
                                        </div>

                                        <!-- 进度条 -->
                                        {#if task.progress !== undefined && task.progress > 0}
                                            <div class="progress-bar">
                                                <div
                                                    class="progress-fill"
                                                    style:width="{task.progress}%"
                                                />
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    {/if}

                    <!-- 列底部信息 -->
                    {#if column.maxItems && columnTasks.length >= column.maxItems}
                        <div class="column-footer warning">
                            ⚠️ 已达到最大任务数限制 ({column.maxItems})
                        </div>
                    {/if}
                </div>
            {/if}
        {/each}
    </div>
</div>

<style>
    .kanban-view {
        width: 100%;
        height: 100%;
        overflow: auto;
        padding: 12px;
    }

    .kanban-columns {
        display: flex;
        gap: 16px;
        min-height: min-content;
        align-items: flex-start;
    }

    .kanban-column {
        min-width: 280px;
        max-width: 320px;
        background: var(--b3-theme-surface);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        max-height: 100%;
    }

    .kanban-column.collapsed {
        min-width: 60px;
        max-width: 60px;
    }

    .column-header {
        padding: 12px;
        border-bottom: 3px solid;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        background: var(--b3-theme-surface);
        z-index: 1;
    }

    .column-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
    }

    .collapsed .column-title {
        writing-mode: vertical-rl;
        text-orientation: mixed;
    }

    .column-icon {
        font-size: 18px;
    }

    .task-count {
        background: var(--b3-theme-primary-lighter);
        color: var(--b3-theme-primary);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 12px;
        font-weight: 600;
    }

    .collapse-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: var(--b3-theme-on-surface);
        opacity: 0.6;
        transition: opacity 0.2s;
    }

    .collapse-btn:hover {
        opacity: 1;
    }

    .column-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: calc(100vh - 350px);
    }

    .empty-state {
        text-align: center;
        padding: 32px 16px;
        color: var(--b3-theme-on-surface-light);
        font-size: 14px;
    }

    .task-card {
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        padding: 8px 12px 12px 12px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
    }

    .task-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .task-card.overdue {
        border-left: 3px solid #ef4444;
    }

    .priority-indicator {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
    }

    .task-content {
        margin: 0 0 8px 0;
        color: var(--b3-theme-on-background);
        font-size: 14px;
        line-height: 1.4;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        max-height: 4.2em; /* 1.4 * 3 行 */
    }

    .task-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 6px;
        align-items: center;
    }

    .due-date {
        font-size: 12px;
        color: var(--b3-theme-on-surface-light);
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .due-date.overdue {
        color: #ef4444;
        font-weight: 600;
    }

    .tags {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }

    .tag {
        background: var(--b3-theme-primary-lightest);
        color: var(--b3-theme-primary);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
    }

    .task-source {
        font-size: 11px;
        color: var(--b3-theme-on-surface-light);
        border-top: 1px solid var(--b3-border-color);
        padding-top: 6px;
        margin-top: 0;
    }

    .doc-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
    }

    .progress-bar {
        height: 4px;
        background: var(--b3-theme-surface);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;
    }

    .progress-fill {
        height: 100%;
        background: var(--b3-theme-primary);
        transition: width 0.3s;
    }

    .column-footer {
        padding: 8px 12px;
        font-size: 12px;
        text-align: center;
        border-top: 1px solid var(--b3-border-color);
    }

    .column-footer.warning {
        background: #fef3c7;
        color: #92400e;
    }
</style>
