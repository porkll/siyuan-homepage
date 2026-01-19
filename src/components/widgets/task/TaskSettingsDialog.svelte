<!--
  任务设置对话框
-->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchPost } from 'siyuan';
    import type { Task, TaskStatusConfig } from '../../../types/task';
    import { getStatusConfig, getStatusLabel } from '../../../libs/task-utils';
    import StatusConfigPanel from './StatusConfigPanel.svelte';
    import BatchStatusChange from './BatchStatusChange.svelte';

    const dispatch = createEventDispatcher();

    export let currentNotebookId: string = '';
    export let statusConfig: TaskStatusConfig | undefined = undefined;
    export let tasks: Task[] = [];

    let notebooks = [];
    let selectedNotebookId = currentNotebookId;
    let loading = true;

    // 本地状态配置（用于编辑）
    let localStatusConfig: TaskStatusConfig = getStatusConfig(statusConfig);

    // 标签页
    let activeTab: 'basic' | 'status' | 'batch' = 'basic';

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

    function handleStatusConfigChange(event: CustomEvent) {
        localStatusConfig = event.detail;
    }

    function handleBatchExecute(event: CustomEvent) {
        // 转发批量修改事件到父组件
        dispatch('batchStatusChange', event.detail);
    }

    function handleSave() {
        console.log('[TaskSettingsDialog] Saving with status config:', localStatusConfig);

        dispatch('save', {
            notebookId: selectedNotebookId,
            statusConfig: localStatusConfig
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
            <h3>任务设置</h3>
            <button class="close-btn" on:click={handleClose}>×</button>
        </div>

        <!-- 标签页 -->
        <div class="tabs">
            <button
                class="tab"
                class:active={activeTab === 'basic'}
                on:click={() => activeTab = 'basic'}
            >
                基本设置
            </button>
            <button
                class="tab"
                class:active={activeTab === 'status'}
                on:click={() => activeTab = 'status'}
            >
                状态管理
            </button>
            <button
                class="tab"
                class:active={activeTab === 'batch'}
                on:click={() => activeTab = 'batch'}
            >
                批量操作
            </button>
        </div>

        <div class="dialog-body">
            {#if loading}
                <div class="loading">加载中...</div>
            {:else if activeTab === 'basic'}
                <!-- 基本设置 -->
                <div class="form-group">
                    <label for="notebook-select">
                        日记笔记本
                        <span class="hint-text">选择创建日记的笔记本</span>
                    </label>
                    <select id="notebook-select" bind:value={selectedNotebookId}>
                        {#each notebooks as notebook}
                            <option value={notebook.id}>
                                {notebook.icon} {notebook.name}
                                {notebook.closed ? '(已关闭)' : ''}
                            </option>
                        {/each}
                    </select>
                </div>

                <div class="info-box">
                    <p>💡 提示：</p>
                    <ul>
                        <li>新增任务将添加到该笔记本今日日记的"待办"标题下（自动创建）</li>
                        <li>在"状态管理"标签页可以自定义任务状态</li>
                        <li>在"批量操作"标签页可以批量修改任务状态</li>
                    </ul>
                </div>
            {:else if activeTab === 'status'}
                <!-- 状态管理 -->
                <StatusConfigPanel
                    statusConfig={localStatusConfig}
                    on:change={handleStatusConfigChange}
                />
            {:else if activeTab === 'batch'}
                <!-- 批量操作 -->
                <BatchStatusChange
                    {tasks}
                    statusConfig={localStatusConfig}
                    on:execute={handleBatchExecute}
                />
            {/if}
        </div>

        <div class="dialog-footer">
            <button class="btn btn-secondary" on:click={handleClose}>
                取消
            </button>
            <button
                class="btn btn-primary"
                on:click={handleSave}
                disabled={loading || !selectedNotebookId}
            >
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
        backdrop-filter: blur(4px);
    }

    .dialog-content {
        position: relative;
        width: 90%;
        max-width: 600px;
        background: var(--b3-theme-background);
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        max-height: 80vh;
    }

    .dialog-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--b3-border-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .dialog-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
    }

    .close-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
        color: var(--b3-theme-on-surface-light);
        border-radius: 4px;
        transition: all 0.2s;
    }

    .close-btn:hover {
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
    }

    /* 标签页 */
    .tabs {
        display: flex;
        border-bottom: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
    }

    .tab {
        flex: 1;
        padding: 12px 16px;
        border: none;
        background: none;
        color: var(--b3-theme-on-surface-light);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border-bottom: 2px solid transparent;
    }

    .tab:hover {
        color: var(--b3-theme-on-surface);
        background: var(--b3-theme-background);
    }

    .tab.active {
        color: var(--b3-theme-primary);
        border-bottom-color: var(--b3-theme-primary);
        background: var(--b3-theme-background);
    }

    .dialog-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    .loading {
        text-align: center;
        padding: 40px 20px;
        color: var(--b3-theme-on-surface-light);
    }

    .form-group {
        margin-bottom: 20px;
    }

    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
    }

    .hint-text {
        display: block;
        font-size: 12px;
        font-weight: 400;
        color: var(--b3-theme-on-surface-light);
        margin-top: 4px;
    }

    .form-group select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-size: 14px;
        font-family: inherit;
        transition: all 0.2s;
    }

    .form-group select:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
    }

    .info-box {
        padding: 12px 16px;
        border-left: 3px solid var(--b3-theme-primary);
        border-radius: 4px;
        font-size: 13px;
        background: var(--b3-theme-primary-lightest);
        color: var(--b3-theme-on-surface);
    }

    .info-box.warning {
        border-color: #f59e0b;
        background: #fef3c7;
    }

    .info-box p {
        margin: 0 0 8px 0;
        font-weight: 500;
    }

    .info-box ul {
        margin: 0;
        padding-left: 20px;
    }

    .info-box li {
        margin: 4px 0;
        color: var(--b3-theme-on-surface-light);
    }

    .dialog-footer {
        padding: 16px 20px;
        border-top: 1px solid var(--b3-border-color);
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    }

    .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        border: 1px solid var(--b3-border-color);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--b3-theme-background);
    }

    .btn-primary {
        background: var(--b3-theme-primary);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
    }
</style>
