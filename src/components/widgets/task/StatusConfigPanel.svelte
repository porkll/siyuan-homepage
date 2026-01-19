<!--
  状态配置面板
  支持添加、编辑、删除、排序状态
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TaskStatusDefinition, TaskStatusConfig } from '../../../types/task';
    import { DEFAULT_STATUS_CONFIG, validateStatusConfig } from '../../../libs/task-utils';

    const dispatch = createEventDispatcher();

    export let statusConfig: TaskStatusConfig = { ...DEFAULT_STATUS_CONFIG };

    // 本地编辑状态
    let localStatuses: TaskStatusDefinition[] = [...statusConfig.statuses];
    let visibleColumns: string[] = [...statusConfig.visibleColumns];
    let defaultStatus: string = statusConfig.defaultStatus;

    // 拖拽相关
    let draggedStatus: TaskStatusDefinition | null = null;

    // 编辑相关
    let editingStatusId: string | null = null;
    let editingLabel: string = '';
    let editingIsCompleted: boolean = false;

    // 新增状态
    let showAddForm = false;
    let newStatusId = '';
    let newStatusLabel = '';
    let newStatusIsCompleted = false;

    // 开始编辑
    function startEdit(status: TaskStatusDefinition) {
        // "其他"状态不能编辑
        if (status.id === '__other__') {
            alert('系统内置的"其他"状态不能编辑');
            return;
        }

        editingStatusId = status.id;
        editingLabel = status.label;
        editingIsCompleted = status.isCompleted;
    }

    // 保存编辑
    function saveEdit() {
        if (!editingStatusId) return;

        const index = localStatuses.findIndex(s => s.id === editingStatusId);
        if (index !== -1) {
            localStatuses[index] = {
                ...localStatuses[index],
                label: editingLabel.trim(),
                isCompleted: editingIsCompleted
            };
            localStatuses = [...localStatuses];
        }

        cancelEdit();
        emitChange();
    }

    // 取消编辑
    function cancelEdit() {
        editingStatusId = null;
        editingLabel = '';
        editingIsCompleted = false;
    }

    // 删除状态
    function deleteStatus(statusId: string) {
        // "其他"状态不能删除
        if (statusId === '__other__') {
            alert('系统内置的"其他"状态不能删除');
            return;
        }

        // 检查是否有任务使用该状态（实际使用时需要传入任务列表）
        if (!confirm(`确定要删除状态 "${localStatuses.find(s => s.id === statusId)?.label}" 吗？\n\n如果有任务使用该状态，删除后这些任务将归类为"其他"状态。`)) {
            return;
        }

        localStatuses = localStatuses.filter(s => s.id !== statusId);
        visibleColumns = visibleColumns.filter(id => id !== statusId);

        // 如果删除的是默认状态，则设置第一个非"其他"状态为默认
        if (defaultStatus === statusId && localStatuses.length > 0) {
            const firstNonOther = localStatuses.find(s => s.id !== '__other__');
            defaultStatus = firstNonOther ? firstNonOther.id : localStatuses[0].id;
        }

        emitChange();
    }

    // 添加状态
    function addStatus() {
        const id = newStatusId.trim();
        const label = newStatusLabel.trim();

        if (!id || !label) {
            alert('状态 ID 和标签不能为空');
            return;
        }

        // 检查 ID 是否重复
        if (localStatuses.some(s => s.id === id)) {
            alert('状态 ID 已存在，请使用其他 ID');
            return;
        }

        localStatuses = [
            ...localStatuses,
            { id, label, isCompleted: newStatusIsCompleted }
        ];

        // 默认添加到可见列
        visibleColumns = [...visibleColumns, id];

        // 重置表单
        newStatusId = '';
        newStatusLabel = '';
        newStatusIsCompleted = false;
        showAddForm = false;

        emitChange();
    }

    // 切换可见性
    function toggleVisibility(statusId: string) {
        if (visibleColumns.includes(statusId)) {
            // 至少保留一个可见列
            if (visibleColumns.length > 1) {
                visibleColumns = visibleColumns.filter(id => id !== statusId);
            }
        } else {
            visibleColumns = [...visibleColumns, statusId];
        }
        emitChange();
    }

    // 拖拽排序
    function handleDragStart(event: DragEvent, status: TaskStatusDefinition) {
        draggedStatus = status;
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

    function handleDrop(event: DragEvent, targetStatus: TaskStatusDefinition) {
        event.preventDefault();

        if (!draggedStatus || draggedStatus === targetStatus) {
            return;
        }

        const draggedIndex = localStatuses.findIndex(s => s.id === draggedStatus.id);
        const targetIndex = localStatuses.findIndex(s => s.id === targetStatus.id);

        if (draggedIndex === -1 || targetIndex === -1) {
            return;
        }

        // 重新排列
        const newOrder = [...localStatuses];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedStatus);
        localStatuses = newOrder;

        draggedStatus = null;
        emitChange();
    }

    // 发送变更事件
    function emitChange() {
        const newConfig: TaskStatusConfig = {
            statuses: localStatuses,
            visibleColumns,
            defaultStatus
        };

        // 验证配置
        const validation = validateStatusConfig(newConfig);
        if (!validation.valid) {
            console.warn('状态配置验证失败:', validation.errors);
        }

        dispatch('change', newConfig);
    }

    // 重置为默认配置
    function resetToDefault() {
        if (!confirm('确定要重置为默认配置吗？这将清除所有自定义状态。')) {
            return;
        }

        localStatuses = [...DEFAULT_STATUS_CONFIG.statuses];
        visibleColumns = [...DEFAULT_STATUS_CONFIG.visibleColumns];
        defaultStatus = DEFAULT_STATUS_CONFIG.defaultStatus;

        emitChange();
    }

    // 默认状态变更时触发
    $: if (defaultStatus) {
        emitChange();
    }
</script>

<div class="status-config-panel">
    <div class="panel-header">
        <h4>状态管理</h4>
        <button class="btn-reset" on:click={resetToDefault}>重置默认</button>
    </div>

    <div class="hint-text">
        拖动排序，勾选控制看板列显示。"其他"状态用于归类未定义状态的任务，不可删除或编辑。
    </div>

    <!-- 状态列表 -->
    <div class="status-list">
        {#each localStatuses as status (status.id)}
            <div
                class="status-item"
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, status)}
                on:dragover={handleDragOver}
                on:drop={(e) => handleDrop(e, status)}
            >
                <span class="drag-handle">⋮⋮</span>

                <input
                    type="checkbox"
                    checked={visibleColumns.includes(status.id)}
                    on:change={() => toggleVisibility(status.id)}
                    title="在看板中显示"
                />

                {#if editingStatusId === status.id}
                    <!-- 编辑模式 -->
                    <div class="status-edit-form">
                        <input
                            type="text"
                            class="edit-input"
                            bind:value={editingLabel}
                            placeholder="状态标签"
                            on:keydown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                            }}
                        />
                        <label class="completed-checkbox">
                            <input
                                type="checkbox"
                                bind:checked={editingIsCompleted}
                            />
                            <span>完成态</span>
                        </label>
                        <button class="btn-icon btn-save" on:click={saveEdit} title="保存">✓</button>
                        <button class="btn-icon btn-cancel" on:click={cancelEdit} title="取消">✕</button>
                    </div>
                {:else}
                    <!-- 显示模式 -->
                    <div class="status-info">
                        <span class="status-id">{status.id}</span>
                        <span class="status-label">{status.label}</span>
                        {#if status.isCompleted}
                            <span class="badge-completed">完成态</span>
                        {/if}
                        {#if status.id === '__other__'}
                            <span class="badge-system">系统</span>
                        {/if}
                    </div>
                    <div class="status-actions">
                        {#if status.id !== '__other__'}
                            <button class="btn-icon" on:click={() => startEdit(status)} title="编辑">✎</button>
                            <button class="btn-icon btn-delete" on:click={() => deleteStatus(status.id)} title="删除">🗑</button>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    <!-- 添加新状态 -->
    {#if showAddForm}
        <div class="add-form">
            <input
                type="text"
                class="form-input"
                bind:value={newStatusId}
                placeholder="状态 ID（英文，如: waiting）"
            />
            <input
                type="text"
                class="form-input"
                bind:value={newStatusLabel}
                placeholder="状态标签（中文，如: 等待中）"
            />
            <label class="completed-checkbox">
                <input
                    type="checkbox"
                    bind:checked={newStatusIsCompleted}
                />
                <span>完成态</span>
            </label>
            <div class="form-actions">
                <button class="btn btn-sm btn-primary" on:click={addStatus}>添加</button>
                <button class="btn btn-sm btn-secondary" on:click={() => showAddForm = false}>取消</button>
            </div>
        </div>
    {:else}
        <button class="btn-add" on:click={() => showAddForm = true}>
            + 添加状态
        </button>
    {/if}

    <!-- 默认状态选择 -->
    <div class="default-status-group">
        <label for="default-status-select">
            默认状态
            <span class="hint-text">新建任务的默认状态（"其他"状态不可作为默认）</span>
        </label>
        <select id="default-status-select" bind:value={defaultStatus}>
            {#each localStatuses as status}
                {#if status.id !== '__other__'}
                    <option value={status.id}>{status.label}</option>
                {/if}
            {/each}
        </select>
    </div>
</div>

<style>
    .status-config-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .panel-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
    }

    .btn-reset {
        padding: 4px 12px;
        font-size: 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-reset:hover {
        background: var(--b3-theme-background);
    }

    .hint-text {
        font-size: 12px;
        color: var(--b3-theme-on-surface-light);
    }

    .status-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 300px;
        overflow-y: auto;
        padding: 4px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
    }

    .status-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: var(--b3-theme-background);
        border-radius: 4px;
        cursor: move;
        transition: all 0.2s;
    }

    .status-item:hover {
        background: var(--b3-theme-surface);
    }

    .drag-handle {
        cursor: move;
        color: var(--b3-theme-on-surface-light);
        font-size: 14px;
        opacity: 0.5;
        flex-shrink: 0;
    }

    .status-item:hover .drag-handle {
        opacity: 1;
    }

    .status-item input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
        flex-shrink: 0;
        margin: 0;
    }

    .status-info {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .status-id {
        font-size: 12px;
        font-family: monospace;
        color: var(--b3-theme-on-surface-light);
        background: var(--b3-theme-surface);
        padding: 2px 6px;
        border-radius: 3px;
    }

    .status-label {
        font-size: 13px;
        color: var(--b3-theme-on-surface);
        font-weight: 500;
    }

    .badge-completed {
        font-size: 11px;
        padding: 2px 6px;
        background: var(--b3-theme-primary-lightest);
        color: var(--b3-theme-primary);
        border-radius: 3px;
    }

    .badge-system {
        font-size: 11px;
        padding: 2px 6px;
        background: #e0e7ff;
        color: #4f46e5;
        border-radius: 3px;
    }

    .status-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .status-item:hover .status-actions {
        opacity: 1;
    }

    .btn-icon {
        width: 24px;
        height: 24px;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 3px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .btn-icon:hover {
        background: var(--b3-theme-surface);
    }

    .btn-delete:hover {
        color: var(--b3-theme-error);
        background: var(--b3-theme-error-lighter);
    }

    .status-edit-form {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .edit-input {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid var(--b3-border-color);
        border-radius: 3px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-size: 13px;
    }

    .edit-input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .completed-checkbox {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--b3-theme-on-surface);
        cursor: pointer;
        user-select: none;
    }

    .completed-checkbox input {
        width: 14px;
        height: 14px;
        margin: 0;
    }

    .btn-save {
        color: var(--b3-theme-primary);
    }

    .btn-cancel {
        color: var(--b3-theme-on-surface-light);
    }

    .add-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
    }

    .form-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-surface);
        font-size: 13px;
    }

    .form-input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
    }

    .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }

    .btn {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-sm {
        padding: 4px 10px;
        font-size: 12px;
    }

    .btn-primary {
        background: var(--b3-theme-primary);
        color: white;
    }

    .btn-primary:hover {
        opacity: 0.9;
    }

    .btn-secondary {
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        border: 1px solid var(--b3-border-color);
    }

    .btn-secondary:hover {
        background: var(--b3-theme-background);
    }

    .btn-add {
        width: 100%;
        padding: 10px;
        border: 1px dashed var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface-light);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-add:hover {
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
        background: var(--b3-theme-primary-lightest);
    }

    .default-status-group {
        padding-top: 12px;
        border-top: 1px solid var(--b3-border-color);
    }

    .default-status-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
    }

    .default-status-group select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-size: 13px;
        font-family: inherit;
    }

    .default-status-group select:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
    }
</style>
