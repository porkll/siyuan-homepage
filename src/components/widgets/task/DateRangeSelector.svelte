<!--
  日期范围选择组件 - 使用 Flatpickr
  一次点击选择日期范围
-->
<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import { createEventDispatcher } from 'svelte';
    import flatpickr from 'flatpickr';
    import type { Instance } from 'flatpickr/dist/types/instance';
    import type { DateRangeFilter } from '../../../types/task';
    import 'flatpickr/dist/flatpickr.min.css';

    export let placeholder: string = '选择日期范围';
    export let filter: DateRangeFilter = {
        enabled: false,
        start: undefined,
        end: undefined
    };

    const dispatch = createEventDispatcher<{
        change: DateRangeFilter;
    }>();

    let inputElement: HTMLInputElement;
    let flatpickrInstance: Instance | null = null;
    let lastFilterStart: Date | undefined = undefined;
    let lastFilterEnd: Date | undefined = undefined;

    onMount(() => {
        // 准备默认日期
        const defaultDates: Date[] = [];
        if (filter.start) {
            const startDate = filter.start instanceof Date ? filter.start : new Date(filter.start);
            if (!isNaN(startDate.getTime())) {
                defaultDates.push(startDate);
                lastFilterStart = startDate;
            }
        }
        if (filter.end) {
            const endDate = filter.end instanceof Date ? filter.end : new Date(filter.end);
            if (!isNaN(endDate.getTime())) {
                defaultDates.push(endDate);
                lastFilterEnd = endDate;
            }
        }

        // 初始化 flatpickr
        flatpickrInstance = flatpickr(inputElement, {
            mode: 'range',
            dateFormat: 'm-d',
            defaultDate: defaultDates.length > 0 ? defaultDates : undefined,
            locale: {
                rangeSeparator: ' 至 '
            },
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    filter.start = selectedDates[0];
                    filter.end = selectedDates[1];
                    filter.enabled = true;
                    lastFilterStart = selectedDates[0];
                    lastFilterEnd = selectedDates[1];
                } else if (selectedDates.length === 1) {
                    filter.start = selectedDates[0];
                    filter.end = undefined;
                    filter.enabled = true;
                    lastFilterStart = selectedDates[0];
                    lastFilterEnd = undefined;
                } else {
                    filter.start = undefined;
                    filter.end = undefined;
                    filter.enabled = false;
                    lastFilterStart = undefined;
                    lastFilterEnd = undefined;
                }
                dispatch('change', { ...filter });
            },
            onClose: () => {
                // 日期选择器关闭时触发更新
                if (filter.start || filter.end) {
                    dispatch('change', { ...filter });
                }
            }
        });
    });

    // 检测外部数据变化（如从配置加载），更新 flatpickr 显示
    afterUpdate(() => {
        if (!flatpickrInstance) return;

        // 比较当前 filter 和上次记录的值
        const startChanged = filter.start?.getTime() !== lastFilterStart?.getTime();
        const endChanged = filter.end?.getTime() !== lastFilterEnd?.getTime();

        if (startChanged || endChanged) {
            const dates: Date[] = [];
            if (filter.start) {
                const startDate = filter.start instanceof Date ? filter.start : new Date(filter.start);
                if (!isNaN(startDate.getTime())) {
                    dates.push(startDate);
                }
            }
            if (filter.end) {
                const endDate = filter.end instanceof Date ? filter.end : new Date(filter.end);
                if (!isNaN(endDate.getTime())) {
                    dates.push(endDate);
                }
            }

            // 更新 flatpickr（triggerChange: false 避免触发 onChange）
            if (dates.length > 0) {
                flatpickrInstance.setDate(dates, false);
            } else {
                flatpickrInstance.clear();
            }

            // 更新记录的值
            lastFilterStart = filter.start;
            lastFilterEnd = filter.end;
        }
    });

    onDestroy(() => {
        if (flatpickrInstance) {
            flatpickrInstance.destroy();
        }
    });

    function clearFilter() {
        if (flatpickrInstance) {
            flatpickrInstance.clear();
        }
        filter.start = undefined;
        filter.end = undefined;
        filter.enabled = false;
        lastFilterStart = undefined;
        lastFilterEnd = undefined;
        dispatch('change', { ...filter });
    }

    $: hasValue = filter.start || filter.end;
</script>

<div class="date-range-selector">
    <div class="input-wrapper">
        <input
            bind:this={inputElement}
            type="text"
            class="date-input"
            placeholder={placeholder}
            readonly
        />
        {#if hasValue}
            <button class="clear-btn" on:click={clearFilter} title="清除">
                ×
            </button>
        {/if}
    </div>
</div>

<style>
    .date-range-selector {
        display: flex;
        flex-direction: column;
        width: 100%;
        box-sizing: border-box;
    }

    .input-wrapper {
        position: relative;
        width: 100%;
        box-sizing: border-box;
    }

    .date-input {
        width: 100%;
        min-height: 28px;
        padding: 2px 8px;
        padding-right: 28px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-background);
        font-size: 12px;
        cursor: pointer;
        transition: border-color 0.2s;
        box-sizing: border-box;
    }

    .date-input:hover {
        border-color: var(--b3-theme-primary);
    }

    .date-input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .clear-btn {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        padding: 0;
        border: none;
        background: var(--b3-theme-error-lighter);
        color: var(--b3-theme-error);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        border-radius: 50%;
        transition: all 0.2s;
    }

    .clear-btn:hover {
        background: var(--b3-theme-error);
        color: white;
    }

    /* Flatpickr 样式覆盖 */
    :global(.flatpickr-calendar) {
        font-size: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    :global(.flatpickr-day.selected) {
        background: var(--b3-theme-primary);
        border-color: var(--b3-theme-primary);
    }

    :global(.flatpickr-day.inRange) {
        background: var(--b3-theme-primary-lighter);
        border-color: var(--b3-theme-primary-lighter);
    }

    :global(.flatpickr-day:hover) {
        background: var(--b3-theme-surface);
    }
</style>
