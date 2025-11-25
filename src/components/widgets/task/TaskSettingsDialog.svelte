<!--
  任务设置对话框
-->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchPost } from 'siyuan';
    import type { TaskStatus, KanbanColumn } from '../../../types/task';
    import { TASK_STATUS } from '../../../libs/task-utils';

    const dispatch = createEventDispatcher();

    export let currentNotebookId: string = '';
    export let kanbanColumns: KanbanColumn[] = [];
    export let quickStatusChange: TaskStatus = TASK_STATUS.ARCHIVED;

    let notebooks = [];
    let selectedNotebookId = currentNotebookId;
    let loading = true;

    // 所有可用的状态选项
    const allStatusOptions = [
        { value: TASK_STATUS.TODO, label: '待办', color: '#94a3b8', description: '新建的任务' },
        { value: TASK_STATUS.IN_PROGRESS, label: '进行中', color: '#3b82f6', description: '正在处理的任务' },
        { value: TASK_STATUS.REVIEW, label: '审核中', color: '#f59e0b', description: '等待审核的任务' },
        { value: TASK_STATUS.DONE, label: '已完成', color: '#10b981', description: '已完成的任务' },
        { value: TASK_STATUS.ARCHIVED, label: '已归档', color: '#6b7280', description: '已归档的任务' }
    ];

    // 当前选中要显示的状态
    let selectedStatuses: TaskStatus[] = kanbanColumns.map(col => col.status);
    let selectedQuickStatus: TaskStatus = quickStatusChange;

    // 状态顺序（基于 kanbanColumns 的顺序）
    let selectedStatusOrder = (() => {
        // 首先按照 kanbanColumns 的顺序排列（过滤掉未找到的状态）
        const orderedStatuses = kanbanColumns
            .map(col => allStatusOptions.find(opt => opt.value === col.status))
            .filter(opt => opt !== undefined) as typeof allStatusOptions;
        // 然后添加未在 kanbanColumns 中的状态
        const remainingStatuses = allStatusOptions.filter(opt =>
            !orderedStatuses.find(os => os.value === opt.value)
        );
        return [...orderedStatuses, ...remainingStatuses];
    })();

    // 拖拽相关
    let draggedOption: typeof allStatusOptions[0] | null = null;

    function handleDragStart(event: DragEvent, option: typeof allStatusOptions[0]) {
        draggedOption = option;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDrop(event: DragEvent, targetOption: typeof allStatusOptions[0]) {
        event.preventDefault();

        if (!draggedOption || draggedOption === targetOption) {
            return;
        }

        const draggedIndex = selectedStatusOrder.findIndex(opt => opt.value === draggedOption.value);
        const targetIndex = selectedStatusOrder.findIndex(opt => opt.value === targetOption.value);

        if (draggedIndex === -1 || targetIndex === -1) {
            return;
        }

        // 重新排列
        const newOrder = [...selectedStatusOrder];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedOption);
        selectedStatusOrder = newOrder;

        draggedOption = null;
    }

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

    // 切换状态选中
    function toggleStatus(status: TaskStatus) {
        if (selectedStatuses.includes(status)) {
            // 至少保留一个状态
            if (selectedStatuses.length > 1) {
                selectedStatuses = selectedStatuses.filter(s => s !== status);
            }
        } else {
            selectedStatuses = [...selectedStatuses, status];
        }
    }

    function handleSave() {
        // 按照 selectedStatusOrder 的顺序构建 selectedStatuses
        const selectedSet = new Set(selectedStatuses);
        const orderedStatuses = selectedStatusOrder
            .map(opt => opt.value)
            .filter(status => selectedSet.has(status));

        console.log('[TaskSettingsDialog] Saving with ordered statuses:', orderedStatuses);

        dispatch('save', {
            notebookId: selectedNotebookId,
            selectedStatuses: orderedStatuses,
            quickStatusChange: selectedQuickStatus
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

        <div class="dialog-body">
            {#if loading}
                <div class="loading">加载中...</div>
            {:else}
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

                <!-- 看板列配置 -->
                <div class="form-group">
                    <label>
                        看板列显示
                        <span class="hint-text">选择要在看板中显示的任务状态，拖动调整顺序</span>
                    </label>
                    <div class="status-checkboxes">
                        {#each selectedStatusOrder as option (option.value)}
                            <label
                                class="status-checkbox"
                                draggable="true"
                                on:dragstart={(e) => handleDragStart(e, option)}
                                on:dragover={handleDragOver}
                                on:drop={(e) => handleDrop(e, option)}
                            >
                                <span class="drag-handle">⋮⋮</span>
                                <input
                                    type="checkbox"
                                    checked={selectedStatuses.includes(option.value)}
                                    on:change={() => toggleStatus(option.value)}
                                />
                                <span class="status-indicator" style:background-color={option.color}></span>
                                <span class="status-label">{option.label}</span>
                            </label>
                        {/each}
                    </div>
                </div>

                <!-- 快捷状态变更配置 -->
                <div class="form-group">
                    <label for="quick-status-select">
                        快捷状态变更
                        <span class="hint-text">卡片操作按钮的默认状态（可在按钮中选择其他状态）</span>
                    </label>
                    <select id="quick-status-select" bind:value={selectedQuickStatus}>
                        {#each allStatusOptions as option}
                            <option value={option.value}>
                                {option.label}
                            </option>
                        {/each}
                    </select>
                </div>

                <div class="info-box">
                    <p>💡 提示：</p>
                    <ul>
                        <li>新增任务将添加到该笔记本今日日记的"待办"标题下（自动创建）</li>
                        <li>至少需要选择一个状态显示在看板中</li>
                    </ul>
                </div>
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
        max-width: 480px;
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
        background: var(--b3-theme-primary-lightest);
        border-left: 3px solid var(--b3-theme-primary);
        border-radius: 4px;
        font-size: 13px;
        color: var(--b3-theme-on-surface);
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

    /* 状态复选框样式 */
    .status-checkboxes {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .status-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        cursor: move;
        transition: opacity 0.2s;
        user-select: none;
    }

    .status-checkbox:hover {
        opacity: 0.8;
    }

    .drag-handle {
        cursor: move;
        color: var(--b3-theme-on-surface-light);
        font-size: 14px;
        line-height: 1;
        opacity: 0.5;
        flex-shrink: 0;
    }

    .status-checkbox:hover .drag-handle {
        opacity: 1;
    }

    .status-checkbox input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
        flex-shrink: 0;
        margin: 0;
    }

    .status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .status-label {
        font-size: 13px;
        color: var(--b3-theme-on-surface);
    }
</style>
