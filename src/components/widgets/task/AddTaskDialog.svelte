<!--
  新增任务对话框
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TaskPriority } from '../../../types/task';

    const dispatch = createEventDispatcher();

    export let notebookId: string = '';  // 默认笔记本ID

    let taskContent = '';
    let priority: TaskPriority | '' = '';
    let dueDate = '';

    // 优先级选项
    const priorityOptions = [
        { value: '', label: '无' },
        { value: 'low', label: '低' },
        { value: 'medium', label: '中' },
        { value: 'high', label: '高' },
        { value: 'urgent', label: '紧急' }
    ];

    function handleSubmit() {
        if (!taskContent.trim()) {
            return;
        }

        const task = {
            content: taskContent.trim(),
            priority: priority || undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined
        };

        dispatch('submit', task);
        handleClose();
    }

    function handleClose() {
        dispatch('close');
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            handleClose();
        }
    }
</script>

<div class="add-task-dialog">
    <div class="dialog-overlay" on:click={handleClose}></div>
    <div class="dialog-content">
        <div class="dialog-header">
            <h3>添加任务到今日日记</h3>
            <button class="close-btn" on:click={handleClose}>×</button>
        </div>

        <div class="dialog-body">
            <div class="form-group">
                <label for="task-content">任务内容</label>
                <textarea
                    id="task-content"
                    bind:value={taskContent}
                    placeholder="请输入任务内容..."
                    rows="3"
                    on:keydown={handleKeydown}
                    autofocus
                ></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="task-priority">优先级</label>
                    <select id="task-priority" bind:value={priority}>
                        {#each priorityOptions as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </div>

                <div class="form-group">
                    <label for="task-due-date">截止日期</label>
                    <input
                        type="date"
                        id="task-due-date"
                        bind:value={dueDate}
                    />
                </div>
            </div>

            <div class="hint-text">
                任务将添加到今日日记的"待办"标题下
            </div>
        </div>

        <div class="dialog-footer">
            <button type="button" class="btn btn-secondary" on:click={handleClose}>
                取消
            </button>
            <button
                type="button"
                class="btn btn-primary"
                on:click={handleSubmit}
                disabled={!taskContent.trim()}
            >
                添加 (Ctrl+Enter)
            </button>
        </div>
    </div>
</div>

<style>
    .add-task-dialog {
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
        max-width: 500px;
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

    .dialog-body {
        padding: 20px;
        overflow-y: auto;
    }

    .form-group {
        margin-bottom: 16px;
    }

    .form-group:last-child {
        margin-bottom: 0;
    }

    .form-group label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
    }

    .form-group textarea,
    .form-group select,
    .form-group input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-size: 14px;
        font-family: inherit;
        transition: all 0.2s;
    }

    .form-group textarea {
        resize: vertical;
        min-height: 80px;
    }

    .form-group textarea:focus,
    .form-group select:focus,
    .form-group input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .hint-text {
        margin-top: 12px;
        padding: 8px 12px;
        background: var(--b3-theme-primary-lightest);
        border-left: 3px solid var(--b3-theme-primary);
        border-radius: 4px;
        font-size: 12px;
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
