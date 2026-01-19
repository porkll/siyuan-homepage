<!--
  批量状态修改组件（嵌入式）
  将某个状态的所有任务批量修改为另一个状态
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task, TaskStatusDefinition, TaskStatusConfig } from '../../../types/task';
    import { getStatusLabel, getStatusConfig } from '../../../libs/task-utils';

    const dispatch = createEventDispatcher();

    export let tasks: Task[] = [];
    export let statusConfig: TaskStatusConfig | undefined = undefined;

    const config = getStatusConfig(statusConfig);

    let fromStatusId: string = '';
    let toStatus: string = '';
    let processing = false;

    // 计算受影响的任务数量（手动输入的 ID）
    $: affectedTasks = fromStatusId.trim()
        ? tasks.filter(task => task.status === fromStatusId.trim())
        : [];

    $: affectedCount = affectedTasks.length;

    // 检查是否可以执行
    $: canExecute = fromStatusId.trim() && toStatus && fromStatusId.trim() !== toStatus && affectedCount > 0;

    // 执行批量修改
    async function executeBatchChange() {
        if (!canExecute) return;

        const fromId = fromStatusId.trim();
        const fromLabel = getStatusLabel(fromId, statusConfig) || fromId;
        const toLabel = getStatusLabel(toStatus, statusConfig);

        if (!confirm(`确定要将 ${affectedCount} 个任务从 "${fromLabel}" 修改为 "${toLabel}" 吗？`)) {
            return;
        }

        processing = true;

        dispatch('execute', {
            fromStatus: fromId,
            toStatus,
            tasks: affectedTasks
        });

        // 重置表单
        fromStatusId = '';
        toStatus = '';
        processing = false;
    }
</script>

<div class="batch-change-panel">
    <p class="description">
        将所有指定状态的任务批量修改为另一个状态。支持输入任何状态 ID（包括历史遗留状态）。
    </p>

    <div class="form-row">
        <div class="form-group">
            <label for="from-status-id">
                源状态 ID
                <span class="hint-text">输入要修改的任务状态 ID</span>
            </label>
            <input
                id="from-status-id"
                type="text"
                bind:value={fromStatusId}
                placeholder="例如: todo, old-status"
                disabled={processing}
            />
        </div>

        <div class="arrow">→</div>

        <div class="form-group">
            <label for="to-status">
                目标状态
                <span class="hint-text">选择要修改为的状态</span>
            </label>
            <select id="to-status" bind:value={toStatus} disabled={processing}>
                <option value="">-- 请选择 --</option>
                {#each config.statuses as status}
                    <option value={status.id}>
                        {status.label}
                    </option>
                {/each}
            </select>
        </div>
    </div>

    {#if fromStatusId.trim() && affectedCount > 0}
        <div class="info-box info">
            <p>📊 将影响 <strong>{affectedCount}</strong> 个任务</p>
        </div>
    {:else if fromStatusId.trim() && affectedCount === 0}
        <div class="info-box warning">
            <p>⚠️ 没有找到状态为 "{fromStatusId.trim()}" 的任务</p>
        </div>
    {/if}

    {#if fromStatusId.trim() && toStatus && fromStatusId.trim() === toStatus}
        <div class="info-box error">
            <p>❌ 源状态和目标状态不能相同</p>
        </div>
    {/if}

    <div class="action-row">
        <button
            class="btn btn-primary"
            on:click={executeBatchChange}
            disabled={!canExecute || processing}
        >
            {processing ? '处理中...' : `批量修改 ${affectedCount} 个任务`}
        </button>
    </div>

    <div class="info-box warning">
        <p>⚠️ 注意：</p>
        <ul>
            <li>批量操作会立即生效，无法撤销</li>
            <li>建议在操作前备份重要数据</li>
            <li>操作会影响所有匹配的任务，请谨慎操作</li>
        </ul>
    </div>
</div>

<style>
    .batch-change-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .description {
        margin: 0;
        font-size: 14px;
        color: var(--b3-theme-on-surface-light);
        line-height: 1.5;
    }

    .form-row {
        display: flex;
        align-items: flex-end;
        gap: 12px;
    }

    .form-group {
        flex: 1;
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

    .form-group input,
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

    .form-group input:focus,
    .form-group select:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
    }

    .form-group input:disabled,
    .form-group select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .arrow {
        text-align: center;
        font-size: 24px;
        color: var(--b3-theme-on-surface-light);
        padding-bottom: 10px;
        flex-shrink: 0;
    }

    .info-box {
        padding: 12px 16px;
        border-left: 3px solid;
        border-radius: 4px;
        font-size: 14px;
    }

    .info-box p {
        margin: 0 0 8px 0;
    }

    .info-box p:last-child {
        margin-bottom: 0;
    }

    .info-box ul {
        margin: 0;
        padding-left: 20px;
    }

    .info-box li {
        margin: 4px 0;
    }

    .info-box.info {
        background: var(--b3-theme-primary-lightest);
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-on-surface);
    }

    .info-box.warning {
        background: #fef3c7;
        border-color: #f59e0b;
        color: #92400e;
    }

    .info-box.error {
        background: #fee2e2;
        border-color: #ef4444;
        color: #991b1b;
    }

    .info-box strong {
        font-weight: 600;
    }

    .action-row {
        display: flex;
        justify-content: flex-start;
    }

    .btn {
        padding: 10px 20px;
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

    .btn-primary {
        background: var(--b3-theme-primary);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
    }
</style>
