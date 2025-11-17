<!--
  任务卡片操作按钮
  包含设置截止时间、设置优先级、归档三个按钮
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task, TaskPriority } from '../../../types/task';
    import { onMount } from 'svelte';
    import { Calendar, Tag, Archive } from 'lucide-svelte';

    export let task: Task;
    export let dropdownOpen = false;

    const dispatch = createEventDispatcher<{
        dueDateChange: Date | null;
        priorityChange: string | null;
        archive: void;
    }>();

    let showDatePicker = false;
    let showPrioritySelector = false;

    // 更新 dropdownOpen 状态
    $: dropdownOpen = showDatePicker || showPrioritySelector;

    // 优先级选项
    const priorityOptions: { value: TaskPriority | null; label: string; color: string }[] = [
        { value: null, label: '无优先级', color: '#94a3b8' },
        { value: 'low', label: '低', color: '#6b7280' },
        { value: 'medium', label: '中', color: '#eab308' },
        { value: 'high', label: '高', color: '#f97316' },
        { value: 'urgent', label: '紧急', color: '#ef4444' }
    ];

    // 快捷日期选项
    const quickDateOptions = [
        { label: '今天', getValue: () => new Date() },
        { label: '明天', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; } },
        { label: '3天后', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 3); return d; } },
        { label: '一周后', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
        { label: '清除', getValue: () => null }
    ];

    let customDate = '';

    function toggleDatePicker(event: MouseEvent) {
        event.stopPropagation();
        showPrioritySelector = false;
        showDatePicker = !showDatePicker;

        if (showDatePicker) {
            // 初始化自定义日期输入
            if (task.dueDate) {
                customDate = formatDateForInput(task.dueDate);
            } else {
                customDate = '';
            }
        }
    }

    function togglePrioritySelector(event: MouseEvent) {
        event.stopPropagation();
        showDatePicker = false;
        showPrioritySelector = !showPrioritySelector;
    }

    function selectQuickDate(option: typeof quickDateOptions[0]) {
        const date = option.getValue();
        dispatch('dueDateChange', date);
        showDatePicker = false;
    }

    function selectCustomDate() {
        if (!customDate) {
            dispatch('dueDateChange', null);
        } else {
            const date = new Date(customDate);
            if (!isNaN(date.getTime())) {
                dispatch('dueDateChange', date);
            }
        }
        showDatePicker = false;
    }

    function selectPriority(priority: TaskPriority | null) {
        dispatch('priorityChange', priority);
        showPrioritySelector = false;
    }

    function handleArchive(event: MouseEvent) {
        event.stopPropagation();
        dispatch('archive');
    }

    function formatDateForInput(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 点击外部关闭弹出层
    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.task-actions') && !target.closest('.date-picker') && !target.closest('.priority-selector')) {
            showDatePicker = false;
            showPrioritySelector = false;
        }
    }

    onMount(() => {
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    });
</script>

<div class="task-actions" on:click={(e) => e.stopPropagation()}>
    <!-- 设置截止时间按钮 -->
    <div class="action-wrapper">
        <button
            class="action-btn"
            class:active={task.dueDate}
            on:click={toggleDatePicker}
            title="设置截止时间"
        >
            <Calendar size={14} />
        </button>

        {#if showDatePicker}
            <div class="date-picker">
                <div class="picker-header">设置截止时间</div>
                <div class="quick-dates">
                    {#each quickDateOptions as option}
                        <button
                            class="quick-date-btn"
                            class:clear={option.label === '清除'}
                            on:click={() => selectQuickDate(option)}
                        >
                            {option.label}
                        </button>
                    {/each}
                </div>
                <div class="custom-date">
                    <input
                        type="date"
                        bind:value={customDate}
                        on:change={selectCustomDate}
                        class="date-input"
                    />
                </div>
            </div>
        {/if}
    </div>

    <!-- 设置优先级按钮 -->
    <div class="action-wrapper">
        <button
            class="action-btn"
            class:active={task.priority}
            on:click={togglePrioritySelector}
            title="设置优先级"
        >
            <Tag size={14} />
        </button>

        {#if showPrioritySelector}
            <div class="priority-selector">
                <div class="picker-header">设置优先级</div>
                <div class="priority-options">
                    {#each priorityOptions as option}
                        <button
                            class="priority-option"
                            class:active={task.priority === option.value}
                            on:click={() => selectPriority(option.value)}
                        >
                            <span class="priority-dot" style:background-color={option.color}></span>
                            <span class="priority-label">{option.label}</span>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <!-- 归档按钮 -->
    <button
        class="action-btn archive-btn"
        on:click={handleArchive}
        title="归档任务"
    >
        <Archive size={14} />
    </button>
</div>

<style>
    .task-actions {
        display: flex;
        gap: 3px;
        justify-content: flex-end;
        flex-shrink: 0;
    }

    .action-wrapper {
        position: relative;
    }

    .action-btn {
        padding: 2px 6px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        cursor: pointer;
        border-radius: 3px;
        font-size: 12px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
    }

    .action-btn:hover {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary);
    }

    .action-btn.active {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary);
    }

    .archive-btn:hover {
        background: #fee2e2;
        border-color: #ef4444;
    }

    /* 日期选择器 */
    .date-picker,
    .priority-selector {
        position: absolute;
        right: 0;
        top: 100%;
        margin-top: 4px;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        width: 160px;
        padding: 8px;
    }

    .picker-header {
        font-size: 12px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--b3-border-color);
    }

    .quick-dates {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
    }

    .quick-date-btn {
        padding: 6px 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        text-align: left;
        transition: all 0.2s;
    }

    .quick-date-btn:hover {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary);
    }

    .quick-date-btn.clear {
        color: #ef4444;
    }

    .quick-date-btn.clear:hover {
        background: #fee2e2;
        border-color: #ef4444;
    }

    .custom-date {
        padding-top: 8px;
        border-top: 1px solid var(--b3-border-color);
    }

    .date-input {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        border-radius: 4px;
        font-size: 12px;
        color: var(--b3-theme-on-background);
    }

    .date-input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    /* 优先级选择器 */
    .priority-options {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .priority-option {
        padding: 6px 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        text-align: left;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .priority-option:hover {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary);
    }

    .priority-option.active {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary);
        font-weight: 600;
    }

    .priority-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .priority-label {
        flex: 1;
    }
</style>
