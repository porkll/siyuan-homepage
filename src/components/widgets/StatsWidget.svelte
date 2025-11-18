<!--
 统计信息小组件
-->
<script lang="ts">
    import { onMount } from "svelte";
    import { fetchPost } from "siyuan";

    export let colSpan: number = 6;

    let stats = {
        notebooks: 0,
        documents: 0,
        blocks: 0
    };

    // 根据空间大小调整网格列数
    $: gridColumns = colSpan >= 6 ? 3 : colSpan >= 4 ? 2 : 1;

    onMount(async () => {
        // 获取笔记本数量
        fetchPost("/api/notebook/lsNotebooks", {}, (response) => {
            if (response && response.data && response.data.notebooks) {
                stats.notebooks = response.data.notebooks.length;
            }
        });

        // 获取文档数量
        fetchPost("/api/query/sql", {
            stmt: "SELECT COUNT(*) as count FROM blocks WHERE type='d'"
        }, (response) => {
            if (response && response.data && response.data[0]) {
                stats.documents = response.data[0].count || 0;
            }
        });

        // 获取总块数
        fetchPost("/api/query/sql", {
            stmt: "SELECT COUNT(*) as count FROM blocks"
        }, (response) => {
            if (response && response.data && response.data[0]) {
                stats.blocks = response.data[0].count || 0;
            }
        });
    });
</script>

<div class="widget stats-widget">
    <div class="widget-header">
        <svg class="widget-icon"><use xlink:href="#iconDatabase"></use></svg>
        <h3>统计信息</h3>
    </div>
    <div class="stats-grid" style="grid-template-columns: repeat({gridColumns}, 1fr);">
        <div class="stat-item">
            <svg class="stat-icon"><use xlink:href="#iconNotebook"></use></svg>
            <div class="stat-info">
                <div class="stat-value">{stats.notebooks}</div>
                <div class="stat-label">笔记本</div>
            </div>
        </div>
        <div class="stat-item">
            <svg class="stat-icon"><use xlink:href="#iconFile"></use></svg>
            <div class="stat-info">
                <div class="stat-value">{stats.documents}</div>
                <div class="stat-label">文档</div>
            </div>
        </div>
        <div class="stat-item">
            <svg class="stat-icon"><use xlink:href="#iconList"></use></svg>
            <div class="stat-info">
                <div class="stat-value">{stats.blocks}</div>
                <div class="stat-label">块</div>
            </div>
        </div>
    </div>
</div>

<style lang="scss">
    .stats-widget {
        display: flex;
        flex-direction: column;
    }

    .widget-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--b3-theme-primary);
        margin-bottom: 20px;

        .widget-icon {
            width: 20px;
            height: 20px;
            color: var(--b3-theme-primary);
        }

        h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--b3-theme-on-surface);
        }
    }

    .stats-grid {
        display: grid;
        gap: 16px;
    }

    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 20px 16px;
        background: var(--b3-theme-background);
        border-radius: 12px;
        border: 1px solid var(--b3-border-color);
        transition: all 0.2s;

        &:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
            width: 32px;
            height: 32px;
            color: var(--b3-theme-primary);
        }

        .stat-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;

            .stat-value {
                font-size: 28px;
                font-weight: 700;
                color: var(--b3-theme-on-background);
            }

            .stat-label {
                font-size: 13px;
                color: var(--b3-theme-on-surface-light);
            }
        }
    }
</style>
