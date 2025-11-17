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
