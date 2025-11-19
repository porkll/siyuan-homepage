<!--
 SQL执行器组件
-->
<script lang="ts">
    import { sql } from "@/api";

    let sqlQuery: string = "SELECT * FROM blocks LIMIT 10";
    let results: any[] = [];
    let columns: string[] = [];
    let loading: boolean = false;
    let error: string = "";

    async function executeQuery() {
        if (!sqlQuery.trim()) {
            error = "请输入SQL语句";
            return;
        }

        loading = true;
        error = "";
        results = [];
        columns = [];

        try {
            const data = await sql(sqlQuery);

            if (data && data.length > 0) {
                results = data;
                // 获取列名（使用第一行数据的键）
                columns = Object.keys(data[0]);
            } else {
                results = [];
                columns = [];
            }
        } catch (e) {
            error = e.message || "执行SQL时发生错误";
            console.error("SQL执行错误:", e);
        } finally {
            loading = false;
        }
    }

    // 支持 Ctrl+Enter 快捷键执行
    function handleKeydown(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            executeQuery();
        }
    }
</script>

<div class="sql-executor">
    <div class="sql-input-section">
        <div class="input-header">
            <label for="sql-input">SQL 查询</label>
            <span class="hint">按 Ctrl+Enter 执行</span>
        </div>
        <textarea
            id="sql-input"
            bind:value={sqlQuery}
            on:keydown={handleKeydown}
            placeholder="输入SQL查询语句，例如: SELECT * FROM blocks WHERE type='d' LIMIT 10"
            rows="3"
        />
        <button class="b3-button b3-button--outline" on:click={executeQuery} disabled={loading}>
            {#if loading}
                <svg class="rotating"><use xlink:href="#iconRefresh"></use></svg>
                执行中...
            {:else}
                <svg><use xlink:href="#iconPlay"></use></svg>
                执行查询
            {/if}
        </button>
    </div>

    {#if error}
        <div class="error-message">
            <svg><use xlink:href="#iconCloseRound"></use></svg>
            {error}
        </div>
    {/if}

    {#if results.length > 0}
        <div class="results-section">
            <div class="results-header">
                <svg><use xlink:href="#iconTable"></use></svg>
                <span>查询结果 ({results.length} 条记录)</span>
            </div>
            <div class="table-container">
                <table class="sql-results-table">
                    <thead>
                        <tr>
                            <th class="row-number">#</th>
                            {#each columns as column}
                                <th>{column}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each results as row, index}
                            <tr>
                                <td class="row-number">{index + 1}</td>
                                {#each columns as column}
                                    <td>{row[column] ?? ''}</td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {:else if !loading && !error}
        <div class="empty-state">
            <svg><use xlink:href="#iconDatabase"></use></svg>
            <p>输入SQL查询并点击"执行查询"按钮</p>
        </div>
    {/if}
</div>

<style lang="scss">
    .sql-executor {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: var(--b3-theme-surface);
        border-radius: 8px;
        height: 100%;
        overflow: auto;
    }

    .sql-input-section {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .input-header {
            display: flex;
            justify-content: space-between;
            align-items: center;

            label {
                font-weight: 600;
                font-size: 13px;
                color: var(--b3-theme-on-surface);
            }

            .hint {
                font-size: 11px;
                color: var(--b3-theme-on-surface-light);
            }
        }

        textarea {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            background: var(--b3-theme-background);
            color: var(--b3-theme-on-background);
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
            resize: vertical;
            transition: border-color 0.2s;

            &:focus {
                outline: none;
                border-color: var(--b3-theme-primary);
            }
        }

        button {
            align-self: flex-start;
            display: flex;
            align-items: center;
            gap: 8px;

            svg {
                width: 16px;
                height: 16px;
            }

            &:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        }
    }

    .error-message {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: var(--b3-card-error-background);
        color: var(--b3-card-error-color);
        border-radius: 4px;
        border-left: 4px solid var(--b3-card-error-color);

        svg {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }
    }

    .results-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        min-height: 0;

        .results-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            color: var(--b3-theme-on-surface);

            svg {
                width: 18px;
                height: 18px;
                color: var(--b3-theme-primary);
            }
        }

        .table-container {
            overflow: auto;
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            background: var(--b3-theme-background);
        }
    }

    .sql-results-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;

        thead {
            position: sticky;
            top: 0;
            background: var(--b3-theme-surface);
            z-index: 1;

            tr {
                border-bottom: 2px solid var(--b3-border-color);
            }

            th {
                padding: 12px 16px;
                text-align: left;
                font-weight: 600;
                color: var(--b3-theme-on-surface);
                white-space: nowrap;

                &.row-number {
                    width: 60px;
                    text-align: center;
                }
            }
        }

        tbody {
            tr {
                border-bottom: 1px solid var(--b3-border-color);
                transition: background-color 0.15s;

                &:hover {
                    background: var(--b3-theme-surface);
                }

                &:last-child {
                    border-bottom: none;
                }
            }

            td {
                padding: 10px 16px;
                color: var(--b3-theme-on-background);
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;

                &.row-number {
                    text-align: center;
                    font-weight: 500;
                    color: var(--b3-theme-on-surface-light);
                }
            }
        }
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 60px 20px;
        color: var(--b3-theme-on-surface-light);

        svg {
            width: 48px;
            height: 48px;
            opacity: 0.5;
        }

        p {
            margin: 0;
            font-size: 14px;
        }
    }

    .rotating {
        animation: rotate 1s linear infinite;
    }

    @keyframes rotate {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
