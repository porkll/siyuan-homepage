<!--
  看板视图组件
  类似 Trello/Jira 的看板布局，支持拖拽排序
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task, KanbanColumn, KanbanViewConfig } from '../../../types/task';
    import { groupByStatus } from '../../../libs/task-utils';
    import TaskCard from './TaskCard.svelte';

    export let tasks: Task[] = [];
    export let config: KanbanViewConfig;

    const dispatch = createEventDispatcher<{
        taskClick: Task;
        taskMove: { task: Task; fromStatus: string; toStatus: string };
        columnCollapse: { columnId: string; collapsed: boolean };
        dueDateChange: { task: Task; dueDate: Date | null };
        priorityChange: { task: Task; priority: string | null };
        archive: { task: Task };
    }>();

    // 监听容器宽度，动态调整列宽
    let containerWidth = 0;

    // 根据容器宽度计算每列的最小宽度
    $: columnMinWidth = getColumnMinWidth(containerWidth);

    function getColumnMinWidth(width: number): number {
        if (width === 0) return 160; // 默认值

        // 根据容器宽度动态计算最小列宽
        const visibleColumns = config.columns.filter(c => !c.collapsed).length;
        const gap = 12; // gap 大小
        const padding = 16; // .kanban-columns 的左右 padding (8px * 2)
        const availableWidth = width - padding - (visibleColumns - 1) * gap;
        const calculatedWidth = availableWidth / visibleColumns;

        // 设置合理的范围：最小 160px，最大 280px
        return Math.max(160, Math.min(280, calculatedWidth));
    }

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

    function handleTaskClick(event: CustomEvent<Task>) {
        dispatch('taskClick', event.detail);
    }

    function handleTaskDragStart(event: CustomEvent<{ task: Task; columnId: string }>) {
        const { task, columnId } = event.detail;
        draggedTask = task;
        draggedFromColumn = columnId;
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

    function handleDueDateChange(event: CustomEvent<{ task: Task; dueDate: Date | null }>) {
        dispatch('dueDateChange', event.detail);
    }

    function handlePriorityChange(event: CustomEvent<{ task: Task; priority: string | null }>) {
        dispatch('priorityChange', event.detail);
    }

    function handleArchive(event: CustomEvent<{ task: Task }>) {
        dispatch('archive', event.detail);
    }
</script>

<div class="kanban-view" bind:clientWidth={containerWidth}>
    <div class="kanban-columns" style="--column-min-width: {columnMinWidth}px;">
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
                                    <TaskCard
                                        {task}
                                        columnId={column.id}
                                        on:taskClick={handleTaskClick}
                                        on:dragStart={handleTaskDragStart}
                                        on:dueDateChange={handleDueDateChange}
                                        on:priorityChange={handlePriorityChange}
                                        on:archive={handleArchive}
                                    />
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
        display: flex;
        flex-direction: column;
    }

    .kanban-columns {
        display: flex;
        gap: 12px;
        height: 100%;
        align-items: stretch;
        flex-wrap: nowrap;
        padding: 8px;
        --column-min-width: 160px; /* 默认值，会被 JS 动态覆盖 */
    }

    .kanban-column {
        flex: 1 1 var(--column-min-width);
        min-width: var(--column-min-width);
        background: var(--b3-theme-surface);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
    }

    .kanban-column.collapsed {
        flex: 0 0 48px;
        min-width: 48px;
        max-width: 48px;
    }

    .column-header {
        padding: 8px 10px;
        border-bottom: 2px solid;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
        background: var(--b3-theme-surface);
        z-index: 1;
        border-radius: 6px 6px 0 0;
    }

    .column-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 13px;
        color: var(--b3-theme-on-surface);
        overflow: hidden;
    }

    .column-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .collapsed .column-title {
        writing-mode: vertical-rl;
        text-orientation: mixed;
    }

    .task-count {
        background: var(--b3-theme-primary-lighter);
        color: var(--b3-theme-primary);
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 11px;
        font-weight: 600;
        flex-shrink: 0;
    }

    .collapse-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
        font-size: 11px;
        color: var(--b3-theme-on-surface);
        opacity: 0.6;
        transition: opacity 0.2s;
        flex-shrink: 0;
    }

    .collapse-btn:hover {
        opacity: 1;
    }

    .column-content {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        border-radius: 0 0 6px 6px;
    }

    .empty-state {
        text-align: center;
        padding: 24px 12px;
        color: var(--b3-theme-on-surface-light);
        font-size: 12px;
    }

    .column-footer {
        padding: 6px 10px;
        font-size: 11px;
        text-align: center;
        border-top: 1px solid var(--b3-border-color);
        flex-shrink: 0;
    }

    .column-footer.warning {
        background: #fef3c7;
        color: #92400e;
    }
</style>
