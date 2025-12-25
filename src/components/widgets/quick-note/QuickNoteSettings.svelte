<!--
  快速笔记设置对话框
-->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchPost } from 'siyuan';
    import type { QuickNoteConfig } from '../../../types/quick-note';

    const dispatch = createEventDispatcher();

    export let config: QuickNoteConfig;

    let notebooks = [];
    let selectedNotebookId = config.notebookId;
    let enableEnterToSend = config.enableEnterToSend;
    let headingName = config.headingName;
    let loading = true;

    onMount(() => {
        loadNotebooks();
    });

    function loadNotebooks() {
        loading = true;
        fetchPost('/api/notebook/lsNotebooks', {}, (response) => {
            if (response && response.code === 0) {
                notebooks = response.data.notebooks || [];

                // 如果没有设置笔记本，默认选择第一个打开的笔记本
                if (!selectedNotebookId && notebooks.length > 0) {
                    const openNotebook = notebooks.find(n => !n.closed);
                    selectedNotebookId = openNotebook ? openNotebook.id : notebooks[0].id;
                }
            } else {
                console.error('Failed to load notebooks:', response);
            }
            loading = false;
        });
    }

    function handleSave() {
        dispatch('save', {
            notebookId: selectedNotebookId,
            enableEnterToSend: enableEnterToSend,
            headingName: headingName || '快速笔记'
        });
        handleClose();
    }

    function handleClose() {
        dispatch('close');
    }
</script>

<div class="settings-dialog">
    <div class="dialog-overlay" on:click={handleClose}></div>
    <div class="dialog-content">
        <div class="dialog-header">
            <h3>快速笔记设置</h3>
            <button class="close-btn" on:click={handleClose}>×</button>
        </div>

        <div class="dialog-body">
            {#if loading}
                <div class="loading">加载中...</div>
            {:else}
                <!-- 笔记本选择 -->
                <div class="setting-item">
                    <label for="notebook-select">日记笔记本</label>
                    <select
                        id="notebook-select"
                        bind:value={selectedNotebookId}
                        class="b3-select"
                    >
                        {#each notebooks as notebook}
                            <option value={notebook.id}>
                                {notebook.name}{notebook.closed ? ' (已关闭)' : ''}
                            </option>
                        {/each}
                    </select>
                    <small class="description">选择用于存放快速笔记的日记笔记本</small>
                </div>

                <!-- 标题名称 -->
                <div class="setting-item">
                    <label for="heading-name">标题名称</label>
                    <input
                        id="heading-name"
                        type="text"
                        bind:value={headingName}
                        placeholder="快速笔记"
                        class="b3-text-field"
                    />
                    <small class="description">快速笔记在日记中的标题名称</small>
                </div>

                <!-- 回车发送开关 -->
                <div class="setting-item">
                    <label class="checkbox-label">
                        <input
                            type="checkbox"
                            bind:checked={enableEnterToSend}
                            class="b3-switch"
                        />
                        <span>回车键发送</span>
                    </label>
                    <small class="description">
                        启用后，按 Enter 发送笔记，Shift+Enter 换行<br/>
                        禁用后，需点击发送按钮
                    </small>
                </div>
            {/if}
        </div>

        <div class="dialog-footer">
            <button class="b3-button b3-button--cancel" on:click={handleClose}>
                取消
            </button>
            <button class="b3-button b3-button--text" on:click={handleSave}>
                保存
            </button>
        </div>
    </div>
</div>

<style>
    .settings-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .dialog-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
    }

    .dialog-content {
        position: relative;
        background: var(--b3-theme-background);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
    }

    .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--b3-border-color);
    }

    .dialog-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--b3-theme-on-background);
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
    }

    .close-btn:hover {
        background: var(--b3-theme-background-light);
    }

    .dialog-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
    }

    .loading {
        text-align: center;
        padding: 40px;
        color: var(--b3-theme-on-surface);
    }

    .setting-item {
        margin-bottom: 24px;
    }

    .setting-item:last-child {
        margin-bottom: 0;
    }

    .setting-item label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: var(--b3-theme-on-background);
    }

    .setting-item .description {
        display: block;
        margin-top: 6px;
        color: var(--b3-theme-on-surface);
        font-size: 12px;
        line-height: 1.5;
    }

    .b3-select,
    .b3-text-field {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-size: 14px;
        line-height: 1.5;
        min-height: 40px;
    }

    .b3-select option {
        padding: 8px;
        line-height: 1.5;
    }

    .b3-select:focus,
    .b3-text-field:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        font-weight: 500;
    }

    .checkbox-label span {
        margin-left: 8px;
    }

    .b3-switch {
        cursor: pointer;
    }

    .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid var(--b3-border-color);
    }

    .b3-button {
        padding: 6px 16px;
        border-radius: 4px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        cursor: pointer;
        font-size: 14px;
    }

    .b3-button:hover {
        background: var(--b3-theme-background-light);
    }

    .b3-button--text {
        background: var(--b3-theme-primary);
        color: white;
        border-color: var(--b3-theme-primary);
    }

    .b3-button--text:hover {
        background: var(--b3-theme-primary-light);
        border-color: var(--b3-theme-primary-light);
    }
</style>
