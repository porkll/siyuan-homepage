<!--
  通用多选下拉组件
  输入框只显示已选数量和清空按钮
  下拉框分为两部分：上部显示已选项，下部显示未选项
-->
<script lang="ts">
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { X } from 'lucide-svelte';

    // 泛型支持：items 可以是任意类型
    type T = $$Generic;

    export let items: T[] = [];
    export let selectedIds: string[] = [];
    export let placeholder = '请选择...';
    export let searchable = false;
    export let searchPlaceholder = '搜索...';
    export let emptyText = '暂无选项';
    export let allSelectedText = '已选择所有选项';
    export let noMatchText = '未找到匹配项';

    // 获取器函数
    export let getItemId: (item: T) => string;
    export let getItemLabel: (item: T) => string;
    export let getItemIcon: (item: T) => string = () => '';
    export let getItemColor: (item: T) => string = () => '';

    const dispatch = createEventDispatcher<{
        change: string[];
    }>();

    let showDropdown = false;
    let searchKeyword = '';
    let containerRef: HTMLDivElement;
    let dropdownStyle = { top: '0px', left: '0px', width: '0px' };

    // 已选择的项
    $: selectedItems = items.filter(item => selectedIds.includes(getItemId(item)));

    // 未选择的项（经过搜索过滤）
    $: availableItems = items.filter(item => {
        const id = getItemId(item);
        const label = getItemLabel(item);
        const isNotSelected = !selectedIds.includes(id);
        const matchesSearch = !searchKeyword || label.toLowerCase().includes(searchKeyword.toLowerCase());
        return isNotSelected && matchesSearch;
    });

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

    function toggleDropdown() {
        showDropdown = !showDropdown;
        if (showDropdown) {
            searchKeyword = '';
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

    function addItem(item: T) {
        const id = getItemId(item);
        if (!selectedIds.includes(id)) {
            selectedIds = [...selectedIds, id];
            searchKeyword = '';
            dispatch('change', selectedIds);
        }
    }

    function removeItem(item: T) {
        const id = getItemId(item);
        selectedIds = selectedIds.filter(selectedId => selectedId !== id);
        dispatch('change', selectedIds);
    }

    function clearAll() {
        selectedIds = [];
        dispatch('change', selectedIds);
    }
</script>

<div class="multi-select" bind:this={containerRef}>
    <!-- 输入框 -->
    <div class="select-input" on:click={toggleDropdown}>
        <div class="input-content">
            {#if selectedIds.length === 0}
                <span class="placeholder">{placeholder}</span>
            {:else}
                <span class="selected-count">已选择 {selectedIds.length} 项</span>
            {/if}
        </div>

        <div class="input-actions">
            {#if selectedIds.length > 0}
                <button
                    class="clear-btn"
                    on:click|stopPropagation={clearAll}
                    title="清空"
                >
                    <X size={14} />
                </button>
            {/if}
            <span class="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
        </div>
    </div>

    <!-- 下拉面板 -->
    {#if showDropdown}
        <div class="dropdown-panel" style="top: {dropdownStyle.top}; left: {dropdownStyle.left}; width: {dropdownStyle.width};">
            <!-- 搜索框 -->
            {#if searchable}
                <div class="search-box">
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        bind:value={searchKeyword}
                        on:click|stopPropagation
                    />
                </div>
            {/if}

            <div class="dropdown-content">
                <!-- 已选择的项 -->
                {#if selectedItems.length > 0}
                    <div class="section">
                        <div class="section-header">已选择</div>
                        <div class="item-list">
                            {#each selectedItems as item (getItemId(item))}
                                {@const icon = getItemIcon(item)}
                                {@const color = getItemColor(item)}
                                <div class="item selected-item" on:click={() => removeItem(item)}>
                                    {#if icon}
                                        <span class="item-icon">{icon}</span>
                                    {/if}
                                    <span class="item-label">{getItemLabel(item)}</span>
                                    <button
                                        class="item-remove"
                                        on:click|stopPropagation={() => removeItem(item)}
                                        title="移除"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- 分隔符 -->
                {#if selectedItems.length > 0 && availableItems.length > 0}
                    <div class="divider"></div>
                {/if}

                <!-- 未选择的项 -->
                {#if availableItems.length > 0}
                    <div class="section">
                        {#if selectedItems.length > 0}
                            <div class="section-header">未选择</div>
                        {/if}
                        <div class="item-list">
                            {#each availableItems as item (getItemId(item))}
                                {@const icon = getItemIcon(item)}
                                {@const color = getItemColor(item)}
                                <div
                                    class="item available-item"
                                    style:border-left-color={color || 'transparent'}
                                    on:click={() => addItem(item)}
                                >
                                    {#if icon}
                                        <span class="item-icon">{icon}</span>
                                    {/if}
                                    <span class="item-label">{getItemLabel(item)}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {:else if selectedItems.length === 0}
                    <div class="empty">{emptyText}</div>
                {:else if searchKeyword}
                    <div class="empty">{noMatchText}</div>
                {:else}
                    <div class="empty">{allSelectedText}</div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .multi-select {
        position: relative;
        width: 100%;
        box-sizing: border-box;
    }

    /* 输入框 */
    .select-input {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 28px;
        min-width: 150px;
        padding: 4px 8px;
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

    .input-content {
        flex: 1;
        display: flex;
        align-items: center;
    }

    .placeholder {
        color: var(--b3-theme-on-surface-light);
        font-size: 12px;
    }

    .selected-count {
        color: var(--b3-theme-on-surface);
        font-size: 12px;
        font-weight: 500;
    }

    .input-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .clear-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        border: none;
        background: none;
        color: var(--b3-theme-on-surface-light);
        cursor: pointer;
        border-radius: 3px;
        transition: all 0.2s;
    }

    .clear-btn:hover {
        background: var(--b3-theme-error-lighter);
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
        max-height: 300px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .search-box {
        padding: 8px;
        border-bottom: 1px solid var(--b3-border-color);
        flex-shrink: 0;
    }

    .search-box input {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        font-size: 12px;
        box-sizing: border-box;
    }

    .search-box input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .dropdown-content {
        flex: 1;
        overflow-y: auto;
    }

    .section {
        padding: 4px 0;
    }

    .section-header {
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 600;
        color: var(--b3-theme-on-surface-light);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .item-list {
        display: flex;
        flex-direction: column;
    }

    .divider {
        height: 1px;
        background: var(--b3-border-color);
        margin: 4px 0;
    }

    .empty {
        padding: 24px;
        text-align: center;
        color: var(--b3-theme-on-surface-light);
        font-size: 12px;
    }

    .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .item:hover {
        background: var(--b3-theme-background);
    }

    .selected-item {
        background: var(--b3-theme-primary-lightest);
    }

    .selected-item:hover {
        background: var(--b3-theme-primary-lighter);
    }

    .available-item {
        border-left: 3px solid transparent;
    }

    .item-icon {
        font-size: 14px;
        flex-shrink: 0;
    }

    .item-label {
        flex: 1;
        font-size: 12px;
        color: var(--b3-theme-on-background);
    }

    .item-remove {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        border: none;
        background: none;
        color: var(--b3-theme-on-surface-light);
        cursor: pointer;
        border-radius: 3px;
        transition: all 0.2s;
        opacity: 0.6;
    }

    .item-remove:hover {
        background: var(--b3-theme-error-lighter);
        color: var(--b3-theme-error);
        opacity: 1;
    }
</style>
