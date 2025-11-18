<!--
  优先级筛选组件 - 多选样式
  已选择的优先级显示为标签，可快速移除
-->
<script lang="ts">
    import { createEventDispatcher, onDestroy } from 'svelte';
    import type { TaskPriority } from '../../../types/task';

    export let selectedPriorities: TaskPriority[] = [];

    const dispatch = createEventDispatcher<{
        change: TaskPriority[];
    }>();

    // 优先级选项
    const priorities: { value: TaskPriority; label: string; icon: string; color: string }[] = [
        { value: 'urgent', label: '紧急', icon: '🔴', color: '#ef4444' },
        { value: 'high', label: '高', icon: '🟠', color: '#f97316' },
        { value: 'medium', label: '中', icon: '🟡', color: '#eab308' },
        { value: 'low', label: '低', icon: '🟢', color: '#22c55e' }
    ];

    let showDropdown = false;
    let containerRef: HTMLDivElement;
    let dropdownStyle = { top: '0px', left: '0px', width: '0px' };

    // 点击外部关闭下拉框
    function handleClickOutside(event: MouseEvent) {
        if (containerRef && !containerRef.contains(event.target as Node)) {
            showDropdown = false;
        }
    }

    // 监听showDropdown变化，管理事件监听器
    $: {
        if (typeof window !== 'undefined') {
            if (showDropdown) {
                // 使用微任务延迟添加监听器，避免立即触发
                Promise.resolve().then(() => {
                    document.addEventListener('click', handleClickOutside);
                });
            } else {
                document.removeEventListener('click', handleClickOutside);
            }
        }
    }

    // 组件销毁时清理监听器
    onDestroy(() => {
        if (typeof window !== 'undefined') {
            document.removeEventListener('click', handleClickOutside);
        }
    });

    // 获取未选中的优先级
    $: availablePriorities = priorities.filter(p => !selectedPriorities.includes(p.value));

    // 获取已选择的优先级详情
    $: selectedPrioritiesData = selectedPriorities.map(value =>
        priorities.find(p => p.value === value)!
    ).filter(Boolean);

    function addPriority(priority: TaskPriority) {
        if (!selectedPriorities.includes(priority)) {
            selectedPriorities = [...selectedPriorities, priority];
            dispatch('change', selectedPriorities);
        }
    }

    function removePriority(priority: TaskPriority) {
        selectedPriorities = selectedPriorities.filter(p => p !== priority);
        dispatch('change', selectedPriorities);
    }

    function toggleDropdown() {
        showDropdown = !showDropdown;
        if (showDropdown) {
            // 计算下拉框位置
            if (containerRef) {
                const rect = containerRef.getBoundingClientRect();
                dropdownStyle = {
                    top: `${rect.bottom + 4}px`,
                    left: `${rect.left}px`,
                    width: `${rect.width}px`
                };
            }
        }
    }
</script>

<div class="priority-filter" bind:this={containerRef}>
    <!-- 多选输入框 -->
    <div class="select-input" on:click={toggleDropdown}>
        <div class="selected-tags">
            {#if selectedPrioritiesData.length === 0}
                <span class="placeholder">优先级...</span>
            {:else}
                {#each selectedPrioritiesData as priority (priority.value)}
                    <span class="tag" style="background-color: {priority.color}20; border-color: {priority.color};">
                        <span class="tag-icon">{priority.icon}</span>
                        <span class="tag-name">{priority.label}</span>
                        <button
                            class="tag-remove"
                            on:click|stopPropagation={() => removePriority(priority.value)}
                            title="移除"
                        >
                            ×
                        </button>
                    </span>
                {/each}
            {/if}
        </div>
        <span class="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
    </div>

    <!-- 下拉列表 -->
    {#if showDropdown}
        <div class="dropdown-panel" style="top: {dropdownStyle.top}; left: {dropdownStyle.left}; width: {dropdownStyle.width};">
            <div class="priority-list">
                {#if availablePriorities.length === 0}
                    <div class="empty">所有优先级已添加</div>
                {:else}
                    {#each availablePriorities as priority (priority.value)}
                        <div
                            class="priority-item"
                            on:click={() => addPriority(priority.value)}
                        >
                            <span class="priority-icon">{priority.icon}</span>
                            <span class="priority-label">{priority.label}</span>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .priority-filter {
        position: relative;
        width: 100%;
        box-sizing: border-box;
    }

    /* 多选输入框 */
    .select-input {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 28px;
        padding: 2px 8px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        cursor: pointer;
        transition: border-color 0.2s;
        box-sizing: border-box;
    }

    .select-input:hover {
        border-color: var(--b3-theme-primary);
    }

    .selected-tags {
        flex: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
    }

    .placeholder {
        color: var(--b3-theme-on-surface-light);
        font-size: 12px;
    }

    /* 标签样式 */
    .tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border-radius: 12px;
        border: 1px solid;
        font-size: 11px;
        color: var(--b3-theme-on-surface);
    }

    .tag-icon {
        font-size: 12px;
    }

    .tag-name {
        font-weight: 500;
    }

    .tag-remove {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        padding: 0;
        border: none;
        background: none;
        color: var(--b3-theme-on-surface);
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        border-radius: 50%;
        transition: all 0.2s;
    }

    .tag-remove:hover {
        background: rgba(0, 0, 0, 0.1);
        color: var(--b3-theme-error);
    }

    .dropdown-arrow {
        color: var(--b3-theme-on-surface-light);
        font-size: 10px;
        user-select: none;
    }

    /* 下拉面板 */
    .dropdown-panel {
        position: fixed;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        overflow: hidden;
    }

    .priority-list {
        max-height: 200px;
        overflow-y: auto;
    }

    .empty {
        padding: 16px;
        text-align: center;
        color: var(--b3-theme-on-surface-light);
        font-size: 12px;
    }

    .priority-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid var(--b3-border-color);
    }

    .priority-item:last-child {
        border-bottom: none;
    }

    .priority-item:hover {
        background: var(--b3-theme-background);
    }

    .priority-icon {
        font-size: 14px;
        flex-shrink: 0;
    }

    .priority-label {
        flex: 1;
        font-size: 12px;
        color: var(--b3-theme-on-background);
    }
</style>
