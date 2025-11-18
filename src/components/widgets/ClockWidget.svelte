<!--
 时钟小组件
-->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    export let colSpan: number = 6;
    export let rowSpan: number = 2;

    let currentTime = "";
    let currentDate = "";
    let timer: any;

    const updateTime = () => {
        const now = new Date();
        currentTime = now.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        currentDate = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    };

    onMount(() => {
        updateTime();
        timer = setInterval(updateTime, 1000);
    });

    onDestroy(() => {
        if (timer) clearInterval(timer);
    });

    // 暴露刷新方法（时钟会自动更新，这里只是为了接口一致性）
    export function refresh() {
        updateTime();
    }

    // 根据分配的空间决定布局模式
    // 如果宽度足够且高度较小（1行×12列），使用横向布局
    $: isHorizontal = colSpan >= 8 && rowSpan === 1;
</script>

<div class="widget clock-widget" class:horizontal={isHorizontal}>
    <div class="clock-time">{currentTime}</div>
    <div class="clock-date">{currentDate}</div>
</div>

<style lang="scss">
    .clock-widget {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: linear-gradient(135deg, var(--b3-theme-primary-lighter) 0%, var(--b3-theme-primary-light) 100%);
        border-radius: 12px;
        min-height: 120px;
        height: 100%;

        &.horizontal {
            flex-direction: row;
            gap: 24px;
            padding: 12px 24px;
            min-height: unset;

            .clock-time {
                margin-bottom: 0;
                font-size: 36px;
            }

            .clock-date {
                font-size: 14px;
            }
        }
    }

    .clock-time {
        font-size: 48px;
        font-weight: 700;
        color: var(--b3-theme-primary);
        margin-bottom: 12px;
        font-variant-numeric: tabular-nums;
    }

    .clock-date {
        font-size: 16px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        opacity: 0.8;
    }
</style>
