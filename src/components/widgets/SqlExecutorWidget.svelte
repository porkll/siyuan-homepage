<!--
 SQL执行器小组件
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { sql } from "@/api";
    import { svelteDialog } from "@/libs/dialog";
    import SqlExecutorSettings from "./sql/SqlExecutorSettings.svelte";

    export let colSpan: number = 6;
    export let rowSpan: number = 4;
    export let config: any = {};
    export let onConfigChange: (newConfig: any) => void = () => {};

    let sqlQuery: string = config.defaultSql || "SELECT * FROM blocks LIMIT 10";
    let results: any[] = [];
    let columns: string[] = [];
    let loading: boolean = false;
    let error: string = "";
    let isInputCollapsed: boolean = true; // 默认折叠输入区域
    let currentPage: number = 0;

    // 链接配置：{ columnName: 'siyuan://blocks/%s' }
    $: linkColumns = config.linkColumns || {};

    // 列顺序配置
    $: columnOrderList = config.columnOrder
        ? config.columnOrder.split(',').map((col: string) => col.trim()).filter(Boolean)
        : [];

    // 根据配置重新排序列
    $: orderedColumns = columnOrderList.length > 0
        ? [...columnOrderList.filter((col: string) => columns.includes(col)),
           ...columns.filter(col => !columnOrderList.includes(col))]
        : columns;

    // 同步 pageSize 从 config
    $: pageSize = config.pageSize || 20;

    // 计算总页数
    $: totalPages = Math.ceil(results.length / pageSize);

    // 当前页的数据
    $: paginatedResults = results.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    // 重置页码当结果变化时
    $: {
        results;
        currentPage = 0;
    }

    // 组件加载时，如果配置了自动执行，则执行查询
    onMount(() => {
        if (config.autoExecute !== false && sqlQuery.trim()) {
            executeQuery();
        }
    });

    // 根据空间大小调整显示
    $: isCompact = colSpan < 6 || rowSpan < 3;

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
                columns = Object.keys(data[0]);
            } else {
                results = [];
                columns = [];
            }
        } catch (e) {
            error = (e instanceof Error ? e.message : String(e)) || "执行SQL时发生错误";
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

    // 切换输入区域折叠状态
    function toggleInput() {
        isInputCollapsed = !isInputCollapsed;
    }

    // 格式化链接
    function formatLink(template: string, value: any): string {
        if (!value) return '';
        // 支持 %s 占位符
        return template.replace('%s', String(value));
    }

    // 检查列是否应该渲染为链接
    function shouldRenderAsLink(columnName: string): boolean {
        return columnName in linkColumns;
    }

    // 打开设置对话框
    function openSettings() {
        const { component, dialog, close } = svelteDialog({
            title: "SQL 执行器设置",
            width: "600px",
            constructor: (container) => {
                const instance = new SqlExecutorSettings({
                    target: container,
                    props: {
                        config: {
                            ...config,
                            defaultSql: sqlQuery  // 传入当前实际编写的 SQL
                        }
                    }
                });

                instance.$on('save', (event) => {
                    const newConfig = event.detail;
                    // 更新配置
                    config = { ...config, ...newConfig };
                    // 更新 SQL 查询
                    sqlQuery = newConfig.defaultSql || sqlQuery;
                    // 通知父组件配置已更改
                    onConfigChange(config);
                    // 关闭对话框
                    close();
                });

                instance.$on('cancel', () => {
                    // 关闭对话框
                    close();
                });

                return instance;
            }
        });
    }
</script>

<div class="widget sql-executor-widget">
    <div class="widget-header">
        <svg class="widget-icon"><use xlink:href="#iconSQL"></use></svg>
        <h3>SQL 执行器</h3>
        <div class="header-actions">
            <button
                class="header-btn"
                on:click={openSettings}
                title="设置"
            >
                <svg><use xlink:href="#iconSettings"></use></svg>
            </button>
            <button
                class="header-btn toggle-input-btn"
                on:click={toggleInput}
                title={isInputCollapsed ? "展开输入区域" : "折叠输入区域"}
            >
                <svg class:collapsed={isInputCollapsed}>
                    <use xlink:href="#iconDown"></use>
                </svg>
            </button>
        </div>
    </div>

    {#if !isInputCollapsed}
        <div class="sql-input-area" class:compact={isCompact}>
            <textarea
                bind:value={sqlQuery}
                on:keydown={handleKeydown}
                placeholder="输入SQL查询，按 Ctrl+Enter 执行"
                rows={isCompact ? 2 : 3}
            />
            <button class="b3-button b3-button--outline execute-btn" on:click={executeQuery} disabled={loading}>
                {#if loading}
                    <svg class="rotating"><use xlink:href="#iconRefresh"></use></svg>
                    执行中
                {:else}
                    <svg><use xlink:href="#iconPlay"></use></svg>
                    执行
                {/if}
            </button>
        </div>
    {:else}
        <div class="collapsed-input">
            <button class="b3-button b3-button--outline execute-btn-compact" on:click={executeQuery} disabled={loading}>
                {#if loading}
                    <svg class="rotating"><use xlink:href="#iconRefresh"></use></svg>
                    执行中
                {:else}
                    <svg><use xlink:href="#iconPlay"></use></svg>
                    执行当前查询
                {/if}
            </button>
        </div>
    {/if}

    {#if error}
        <div class="error-message">
            <svg><use xlink:href="#iconCloseRound"></use></svg>
            <span>{error}</span>
        </div>
    {/if}

    {#if results.length > 0}
        <div class="results-area">
            <div class="results-info">
                <svg><use xlink:href="#iconTable"></use></svg>
                <span>{results.length} 条记录</span>
            </div>
            <div class="table-wrapper">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th class="row-num">#</th>
                            {#each orderedColumns as column}
                                <th>{column}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each paginatedResults as row, index}
                            <tr>
                                <td class="row-num">{currentPage * pageSize + index + 1}</td>
                                {#each orderedColumns as column}
                                    <td>
                                        {#if shouldRenderAsLink(column)}
                                            <a
                                                href={formatLink(linkColumns[column], row[column])}
                                                target="_blank"
                                                class="cell-link"
                                            >
                                                {row[column] ?? ''}
                                            </a>
                                        {:else}
                                            {row[column] ?? ''}
                                        {/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            {#if totalPages > 1}
                <div class="pagination">
                    <button
                        class="b3-button b3-button--outline pagination-btn"
                        disabled={currentPage === 0}
                        on:click={() => currentPage = 0}
                    >
                        <svg><use xlink:href="#iconBack"></use></svg>
                    </button>
                    <button
                        class="b3-button b3-button--outline pagination-btn"
                        disabled={currentPage === 0}
                        on:click={() => currentPage -= 1}
                    >
                        <svg><use xlink:href="#iconLeft"></use></svg>
                    </button>
                    <span class="pagination-info">
                        第 {currentPage + 1} / {totalPages} 页
                    </span>
                    <button
                        class="b3-button b3-button--outline pagination-btn"
                        disabled={currentPage >= totalPages - 1}
                        on:click={() => currentPage += 1}
                    >
                        <svg><use xlink:href="#iconRight"></use></svg>
                    </button>
                    <button
                        class="b3-button b3-button--outline pagination-btn"
                        disabled={currentPage >= totalPages - 1}
                        on:click={() => currentPage = totalPages - 1}
                    >
                        <svg><use xlink:href="#iconForward"></use></svg>
                    </button>
                </div>
            {/if}
        </div>
    {:else if !loading && !error}
        <div class="empty-state">
            <svg><use xlink:href="#iconDatabase"></use></svg>
            <p>输入 SQL 查询并执行</p>
        </div>
    {/if}
</div>

<style lang="scss">
    .sql-executor-widget {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        overflow: hidden;
    }

    .widget-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 12px;
        border-bottom: 2px solid var(--b3-theme-primary);
        flex-shrink: 0;

        .widget-icon {
            width: 20px;
            height: 20px;
            color: var(--b3-theme-primary);
        }

        h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--b3-theme-on-surface);
            flex: 1;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .header-btn {
            padding: 4px;
            background: transparent;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;

            &:hover {
                background: var(--b3-list-hover);
            }

            svg {
                width: 16px;
                height: 16px;
                color: var(--b3-theme-on-surface);
                transition: transform 0.2s;

                &.collapsed {
                    transform: rotate(-90deg);
                }
            }
        }
    }

    .sql-input-area {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;

        &.compact {
            gap: 6px;
        }

        textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            background: var(--b3-theme-background);
            color: var(--b3-theme-on-background);
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            resize: none;
            transition: border-color 0.2s;
            box-sizing: border-box;

            &:focus {
                outline: none;
                border-color: var(--b3-theme-primary);
            }
        }

        .execute-btn {
            align-self: flex-end;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            font-size: 13px;

            svg {
                width: 14px;
                height: 14px;
            }

            &:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        }
    }

    .collapsed-input {
        display: flex;
        gap: 8px;
        flex-shrink: 0;

        .execute-btn-compact {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            font-size: 13px;

            svg {
                width: 14px;
                height: 14px;
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
        gap: 6px;
        padding: 8px 12px;
        background: var(--b3-card-error-background);
        color: var(--b3-card-error-color);
        border-radius: 4px;
        border-left: 3px solid var(--b3-card-error-color);
        font-size: 12px;
        flex-shrink: 0;

        svg {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }

        span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .results-area {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-height: 0;

        .results-info {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 500;
            color: var(--b3-theme-on-surface);
            flex-shrink: 0;

            svg {
                width: 14px;
                height: 14px;
                color: var(--b3-theme-primary);
            }
        }

        .table-wrapper {
            flex: 1;
            min-height: 0;
            overflow: auto;
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            background: var(--b3-theme-background);
        }

        .pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 6px 0;
            flex-shrink: 0;

            .pagination-btn {
                padding: 4px 8px;
                min-width: unset;
                display: flex;
                align-items: center;
                justify-content: center;

                svg {
                    width: 14px;
                    height: 14px;
                }

                &:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
            }

            .pagination-info {
                font-size: 12px;
                color: var(--b3-theme-on-surface);
                min-width: 80px;
                text-align: center;
            }
        }
    }

    .results-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;

        thead {
            position: sticky;
            top: 0;
            background: var(--b3-theme-surface);
            z-index: 1;

            tr {
                border-bottom: 2px solid var(--b3-border-color);
            }

            th {
                padding: 8px 10px;
                text-align: left;
                font-weight: 600;
                color: var(--b3-theme-on-surface);
                white-space: nowrap;

                &.row-num {
                    width: 40px;
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
                padding: 6px 10px;
                color: var(--b3-theme-on-background);
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;

                &.row-num {
                    text-align: center;
                    font-weight: 500;
                    color: var(--b3-theme-on-surface-light);
                }

                .cell-link {
                    color: var(--b3-theme-primary);
                    text-decoration: none;
                    transition: opacity 0.2s;

                    &:hover {
                        opacity: 0.7;
                        text-decoration: underline;
                    }
                }
            }
        }
    }

    .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: var(--b3-theme-on-surface-light);

        svg {
            width: 40px;
            height: 40px;
            opacity: 0.5;
        }

        p {
            margin: 0;
            font-size: 13px;
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
