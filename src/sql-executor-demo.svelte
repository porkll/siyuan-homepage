<!--
 SQL执行器演示页面
-->
<script lang="ts">
    import SqlExecutor from "@/components/SqlExecutor.svelte";
</script>

<div class="demo-container">
    <div class="demo-header">
        <h1>SQL 执行器</h1>
        <p>执行思源笔记的 SQL 查询并查看结果</p>
    </div>

    <div class="demo-content">
        <SqlExecutor />
    </div>

    <div class="demo-examples">
        <h3>示例查询</h3>
        <ul>
            <li><code>SELECT * FROM blocks WHERE type='d' LIMIT 10</code> - 查询前10个文档</li>
            <li><code>SELECT * FROM blocks WHERE content LIKE '%TODO%' LIMIT 20</code> - 查询包含TODO的块</li>
            <li><code>SELECT type, COUNT(*) as count FROM blocks GROUP BY type</code> - 统计各类型块的数量</li>
            <li><code>SELECT * FROM blocks WHERE updated > '20240101000000' ORDER BY updated DESC LIMIT 10</code> - 查询最近更新的块</li>
        </ul>
    </div>
</div>

<style lang="scss">
    .demo-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: auto;
        background: var(--b3-theme-background);
    }

    .demo-header {
        padding: 24px;
        background: var(--b3-theme-surface);
        border-bottom: 1px solid var(--b3-border-color);

        h1 {
            margin: 0 0 8px 0;
            font-size: 24px;
            color: var(--b3-theme-on-surface);
        }

        p {
            margin: 0;
            color: var(--b3-theme-on-surface-light);
            font-size: 14px;
        }
    }

    .demo-content {
        flex: 1;
        min-height: 0;
        padding: 0;
    }

    .demo-examples {
        padding: 24px;
        background: var(--b3-theme-surface);
        border-top: 1px solid var(--b3-border-color);

        h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            color: var(--b3-theme-on-surface);
        }

        ul {
            margin: 0;
            padding-left: 24px;

            li {
                margin-bottom: 8px;
                color: var(--b3-theme-on-background);
                font-size: 13px;

                code {
                    background: var(--b3-theme-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 12px;
                    color: var(--b3-theme-primary);
                }
            }
        }
    }
</style>
