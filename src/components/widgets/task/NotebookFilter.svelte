<!--
  笔记本筛选组件
  支持选择/排除笔记本进行任务筛选
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
    let showPanel = false;
    let searchKeyword = '';

    // 加载笔记本列表
    onMount(() => {
        loadNotebooks();
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

    // 筛选后的笔记本列表
    $: filteredNotebooks = notebooks.filter(nb =>
        nb.name.toLowerCase().includes(searchKeyword.toLowerCase())
    );

    // 切换笔记本选中状态
    function toggleNotebook(notebookId: string) {
        const index = filter.notebookIds.indexOf(notebookId);
        if (index > -1) {
            filter.notebookIds = filter.notebookIds.filter(id => id !== notebookId);
        } else {
            filter.notebookIds = [...filter.notebookIds, notebookId];
        }
        emitChange();
    }

    // 全选
    function selectAll() {
        filter.notebookIds = notebooks.map(nb => nb.id);
        emitChange();
    }

    // 清空选择
    function clearAll() {
        filter.notebookIds = [];
        emitChange();
    }

    // 切换模式
    function toggleMode() {
        filter.mode = filter.mode === 'include' ? 'exclude' : 'include';
        emitChange();
    }

    // 切换启用状态
    function toggleEnabled() {
        filter.enabled = !filter.enabled;
        emitChange();
    }

    function emitChange() {
        dispatch('change', { ...filter });
    }

    // 获取选中数量
    $: selectedCount = filter.notebookIds.length;
    $: isAllSelected = selectedCount === notebooks.length && notebooks.length > 0;
</script>

<div class="notebook-filter">
    <!-- 筛选器摘要 -->
    <div class="filter-summary">
        <button
            class="toggle-btn"
            class:active={filter.enabled}
            on:click={toggleEnabled}
            title={filter.enabled ? '停用筛选' : '启用筛选'}
        >
            <span class="icon">{filter.enabled ? '🔍' : '⭕'}</span>
            <span class="text">笔记本筛选</span>
            {#if filter.enabled && selectedCount > 0}
                <span class="badge">
                    {filter.mode === 'include' ? '包含' : '排除'} {selectedCount}
                </span>
            {/if}
        </button>

        <button
            class="expand-btn"
            on:click={() => showPanel = !showPanel}
            title={showPanel ? '收起' : '展开'}
        >
            {showPanel ? '▲' : '▼'}
        </button>
    </div>

    <!-- 筛选面板 -->
    {#if showPanel}
        <div class="filter-panel">
            <!-- 工具栏 -->
            <div class="toolbar">
                <div class="mode-switch">
                    <button
                        class="mode-btn"
                        class:active={filter.mode === 'include'}
                        on:click={() => { filter.mode = 'include'; emitChange(); }}
                    >
                        包含模式
                    </button>
                    <button
                        class="mode-btn"
                        class:active={filter.mode === 'exclude'}
                        on:click={() => { filter.mode = 'exclude'; emitChange(); }}
                    >
                        排除模式
                    </button>
                </div>

                <div class="actions">
                    <button class="action-btn" on:click={selectAll}>
                        全选
                    </button>
                    <button class="action-btn" on:click={clearAll}>
                        清空
                    </button>
                </div>
            </div>

            <!-- 搜索框 -->
            <div class="search-box">
                <input
                    type="text"
                    placeholder="搜索笔记本..."
                    bind:value={searchKeyword}
                />
            </div>

            <!-- 笔记本列表 -->
            <div class="notebook-list">
                {#if loading}
                    <div class="loading">加载中...</div>
                {:else if filteredNotebooks.length === 0}
                    <div class="empty">
                        {searchKeyword ? '未找到匹配的笔记本' : '暂无笔记本'}
                    </div>
                {:else}
                    {#each filteredNotebooks as notebook (notebook.id)}
                        <label class="notebook-item">
                            <input
                                type="checkbox"
                                checked={filter.notebookIds.includes(notebook.id)}
                                on:change={() => toggleNotebook(notebook.id)}
                            />
                            <span class="notebook-icon">{notebook.icon || '📓'}</span>
                            <span class="notebook-name">{notebook.name}</span>
                            {#if notebook.closed}
                                <span class="closed-badge">已关闭</span>
                            {/if}
                        </label>
                    {/each}
                {/if}
            </div>

            <!-- 底部提示 -->
            <div class="footer">
                {#if filter.mode === 'include'}
                    <span>将只显示选中笔记本中的任务</span>
                {:else}
                    <span>将排除选中笔记本中的任务</span>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .notebook-filter {
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        overflow: hidden;
        background: var(--b3-theme-surface);
    }

    .filter-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--b3-theme-background);
    }

    .toggle-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--b3-theme-on-surface);
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
    }

    .toggle-btn:hover {
        background: var(--b3-theme-surface);
    }

    .toggle-btn.active {
        color: var(--b3-theme-primary);
        font-weight: 600;
    }

    .badge {
        background: var(--b3-theme-primary-lighter);
        color: var(--b3-theme-primary);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
    }

    .expand-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        color: var(--b3-theme-on-surface);
        opacity: 0.6;
        transition: opacity 0.2s;
    }

    .expand-btn:hover {
        opacity: 1;
    }

    .filter-panel {
        border-top: 1px solid var(--b3-border-color);
        padding: 12px;
    }

    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .mode-switch {
        display: flex;
        gap: 4px;
        background: var(--b3-theme-background);
        border-radius: 6px;
        padding: 4px;
    }

    .mode-btn {
        padding: 6px 12px;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        color: var(--b3-theme-on-surface);
        transition: all 0.2s;
    }

    .mode-btn.active {
        background: var(--b3-theme-primary);
        color: white;
    }

    .actions {
        display: flex;
        gap: 8px;
    }

    .action-btn {
        padding: 6px 12px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        color: var(--b3-theme-on-surface);
        transition: all 0.2s;
    }

    .action-btn:hover {
        background: var(--b3-theme-surface);
    }

    .search-box {
        margin-bottom: 12px;
    }

    .search-box input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        font-size: 13px;
    }

    .search-box input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .notebook-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
    }

    .loading,
    .empty {
        padding: 32px;
        text-align: center;
        color: var(--b3-theme-on-surface-light);
        font-size: 14px;
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
        background: var(--b3-theme-surface);
    }

    .notebook-item input[type="checkbox"] {
        cursor: pointer;
    }

    .notebook-icon {
        font-size: 16px;
    }

    .notebook-name {
        flex: 1;
        font-size: 13px;
        color: var(--b3-theme-on-background);
    }

    .closed-badge {
        font-size: 11px;
        color: var(--b3-theme-on-surface-light);
        background: var(--b3-theme-surface);
        padding: 2px 6px;
        border-radius: 3px;
    }

    .footer {
        margin-top: 12px;
        padding: 8px;
        background: var(--b3-theme-primary-lightest);
        border-radius: 4px;
        font-size: 12px;
        color: var(--b3-theme-on-surface-light);
        text-align: center;
    }
</style>
