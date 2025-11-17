<!--
  笔记本筛选组件 - 下拉多选样式
  已选择的笔记本显示为标签，可快速移除
-->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { Notebook, NotebookFilter } from '../../../types/task';
    import { fetchPost } from 'siyuan';

    export let filter: NotebookFilter = {
        enabled: false,
        mode: 'include',
        notebookIds: []
    };

    const dispatch = createEventDispatcher<{
        change: NotebookFilter;
    }>();

    let notebooks: Notebook[] = [];
    let loading = true;
    let showDropdown = false;
    let searchKeyword = '';
    let containerRef: HTMLDivElement;

    // 加载笔记本列表
    onMount(() => {
        loadNotebooks();

        // 点击外部关闭下拉框
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef && !containerRef.contains(event.target as Node)) {
                showDropdown = false;
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });

    function loadNotebooks() {
        try {
            fetchPost('/api/notebook/lsNotebooks', {}, (response) => {
                if (response && response.code === 0) {
                    notebooks = response.data.notebooks.sort((a, b) => a.sort - b.sort);
                }
                loading = false;
            });
        } catch (error) {
            console.error('Failed to load notebooks:', error);
            loading = false;
        }
    }

    // 筛选后的笔记本列表（未选中的）
    $: filteredNotebooks = notebooks.filter(nb =>
        nb.name.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !filter.notebookIds.includes(nb.id)
    );

    // 已选择的笔记本
    $: selectedNotebooks = notebooks.filter(nb =>
        filter.notebookIds.includes(nb.id)
    );

    // 添加笔记本
    function addNotebook(notebookId: string) {
        if (!filter.notebookIds.includes(notebookId)) {
            filter.notebookIds = [...filter.notebookIds, notebookId];
            filter.enabled = true;
            searchKeyword = '';
            emitChange();
        }
    }

    // 移除笔记本
    function removeNotebook(notebookId: string) {
        filter.notebookIds = filter.notebookIds.filter(id => id !== notebookId);
        if (filter.notebookIds.length === 0) {
            filter.enabled = false;
        }
        emitChange();
    }

    function emitChange() {
        dispatch('change', { ...filter });
    }

    function toggleDropdown() {
        showDropdown = !showDropdown;
        if (showDropdown) {
            searchKeyword = '';
        }
    }
</script>

<div class="notebook-filter" bind:this={containerRef}>
    <!-- 多选输入框 -->
    <div class="select-input" on:click={toggleDropdown}>
        <div class="selected-tags">
            {#if selectedNotebooks.length === 0}
                <span class="placeholder">选择笔记本...</span>
            {:else}
                {#each selectedNotebooks as notebook (notebook.id)}
                    <span class="tag">
                        <span class="tag-icon">{notebook.icon || '📓'}</span>
                        <span class="tag-name">{notebook.name}</span>
                        <button
                            class="tag-remove"
                            on:click|stopPropagation={() => removeNotebook(notebook.id)}
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
        <div class="dropdown-panel">
            <!-- 搜索框 -->
            <div class="search-box">
                <input
                    type="text"
                    placeholder="搜索笔记本..."
                    bind:value={searchKeyword}
                    on:click|stopPropagation
                />
            </div>

            <!-- 笔记本列表 -->
            <div class="notebook-list">
                {#if loading}
                    <div class="loading">加载中...</div>
                {:else if filteredNotebooks.length === 0}
                    <div class="empty">
                        {searchKeyword ? '未找到匹配的笔记本' : selectedNotebooks.length > 0 ? '已选择所有笔记本' : '暂无笔记本'}
                    </div>
                {:else}
                    {#each filteredNotebooks as notebook (notebook.id)}
                        <div
                            class="notebook-item"
                            on:click={() => addNotebook(notebook.id)}
                        >
                            <span class="notebook-icon">{notebook.icon || '📓'}</span>
                            <span class="notebook-name">{notebook.name}</span>
                            {#if notebook.closed}
                                <span class="closed-badge">已关闭</span>
                            {/if}
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .notebook-filter {
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
        background: var(--b3-theme-primary-lighter);
        border-radius: 12px;
        font-size: 11px;
        color: var(--b3-theme-on-surface);
    }

    .tag-icon {
        font-size: 12px;
    }

    .tag-name {
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        max-height: 200px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .search-box {
        padding: 8px;
        border-bottom: 1px solid var(--b3-border-color);
    }

    .search-box input {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        font-size: 12px;
    }

    .search-box input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .notebook-list {
        flex: 1;
        overflow-y: auto;
    }

    .loading,
    .empty {
        padding: 24px;
        text-align: center;
        color: var(--b3-theme-on-surface-light);
        font-size: 12px;
    }

    .notebook-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid var(--b3-border-color);
    }

    .notebook-item:last-child {
        border-bottom: none;
    }

    .notebook-item:hover {
        background: var(--b3-theme-background);
    }

    .notebook-icon {
        font-size: 14px;
        flex-shrink: 0;
    }

    .notebook-name {
        flex: 1;
        font-size: 12px;
        color: var(--b3-theme-on-background);
    }

    .closed-badge {
        font-size: 10px;
        color: var(--b3-theme-on-surface-light);
        background: var(--b3-theme-surface);
        padding: 2px 6px;
        border-radius: 3px;
    }
</style>
