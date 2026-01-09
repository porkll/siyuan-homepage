<!--
  快速笔记 Widget
  提供简洁的笔记输入界面，支持快速添加笔记到今日日记
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { showMessage } from 'siyuan';
    import { Settings, Send, RefreshCw } from 'lucide-svelte';
    import type { QuickNoteConfig, FileCard } from '../../types/quick-note';
    import { deepMerge } from '../../libs/utils';
    import {
        DEFAULT_QUICK_NOTE_CONFIG,
        buildFileCardList,
        addQuickNoteToFile
    } from '../../libs/quick-note-utils';
    import QuickNoteSettings from './quick-note/QuickNoteSettings.svelte';
    import FileCardList from './quick-note/FileCardList.svelte';

    export let plugin; // 插件实例，用于保存配置
    export let widgetId: string = ''; // 组件实例 ID

    // 使用组件 ID 作为 storage key，确保每个实例独立存储
    $: STORAGE_KEY = widgetId ? `quick-note-widget-config-${widgetId}` : 'quick-note-widget-config';

    // 配置
    let config: QuickNoteConfig = { ...DEFAULT_QUICK_NOTE_CONFIG };

    // UI 状态
    let noteContent = '';
    let isSending = false;
    let showSettings = false;
    let fileCards: FileCard[] = [];
    let isRefreshing = false;

    onMount(() => {
        loadConfig();
    });

    /**
     * 加载配置
     */
    async function loadConfig() {
        try {
            const savedConfig = await plugin.loadData(STORAGE_KEY);
            if (savedConfig) {
                config = deepMerge(DEFAULT_QUICK_NOTE_CONFIG, savedConfig);
                console.log('[QuickNoteWidget] 配置加载成功:', config);
            }
            // 加载文件卡片列表
            await loadFileCards();
        } catch (error) {
            console.error('[QuickNoteWidget] 加载配置失败:', error);
        }
    }

    /**
     * 加载文件卡片列表
     */
    async function loadFileCards() {
        try {
            fileCards = await buildFileCardList(config);
            console.log('[QuickNoteWidget] 文件卡片加载成功:', fileCards);

            // 清理已删除文档的钉选
            if (config.pinnedFileIds.length > 0) {
                const validPinnedIds = fileCards
                    .filter(card => card.isPinned && !card.isDaily)
                    .map(card => card.id);

                if (validPinnedIds.length !== config.pinnedFileIds.length) {
                    console.log('[QuickNoteWidget] 清理已删除的钉选文档');
                    config.pinnedFileIds = validPinnedIds;
                    await saveConfig();
                }
            }
        } catch (error) {
            console.error('[QuickNoteWidget] 加载文件卡片失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async function saveConfig() {
        try {
            await plugin.saveData(STORAGE_KEY, config);
            console.log('[QuickNoteWidget] 配置保存成功:', config);
        } catch (error) {
            console.error('[QuickNoteWidget] 保存配置失败:', error);
        }
    }

    /**
     * 处理发送笔记
     */
    async function handleSend() {
        const content = noteContent.trim();

        // 验证输入
        if (!content) {
            showMessage('请输入笔记内容', 3000, 'info');
            return;
        }

        // 验证笔记本设置
        if (!config.notebookId) {
            showMessage('请先在设置中选择日记笔记本', 3000, 'error');
            openSettings();
            return;
        }

        isSending = true;

        try {
            // 添加笔记到选中的文件
            await addQuickNoteToFile(config.selectedFileId, content, config);

            // 清空输入框并显示成功消息
            noteContent = '';
            showMessage('笔记已添加', 2000, 'info');

            // 更新文件卡片列表
            await loadFileCards();
        } catch (error) {
            console.error('[QuickNoteWidget] 添加笔记失败:', error);
            showMessage('添加笔记失败: ' + error.message, 3000, 'error');
        } finally {
            isSending = false;
        }
    }

    /**
     * 处理键盘事件
     */
    function handleKeydown(e: KeyboardEvent) {
        // 回车发送（根据设置）
        if (e.key === 'Enter' && config.enableEnterToSend) {
            if (!e.shiftKey) {
                // Enter 发送
                e.preventDefault();
                handleSend();
            }
            // Shift+Enter 换行（默认行为）
        }
    }

    /**
     * 打开设置对话框
     */
    function openSettings() {
        showSettings = true;
    }

    /**
     * 关闭设置对话框
     */
    function closeSettings() {
        showSettings = false;
    }

    /**
     * 保存设置
     */
    async function handleSaveSettings(event: CustomEvent) {
        const { notebookId, enableEnterToSend, headingName } = event.detail;

        config.notebookId = notebookId;
        config.enableEnterToSend = enableEnterToSend;
        config.headingName = headingName;

        await saveConfig();
        showMessage('设置已保存', 2000, 'info');

        // 如果笔记本更改了，重新加载文件卡片
        await loadFileCards();
    }

    /**
     * 处理文件选择
     */
    async function handleFileSelect(event: CustomEvent) {
        config.selectedFileId = event.detail.fileId;
        await saveConfig();
    }

    /**
     * 处理文件钉选/取消钉选
     */
    async function handleFilePin(event: CustomEvent) {
        const { fileId, isPinned } = event.detail;

        if (isPinned) {
            // 添加到钉选列表
            if (!config.pinnedFileIds.includes(fileId)) {
                config.pinnedFileIds = [...config.pinnedFileIds, fileId];
            }
        } else {
            // 从钉选列表移除
            config.pinnedFileIds = config.pinnedFileIds.filter(id => id !== fileId);
        }

        await saveConfig();
        await loadFileCards();
    }

    // 暴露刷新方法
    export async function refresh() {
        if (isRefreshing) return;

        isRefreshing = true;
        try {
            await loadFileCards();
            showMessage('已刷新', 1000, 'info');
        } catch (error) {
            console.error('[QuickNoteWidget] 刷新失败:', error);
            showMessage('刷新失败', 3000, 'error');
        } finally {
            isRefreshing = false;
        }
    }

    /**
     * 内部刷新处理（按钮点击）
     */
    function handleRefresh() {
        refresh();
    }
</script>

<div class="quick-note-widget">
    <!-- 顶部：紧凑的文件卡片栏 -->
    {#if isRefreshing}
        <div class="file-card-loading">
            <div class="loading-spinner"></div>
            <span>刷新中...</span>
        </div>
    {:else if fileCards.length > 0}
        <FileCardList
            cards={fileCards}
            selectedId={config.selectedFileId}
            notebookId={config.notebookId}
            on:select={handleFileSelect}
            on:pin={handleFilePin}
        />
    {/if}

    <!-- 底部：输入框和按钮 -->
    <div class="widget-content">
        <textarea
            bind:value={noteContent}
            on:keydown={handleKeydown}
            placeholder="输入笔记内容（支持选择目标文件）..."
            class="note-input"
            disabled={isSending}
            rows="1"
        ></textarea>

        <button
            class="send-btn"
            on:click={handleSend}
            disabled={isSending || !noteContent.trim()}
            title={config.enableEnterToSend ? 'Enter 发送 · Shift+Enter 换行' : '点击发送'}
        >
            {#if isSending}
                <span class="sending">发送中...</span>
            {:else}
                <Send size={18} />
            {/if}
        </button>

        <button
            class="icon-btn refresh-btn"
            class:refreshing={isRefreshing}
            on:click={handleRefresh}
            disabled={isRefreshing}
            title="刷新文档列表"
        >
            <RefreshCw size={18} />
        </button>

        <button
            class="icon-btn settings-btn"
            on:click={openSettings}
            title="设置"
        >
            <Settings size={18} />
        </button>
    </div>

    <!-- 设置对话框 -->
    {#if showSettings}
        <QuickNoteSettings
            {config}
            on:save={handleSaveSettings}
            on:close={closeSettings}
        />
    {/if}
</div>

<style>
    .quick-note-widget {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--b3-theme-background);
        border-radius: 8px;
        overflow: hidden;
    }

    .file-card-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-surface);
        font-size: 12px;
    }

    .loading-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--b3-border-color);
        border-top-color: var(--b3-theme-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .widget-content {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
    }

    .note-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-size: 14px;
        line-height: 1.5;
        font-family: inherit;
        transition: border-color 0.2s;
        min-height: 42px;
        max-height: 120px;
        resize: vertical;
        overflow-y: auto;
    }

    .note-input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .note-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .note-input::placeholder {
        color: var(--b3-theme-on-surface-light);
    }

    .send-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 42px;
        height: 42px;
        padding: 0 12px;
        background: var(--b3-theme-primary);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .send-btn:hover:not(:disabled) {
        background: var(--b3-theme-primary-light);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .send-btn:active:not(:disabled) {
        transform: translateY(0);
    }

    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .send-btn .sending {
        font-size: 13px;
        white-space: nowrap;
    }

    .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 6px;
        color: var(--b3-theme-on-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
        width: 42px;
        height: 42px;
    }

    .icon-btn:hover {
        background: var(--b3-theme-background-light);
        color: var(--b3-theme-primary);
    }

    .icon-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* 刷新按钮旋转动画 */
    .refresh-btn.refreshing :global(svg) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    /* 响应式调整 */
    @media (max-width: 768px) {
        .widget-content {
            padding: 6px 8px;
            gap: 6px;
        }

        .note-input {
            font-size: 13px;
            padding: 8px 12px;
            min-height: 36px;
            max-height: 100px;
        }

        .send-btn,
        .icon-btn {
            width: 36px;
            height: 36px;
            min-width: 36px;
        }
    }
</style>
