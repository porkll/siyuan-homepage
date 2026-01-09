<!--
  文件卡片列表组件
  提供紧凑的文件选择界面，支持钉选、跳转和选择文件
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Pin, ExternalLink } from 'lucide-svelte';
    import type { FileCard } from '../../../types/quick-note';
    import { createDailyNote } from '../../../api';

    const dispatch = createEventDispatcher();

    export let cards: FileCard[] = [];
    export let selectedId: string = 'daily';
    export let notebookId: string = ''; // 日记笔记本 ID，用于获取今日日记

    /**
     * 处理选择文件
     */
    function handleSelect(card: FileCard) {
        if (selectedId === card.id) {
            // 点击已选中的卡片，回到默认日记
            dispatch('select', { fileId: 'daily' });
        } else {
            // 选中新卡片
            dispatch('select', { fileId: card.id });
        }
    }

    /**
     * 处理钉选/取消钉选
     */
    function handlePin(card: FileCard, event: Event) {
        event.stopPropagation();
        dispatch('pin', { fileId: card.id, isPinned: !card.isPinned });
    }

    /**
     * 处理跳转到文档
     */
    async function handleNavigate(card: FileCard, event: Event) {
        event.stopPropagation();

        if (card.isDaily) {
            // 日记卡片：获取今日日记并跳转
            try {
                const dailyNote = await createDailyNote(notebookId);
                window.open(`siyuan://blocks/${dailyNote.id}`, '_self');
            } catch (error) {
                console.error('跳转到今日日记失败:', error);
            }
        } else {
            // 普通文档：直接跳转
            window.open(`siyuan://blocks/${card.id}`, '_self');
        }
    }
</script>

<div class="file-card-list">
    <div class="cards-container">
        {#each cards as card (card.id)}
            <div
                class="file-card"
                class:selected={selectedId === card.id}
                class:daily={card.isDaily}
                on:click={() => handleSelect(card)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && handleSelect(card)}
                title={card.name}
            >
                <span class="card-name">{card.name}</span>

                {#if selectedId === card.id}
                    <span class="check-mark">✓</span>
                {/if}

                <!-- 跳转按钮：所有卡片都显示 -->
                <button
                    class="navigate-btn"
                    class:navigate-only={card.isDaily}
                    on:click={(e) => handleNavigate(card, e)}
                    title={card.isDaily ? '跳转到今日日记' : '跳转到文档'}
                >
                    <ExternalLink size={10} />
                </button>

                <!-- 钉选按钮：仅非日记卡片显示 -->
                {#if !card.isDaily}
                    <button
                        class="pin-btn"
                        class:pinned={card.isPinned}
                        on:click={(e) => handlePin(card, e)}
                        title={card.isPinned ? '取消钉选' : '钉选'}
                    >
                        <Pin size={10} fill={card.isPinned ? 'currentColor' : 'none'} />
                    </button>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    /* 压缩的一行卡片列表 */
    .file-card-list {
        padding: 3px 6px;
        border-bottom: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
    }

    .cards-container {
        display: flex;
        gap: 3px;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
        scrollbar-color: var(--b3-scroll-color) transparent;
    }

    /* 隐藏滚动条但保持可滚动 */
    .cards-container::-webkit-scrollbar {
        height: 3px;
    }

    .cards-container::-webkit-scrollbar-thumb {
        background: var(--b3-scroll-color);
        border-radius: 2px;
    }

    /* 紧凑型卡片 */
    .file-card {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 2px 6px;
        height: 22px;
        border: 1px solid var(--b3-border-color);
        border-radius: 3px;
        background: var(--b3-theme-surface);
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .file-card:hover {
        border-color: var(--b3-theme-primary-lighter);
        background: var(--b3-theme-background-light);
    }

    .file-card.selected {
        border-color: var(--b3-theme-primary);
        background: var(--b3-theme-primary-lightest);
    }

    .file-card.daily {
        font-weight: 500;
    }

    /* 文字 */
    .card-name {
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--b3-theme-on-surface);
        flex: 1;
        min-width: 0;
    }

    .check-mark {
        font-size: 10px;
        color: var(--b3-theme-primary);
        margin-left: 1px;
    }

    /* 紧凑型按钮 */
    .pin-btn,
    .navigate-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-border-color);
        border-radius: 2px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        transition: all 0.15s;
        padding: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .pin-btn {
        right: 2px;
        color: var(--b3-theme-on-surface);
    }

    .pin-btn.pinned {
        opacity: 1;
        color: var(--b3-theme-primary);
        background: var(--b3-theme-primary-lightest);
        border-color: var(--b3-theme-primary);
    }

    .navigate-btn {
        right: 20px;
        color: var(--b3-theme-primary);
        background: var(--b3-theme-surface);
    }

    /* 日记卡片只有跳转按钮，位置调整到最右边 */
    .navigate-btn.navigate-only {
        right: 2px;
    }

    .file-card:hover .pin-btn,
    .file-card:hover .navigate-btn {
        opacity: 1;
    }

    .file-card:hover .pin-btn:hover {
        background: var(--b3-theme-primary-lightest);
        border-color: var(--b3-theme-primary);
    }

    .file-card:hover .navigate-btn:hover {
        background: var(--b3-theme-primary-lightest);
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
    }

    /* 移动端适配 */
    @media (max-width: 768px) {
        .file-card-list {
            padding: 2px 4px;
        }

        .file-card {
            height: 20px;
            padding: 2px 4px;
        }

        .card-name {
            font-size: 10px;
        }

        .check-mark {
            font-size: 9px;
        }

        .pin-btn,
        .navigate-btn {
            width: 14px;
            height: 14px;
        }
    }
</style>
