<!--
 SQL执行器设置对话框
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let config: any = {};

    const dispatch = createEventDispatcher();

    // 本地状态
    let defaultSql = config.defaultSql || '';
    let autoExecute = config.autoExecute !== false; // 默认为 true
    let linkColumnsText = formatLinkColumnsToText(config.linkColumns || {
        id: 'siyuan://blocks/%s',
        root_id: 'siyuan://blocks/%s'
    });
    let timeColumnsText = formatArrayToText(config.timeColumns || ['created', 'updated']);
    let columnOrder = config.columnOrder || '';
    let pageSize = config.pageSize || 20;

    // 将 linkColumns 对象转换为文本格式（每行一个配置）
    function formatLinkColumnsToText(linkColumns: Record<string, string>): string {
        return Object.entries(linkColumns)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
    }

    // 将文本格式转换为 linkColumns 对象
    function parseLinkColumnsFromText(text: string): Record<string, string> {
        const result: Record<string, string> = {};
        text.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    result[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return result;
    }

    // 将数组转换为文本格式（每行一个）
    function formatArrayToText(arr: string[]): string {
        return arr.join('\n');
    }

    // 将文本格式转换为数组
    function parseTextToArray(text: string): string[] {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    function handleSave() {
        const newConfig = {
            defaultSql: defaultSql.trim(),
            autoExecute,
            linkColumns: parseLinkColumnsFromText(linkColumnsText),
            timeColumns: parseTextToArray(timeColumnsText),
            columnOrder: columnOrder.trim(),
            pageSize: Math.max(5, Math.min(500, pageSize))
        };
        dispatch('save', newConfig);
    }

    function handleCancel() {
        dispatch('cancel');
    }
</script>

<div class="sql-settings-dialog">
    <div class="dialog-header">
        <h3>SQL 执行器设置</h3>
    </div>

    <div class="dialog-content">
        <div class="setting-item">
            <label for="default-sql">默认 SQL 查询</label>
            <textarea
                id="default-sql"
                bind:value={defaultSql}
                placeholder="SELECT * FROM blocks LIMIT 10"
                rows="2"
            />
        </div>

        <div class="setting-item">
            <label class="checkbox-label">
                <input type="checkbox" bind:checked={autoExecute} />
                <span>加载时自动执行</span>
            </label>
        </div>

        <div class="setting-item">
            <label for="link-columns">列链接配置 <span class="hint-inline">（格式：列名=链接模板，%s 为占位符）</span></label>
            <textarea
                id="link-columns"
                bind:value={linkColumnsText}
                placeholder="id=siyuan://blocks/%s&#10;root_id=siyuan://blocks/%s"
                rows="3"
            />
        </div>

        <div class="setting-item">
            <label for="time-columns">时间列配置 <span class="hint-inline">（每行一个列名，格式：20251118174157）</span></label>
            <textarea
                id="time-columns"
                bind:value={timeColumnsText}
                placeholder="created&#10;updated"
                rows="2"
            />
        </div>

        <div class="setting-item">
            <label for="column-order">列显示顺序 <span class="hint-inline">（逗号分隔，留空则按原始顺序）</span></label>
            <input
                type="text"
                id="column-order"
                bind:value={columnOrder}
                placeholder="id, content, created, updated"
            />
        </div>

        <div class="setting-item">
            <label for="page-size">每页显示数量</label>
            <input
                type="number"
                id="page-size"
                bind:value={pageSize}
                placeholder="20"
                min="5"
                max="500"
            />
        </div>
    </div>

    <div class="dialog-footer">
        <button class="b3-button b3-button--cancel" on:click={handleCancel}>
            取消
        </button>
        <button class="b3-button b3-button--text" on:click={handleSave}>
            保存
        </button>
    </div>
</div>

<style lang="scss">
    .sql-settings-dialog {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 480px;
        max-width: 550px;
        padding: 16px 20px;
    }

    .dialog-header {
        h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--b3-theme-on-surface);
        }
    }

    .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .setting-item {
        display: flex;
        flex-direction: column;
        gap: 6px;

        label {
            font-weight: 500;
            font-size: 13px;
            color: var(--b3-theme-on-surface);

            .hint-inline {
                font-size: 11px;
                font-weight: normal;
                color: var(--b3-theme-on-surface-light);
            }

            &.checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-weight: normal;

                input[type="checkbox"] {
                    cursor: pointer;
                }
            }
        }

        textarea, input[type="text"], input[type="number"] {
            width: 100%;
            padding: 6px 10px;
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            background: var(--b3-theme-background);
            color: var(--b3-theme-on-background);
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            box-sizing: border-box;
            transition: border-color 0.2s;

            &:focus {
                outline: none;
                border-color: var(--b3-theme-primary);
            }

            &::placeholder {
                color: var(--b3-theme-on-surface-light);
                opacity: 0.6;
            }
        }

        textarea {
            resize: vertical;
            min-height: 40px;
        }
    }

    .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 8px;
        margin-top: 4px;
        border-top: 1px solid var(--b3-border-color);
    }
</style>
