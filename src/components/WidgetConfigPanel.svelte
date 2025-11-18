<!--
 组件配置面板
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let widgets = [];
    export let WIDGET_REGISTRY;
    export let maxRows: number = 10; // 动态最大行数
    export let onClose: () => void;

    const dispatch = createEventDispatcher();

    function handleToggle(widgetId: string) {
        const widget = widgets.find(w => w.id === widgetId);
        if (widget) {
            widget.enabled = !widget.enabled;
            widgets = [...widgets];
            dispatch('update', { widgets });
        }
    }

    function handleGridChange(widgetId: string, field: string, value: number) {
        const widget = widgets.find(w => w.id === widgetId);
        if (widget) {
            widget[field] = value;
            widgets = [...widgets];
            dispatch('update', { widgets });
        }
    }

    function handleDelete(widgetId: string) {
        widgets = widgets.filter(w => w.id !== widgetId);
        dispatch('update', { widgets });
    }

    // 生成唯一ID
    function generateId(type: string): string {
        const existingIds = widgets.filter(w => w.type === type).length;
        return `${type}-${existingIds + 1}`;
    }

    // 添加新组件
    function handleAddWidget(type: string) {
        const widgetDef = WIDGET_REGISTRY[type];
        if (!widgetDef) return;

        const newWidget = {
            id: generateId(type),
            type: type,
            colSpan: widgetDef.defaultLayout.colSpan,
            rowSpan: widgetDef.defaultLayout.rowSpan,
            enabled: true,
            config: { ...widgetDef.defaultConfig },
            component: widgetDef.component
        };

        widgets = [...widgets, newWidget];
        dispatch('update', { widgets });
    }

    function handleSave() {
        dispatch('save', { widgets });
        onClose();
    }
</script>

<div class="config-overlay" on:click={onClose}>
    <div class="config-panel" on:click|stopPropagation>
        <div class="config-header">
            <h2>组件配置</h2>
            <button class="close-btn" on:click={onClose}>
                <svg><use xlink:href="#iconClose"></use></svg>
            </button>
        </div>

        <div class="config-content">
            <div class="config-hint">
                💡 提示：调整组件的大小和启用状态。组件会自动排列，避免重叠。拖动可调整显示顺序。
            </div>

            {#each widgets as widget, index}
                <div class="widget-config-item">
                    <div class="widget-config-row">
                        <div class="widget-toggle">
                            <input
                                type="checkbox"
                                id="widget-{widget.id}"
                                checked={widget.enabled}
                                on:change={() => handleToggle(widget.id)}
                            />
                            <label for="widget-{widget.id}">
                                {WIDGET_REGISTRY[widget.type]?.name || widget.type}
                            </label>
                        </div>

                        <div class="widget-controls">
                            <div class="grid-inputs">
                                <div class="input-group">
                                    <label for="widget-{widget.id}-colSpan">列:</label>
                                    <input
                                        id="widget-{widget.id}-colSpan"
                                        type="number"
                                        min="1"
                                        max="12"
                                        value={widget.colSpan}
                                        on:change={(e) => handleGridChange(widget.id, 'colSpan', parseInt(e.target.value))}
                                        disabled={!widget.enabled}
                                    />
                                </div>
                                <div class="input-group">
                                    <label for="widget-{widget.id}-rowSpan">行:</label>
                                    <input
                                        id="widget-{widget.id}-rowSpan"
                                        type="number"
                                        min="1"
                                        max={maxRows}
                                        value={widget.rowSpan}
                                        on:change={(e) => handleGridChange(widget.id, 'rowSpan', parseInt(e.target.value))}
                                        disabled={!widget.enabled}
                                    />
                                    <span class="max-hint">最多{maxRows}行</span>
                                </div>
                            </div>
                        </div>

                        <button class="delete-btn" on:click={() => handleDelete(widget.id)} title="删除组件">
                            <svg><use xlink:href="#iconTrashcan"></use></svg>
                        </button>
                    </div>
                </div>
            {/each}

            <!-- 添加新组件按钮区域 -->
            <div class="add-widget-section">
                <div class="add-widget-header">添加组件</div>
                <div class="widget-type-list">
                    {#each Object.values(WIDGET_REGISTRY) as widgetDef}
                        <button class="widget-type-btn" on:click={() => handleAddWidget(widgetDef.type)}>
                            <svg><use xlink:href="#iconAdd"></use></svg>
                            <span>{widgetDef.name}</span>
                        </button>
                    {/each}
                </div>
            </div>
        </div>

        <div class="config-footer">
            <button class="btn-cancel" on:click={onClose}>取消</button>
            <button class="btn-save" on:click={handleSave}>保存配置</button>
        </div>
    </div>
</div>

<style lang="scss">
    .config-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .config-panel {
        background: var(--b3-theme-surface);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
    }

    .config-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--b3-border-color);

        h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: var(--b3-theme-on-surface);
        }

        .close-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;

            &:hover {
                background: var(--b3-list-hover);
            }

            svg {
                width: 18px;
                height: 18px;
                color: var(--b3-theme-on-surface);
            }
        }
    }

    .config-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
    }

    .config-hint {
        padding: 12px 16px;
        background: var(--b3-theme-primary-lightest);
        border-left: 3px solid var(--b3-theme-primary);
        border-radius: 8px;
        margin-bottom: 20px;
        font-size: 14px;
        color: var(--b3-theme-on-surface);
    }

    .widget-config-item {
        margin-bottom: 12px;
        padding: 12px 16px;
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 8px;
        transition: all 0.2s;

        &:hover {
            border-color: var(--b3-theme-primary);
        }
    }

    .widget-config-row {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .delete-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        color: var(--b3-theme-error);
        flex-shrink: 0;

        &:hover {
            background: var(--b3-theme-error-lighter);
        }

        svg {
            width: 16px;
            height: 16px;
        }
    }

    .widget-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 120px;
        flex-shrink: 0;

        input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }

        label {
            font-size: 14px;
            font-weight: 500;
            color: var(--b3-theme-on-background);
            cursor: pointer;
        }
    }

    .widget-controls {
        flex: 1;
        display: flex;
        align-items: center;
    }

    .grid-inputs {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .input-group {
        display: flex;
        align-items: center;
        gap: 6px;

        label {
            font-size: 12px;
            color: var(--b3-theme-on-surface-light);
            font-weight: 500;
            white-space: nowrap;
        }

        input[type="number"] {
            padding: 4px 8px;
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            background: var(--b3-theme-surface);
            color: var(--b3-theme-on-surface);
            font-size: 13px;
            width: 60px;

            &:focus {
                outline: none;
                border-color: var(--b3-theme-primary);
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }

        .max-hint {
            font-size: 10px;
            color: var(--b3-theme-on-surface-light);
            opacity: 0.7;
        }
    }

    .add-widget-section {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 2px solid var(--b3-border-color);
    }

    .add-widget-header {
        font-size: 14px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .widget-type-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .widget-type-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);

        svg {
            width: 14px;
            height: 14px;
        }

        &:hover {
            border-color: var(--b3-theme-primary);
            background: var(--b3-theme-primary-lightest);
            color: var(--b3-theme-primary);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        &:active {
            transform: translateY(0);
        }
    }

    .config-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid var(--b3-border-color);

        button {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-cancel {
            background: var(--b3-theme-background);
            color: var(--b3-theme-on-background);

            &:hover {
                background: var(--b3-list-hover);
            }
        }

        .btn-save {
            background: var(--b3-theme-primary);
            color: white;

            &:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
        }
    }
</style>
