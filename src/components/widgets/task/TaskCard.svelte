<!--
  任务卡片组件
  可拖拽的任务卡片，包含任务信息和操作按钮
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task, TaskStatus } from '../../../types/task';
    import TaskCardActions from './TaskCardActions.svelte';
    import { Calendar, FileText } from 'lucide-svelte';

    export let task: Task;
    export let columnId: string;

    const dispatch = createEventDispatcher<{
        taskClick: Task;
        dragStart: { task: Task; columnId: string };
        dueDateChange: { task: Task; dueDate: Date | null };
        priorityChange: { task: Task; priority: string | null };
        statusChange: { task: Task; status: TaskStatus };
        excludeFromManagement: { task: Task };
    }>();

    let dropdownOpen = false;

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

    function handleTaskClick() {
        dispatch('taskClick', task);
    }

    function handleDragStart() {
        dispatch('dragStart', { task, columnId });
    }

    function handleDueDateChange(event: CustomEvent) {
        dispatch('dueDateChange', { task, dueDate: event.detail });
    }

    function handlePriorityChange(event: CustomEvent) {
        dispatch('priorityChange', { task, priority: event.detail });
    }

    function handleStatusChange(event: CustomEvent<TaskStatus>) {
        dispatch('statusChange', { task, status: event.detail });
    }

    function handleExcludeFromManagement() {
        dispatch('excludeFromManagement', { task });
    }
</script>

<div
    class="task-card"
    class:overdue={isOverdue(task)}
    class:dropdown-open={dropdownOpen}
    draggable="true"
    on:dragstart={handleDragStart}
    on:click={handleTaskClick}
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
                <Calendar size={12} />
                {formatDate(task.dueDate)}
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

    <!-- 进度条 -->
    {#if task.progress !== undefined && task.progress > 0}
        <div class="progress-bar">
            <div
                class="progress-fill"
                style:width="{task.progress}%"
            />
        </div>
    {/if}

    <!-- 文档信息和操作按钮（同一行） -->
    <div class="task-footer">
        <span class="doc-name" title={task.docPath}>
            <FileText size={11} />
            {task.docName}
        </span>

        <!-- 操作按钮 -->
        <TaskCardActions
            {task}
            bind:dropdownOpen
            on:dueDateChange={handleDueDateChange}
            on:priorityChange={handlePriorityChange}
            on:statusChange={handleStatusChange}
            on:excludeFromManagement={handleExcludeFromManagement}
        />
    </div>
</div>

<style>
    .task-card {
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 5px;
        padding: 6px 8px 8px 8px;
        cursor: pointer;
        transition: all 0.15s;
        position: relative;
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
    }

    .task-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
    }

    .task-card.overdue {
        border-left: 2px solid #ef4444;
    }

    .task-card.dropdown-open {
        z-index: 1000;
    }

    .priority-indicator {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        border-radius: 5px 5px 0 0;
    }

    .task-content {
        margin: 0 0 6px 0;
        color: var(--b3-theme-on-background);
        font-size: 13px;
        line-height: 1.35;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        max-height: 2.7em;
        min-width: 0;
    }

    .task-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 4px;
        align-items: center;
        min-width: 0;
    }

    .due-date {
        font-size: 11px;
        color: var(--b3-theme-on-surface-light);
        display: flex;
        align-items: center;
        gap: 3px;
        white-space: nowrap;
    }

    .due-date.overdue {
        color: #ef4444;
        font-weight: 600;
    }

    .tags {
        display: flex;
        gap: 3px;
        flex-wrap: wrap;
        min-width: 0;
    }

    .tag {
        background: var(--b3-theme-primary-lightest);
        color: var(--b3-theme-primary);
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 10px;
        white-space: nowrap;
    }

    .progress-bar {
        height: 3px;
        background: var(--b3-theme-surface);
        border-radius: 1.5px;
        overflow: hidden;
        margin-top: 6px;
    }

    .progress-fill {
        height: 100%;
        background: var(--b3-theme-primary);
        transition: width 0.3s;
    }

    .task-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        border-top: 1px solid var(--b3-border-color);
        padding-top: 4px;
        margin-top: 4px;
        min-width: 0;
    }

    .doc-name {
        font-size: 10px;
        color: var(--b3-theme-on-surface-light);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1 1 0;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 3px;
    }

    /* 默认隐藏操作按钮 */
    .task-card :global(.task-actions) {
        opacity: 0;
        transition: opacity 0.2s;
        flex-shrink: 0;
    }

    /* 悬浮时显示操作按钮 */
    .task-card:hover :global(.task-actions) {
        opacity: 1;
    }
</style>
