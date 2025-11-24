<!--
  笔记本筛选组件 - 使用通用 MultiSelect 组件
-->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { Notebook, NotebookFilter } from '../../../types/task';
    import { fetchPost } from 'siyuan';
    import MultiSelect from './MultiSelect.svelte';

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

    function handleChange(event: CustomEvent<string[]>) {
        filter.notebookIds = event.detail;
        filter.enabled = filter.notebookIds.length > 0;
        dispatch('change', { ...filter });
    }
</script>

<div class="notebook-filter">
    {#if loading}
        <div class="loading-placeholder">加载笔记本...</div>
    {:else}
        <MultiSelect
            items={notebooks}
            selectedIds={filter.notebookIds}
            placeholder="选择笔记本..."
            searchable={true}
            searchPlaceholder="搜索笔记本..."
            emptyText="暂无笔记本"
            allSelectedText="已选择所有笔记本"
            noMatchText="未找到匹配的笔记本"
            getItemId={(item) => item.id}
            getItemLabel={(item) => item.name}
            getItemIcon={(item) => item.icon || '📓'}
            on:change={handleChange}
        />
    {/if}
</div>

<style>
    .notebook-filter {
        width: 100%;
    }

    .loading-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 28px;
        padding: 4px 8px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface-light);
        font-size: 12px;
    }
</style>
