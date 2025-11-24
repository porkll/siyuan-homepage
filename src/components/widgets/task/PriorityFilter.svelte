<!--
  优先级筛选组件 - 使用通用 MultiSelect 组件
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TaskPriority } from '../../../types/task';
    import MultiSelect from './MultiSelect.svelte';

    export let selectedPriorities: TaskPriority[] = [];

    const dispatch = createEventDispatcher<{
        change: TaskPriority[];
    }>();

    // 优先级选项
    const priorities: { value: TaskPriority; label: string; icon: string; color: string }[] = [
        { value: 'urgent', label: '紧急', icon: '🔴', color: '#ef4444' },
        { value: 'high', label: '高', icon: '🟠', color: '#f97316' },
        { value: 'medium', label: '中', icon: '🟡', color: '#eab308' },
        { value: 'low', label: '低', icon: '🟢', color: '#22c55e' }
    ];

    function handleChange(event: CustomEvent<string[]>) {
        selectedPriorities = event.detail as TaskPriority[];
        dispatch('change', selectedPriorities);
    }
</script>

<div class="priority-filter">
    <MultiSelect
        items={priorities}
        selectedIds={selectedPriorities}
        placeholder="优先级..."
        emptyText="暂无优先级选项"
        allSelectedText="已选择所有优先级"
        getItemId={(item) => item.value}
        getItemLabel={(item) => item.label}
        getItemIcon={(item) => item.icon}
        getItemColor={(item) => item.color}
        on:change={handleChange}
    />
</div>

<style>
    .priority-filter {
        width: 100%;
    }
</style>
