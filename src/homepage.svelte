<!--
 Copyright (c) 2024 by Claude. All Rights Reserved.
 Description  : Modular Homepage component for SiYuan (WeTab-style)
-->
<script lang="ts">
    import { onMount, tick } from 'svelte';
    import ClockWidget from "./components/widgets/ClockWidget.svelte";
    import StatsWidget from "./components/widgets/StatsWidget.svelte";
    import TaskWidget from "./components/widgets/TaskWidget.svelte";
    import SqlExecutorWidget from "./components/widgets/SqlExecutorWidget.svelte";
    import WidgetConfigPanel from "./components/WidgetConfigPanel.svelte";

    export let app; // Used for future features
    export let plugin; // 插件实例，用于保存配置

    const SCREENS_STORAGE_KEY = 'homepage-screens-config'; // 多屏幕配置

    // 布局常量
    const FIXED_ROWS = 8; // 固定行数
    const GRID_GAP = 20; // 网格间距 (px)
    const CONTAINER_PADDING = 32; // 容器内边距 (16px * 2)

    // 动态布局状态
    let containerElement: HTMLElement;
    let calculatedRowHeight = 120; // 动态计算的行高
    let lastHeight = 0; // 上次的高度，用于检测变化

    // 多屏幕状态
    interface Screen {
        id: number;
        name: string;
        widgets: WidgetInstance[];
    }

    let currentScreenIndex = 0; // 当前屏幕索引
    let screens: Screen[] = []; // 所有屏幕

    // 组件注册表 - 定义所有可用的组件类型
    const WIDGET_REGISTRY = {
        'clock': {
            type: 'clock',
            name: '时钟',
            component: ClockWidget,
            defaultLayout: { colSpan: 6, rowSpan: 2 },
            defaultConfig: {
                showSeconds: true,
                format24h: true
            }
        },
        'stats': {
            type: 'stats',
            name: '统计信息',
            component: StatsWidget,
            defaultLayout: { colSpan: 6, rowSpan: 2 },
            defaultConfig: {}
        },
        'task': {
            type: 'task',
            name: '任务管理',
            component: TaskWidget,
            defaultLayout: { colSpan: 12, rowSpan: 4 },
            defaultConfig: {}
        },
        'sql-executor': {
            type: 'sql-executor',
            name: 'SQL 执行器',
            component: SqlExecutorWidget,
            defaultLayout: { colSpan: 6, rowSpan: 4 },
            defaultConfig: {
                defaultSql: 'SELECT * FROM blocks WHERE type = \'d\' ORDER BY updated DESC LIMIT 100',
                autoExecute: true,
                linkColumns: {
                    // 将 id 和 root_id 列渲染为思源块链接
                    'id': 'siyuan://blocks/%s',
                    'root_id': 'siyuan://blocks/%s'
                },
                columnOrder: '', // 列顺序，例如：'id, content, created, updated'
                pageSize: 20 // 每页显示数量
            }
        }
    };

    // 组件实例接口
    interface WidgetInstance {
        id: string;           // 唯一ID
        type: string;         // 组件类型
        colSpan: number;      // 占据列数
        rowSpan: number;      // 占据行数
        enabled: boolean;     // 是否启用
        config: any;          // 组件特定配置
        component?: any;      // 运行时组件引用
    }

    // 默认组件实例（首次加载）
    const defaultWidgets: WidgetInstance[] = [
        {
            id: 'clock-1',
            type: 'clock',
            colSpan: 6,
            rowSpan: 2,
            enabled: true,
            config: { showSeconds: true, format24h: true }
        },
        {
            id: 'stats-1',
            type: 'stats',
            colSpan: 6,
            rowSpan: 2,
            enabled: true,
            config: {}
        },
        {
            id: 'task-1',
            type: 'task',
            colSpan: 12,
            rowSpan: 4,
            enabled: true,
            config: {}
        }
    ];

    let widgets = [...defaultWidgets];
    let contextMenu: {
        show: boolean;
        x: number;
        y: number;
        widget: WidgetInstance | null;
        index: number;
    } = {
        show: false,
        x: 0,
        y: 0,
        widget: null,
        index: -1
    };

    // 从存储加载配置
    onMount(async () => {
        if (!plugin) return;

        // 加载多屏幕配置
        let savedScreensConfig = await plugin.loadData(SCREENS_STORAGE_KEY);

        if (!savedScreensConfig) {
            // 创建默认屏幕
            screens = [{
                id: 1,
                name: '屏幕 1',
                widgets: defaultWidgets
            }];
            await saveScreensConfig();
        } else {
            screens = savedScreensConfig.screens || [];
            currentScreenIndex = savedScreensConfig.currentScreenIndex || 0;
        }

        // 加载当前屏幕的组件
        loadCurrentScreen();

        // 初始化布局计算 - 等待 DOM 更新完成
        await tick();
        requestAnimationFrame(() => {
            if (containerElement) {
                calculateLayout(containerElement.clientHeight);
            }
        });

        // 监听窗口大小变化（带防抖）
        let resizeTimeout: number;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = window.setTimeout(() => {
                if (containerElement) {
                    calculateLayout(containerElement.clientHeight);
                }
            }, 100);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimeout);
        };
    });

    // 保存配置到存储（保存当前屏幕的配置）
    async function saveConfig() {
        if (!plugin || !screens[currentScreenIndex]) return;

        // 保存当前屏幕的组件配置
        screens[currentScreenIndex].widgets = widgets.map(({ id, type, colSpan, rowSpan, enabled, config }) => ({
            id, type, colSpan, rowSpan, enabled, config
        }));

        // 保存到存储
        await saveScreensConfig();
    }

    // 保存所有屏幕配置
    async function saveScreensConfig() {
        if (!plugin) return;

        const configToSave = {
            currentScreenIndex,
            screens: screens.map(screen => ({
                id: screen.id,
                name: screen.name,
                widgets: screen.widgets.map(({ id, type, colSpan, rowSpan, enabled, config }) => ({
                    id, type, colSpan, rowSpan, enabled, config
                }))
            }))
        };

        await plugin.saveData(SCREENS_STORAGE_KEY, configToSave);
    }

    // 加载当前屏幕的组件
    function loadCurrentScreen() {
        if (!screens[currentScreenIndex]) return;

        widgets = screens[currentScreenIndex].widgets.map(w => ({
            ...w,
            component: WIDGET_REGISTRY[w.type]?.component
        }));
    }

    // 切换到指定屏幕
    async function switchToScreen(index: number) {
        if (index < 0 || index >= screens.length) return;

        // 保存当前屏幕的配置
        if (screens[currentScreenIndex]) {
            screens[currentScreenIndex].widgets = widgets.map(({ id, type, colSpan, rowSpan, enabled, config }) => ({
                id, type, colSpan, rowSpan, enabled, config
            }));
        }

        // 切换屏幕
        currentScreenIndex = index;
        loadCurrentScreen();

        // 保存配置
        await saveScreensConfig();
    }

    // 新增屏幕
    async function addScreen() {
        const newId = Math.max(...screens.map(s => s.id), 0) + 1;
        const newScreen: Screen = {
            id: newId,
            name: `屏幕 ${newId}`,
            widgets: [...defaultWidgets]
        };

        screens = [...screens, newScreen];
        await switchToScreen(screens.length - 1);
    }

    // 删除屏幕
    async function removeScreen(index: number) {
        // 至少保留一个屏幕
        if (screens.length <= 1) {
            return;
        }

        // 调整当前屏幕索引
        if (index === currentScreenIndex) {
            // 删除的是当前屏幕，切换到前一个或后一个
            currentScreenIndex = index > 0 ? index - 1 : 0;
        } else if (index < currentScreenIndex) {
            // 删除的屏幕在当前屏幕之前，索引需要-1
            currentScreenIndex--;
        }
        // 如果删除的屏幕在当前屏幕之后，索引不变

        screens = screens.filter((_, i) => i !== index);
        loadCurrentScreen();
        await saveScreensConfig();
    }

    // 右键菜单处理
    function handleWidgetContextMenu(e: MouseEvent, widget: WidgetInstance) {
        e.preventDefault();
        contextMenu = {
            show: true,
            x: e.clientX,
            y: e.clientY,
            widget,
            index: -1
        };
    }

    function closeContextMenu() {
        contextMenu.show = false;
    }

    function handleResizeWidget(rowSpan: number, colSpan: number) {
        if (contextMenu.widget) {
            contextMenu.widget.rowSpan = rowSpan;
            contextMenu.widget.colSpan = colSpan;
            widgets = [...widgets];
            saveConfig();
        }
        closeContextMenu();
    }

    function handleMoveWidget(direction: 'up' | 'down') {
        const currentIndex = widgets.findIndex(w => w.id === contextMenu.widget.id);
        const newWidgets = [...widgets];
        if (direction === 'up' && currentIndex > 0) {
            const temp = newWidgets[currentIndex - 1];
            newWidgets[currentIndex - 1] = newWidgets[currentIndex];
            newWidgets[currentIndex] = temp;
        } else if (direction === 'down' && currentIndex < widgets.length - 1) {
            const temp = newWidgets[currentIndex + 1];
            newWidgets[currentIndex + 1] = newWidgets[currentIndex];
            newWidgets[currentIndex] = temp;
        }
        widgets = newWidgets;
        saveConfig();
        closeContextMenu();
    }

    function handleDisableWidget() {
        if (contextMenu.widget) {
            contextMenu.widget.enabled = false;
            widgets = [...widgets];
            saveConfig();
        }
        closeContextMenu();
    }

    function openWidgetConfig() {
        // 打开详细配置面板
        showConfigPanel = true;
        closeContextMenu();
    }

    let showConfigPanel = false;

    // 组件实例引用，用于调用刷新方法
    let widgetRefs = [];

    $: enabledWidgets = widgets.filter(w => w.enabled && w.component);

    // 刷新所有组件
    function refreshAllWidgets() {
        widgetRefs.forEach(ref => {
            if (ref && typeof ref.refresh === 'function') {
                ref.refresh();
            }
        });
    }

    // 计算动态行高（固定行数）
    function calculateLayout(height: number) {
        if (height <= 0) {
            return;
        }

        // 防止微小变化导致的重复计算（阈值：5px）
        if (Math.abs(height - lastHeight) < 5) {
            return;
        }

        lastHeight = height;

        // 计算可用高度
        const availableHeight = height - CONTAINER_PADDING;

        // 基于固定行数计算行高
        // 注意：间距数量 = 行数 - 1（例如8行有7个间距）
        const totalGapHeight = (FIXED_ROWS - 1) * GRID_GAP;
        const rowHeight = Math.floor((availableHeight - totalGapHeight) / FIXED_ROWS);

        calculatedRowHeight = rowHeight;
    }

</script>

<div class="homepage-container" bind:this={containerElement}>
    <!-- 顶部触发区域 -->
    <div class="top-trigger-area"></div>

    <!-- 全局操作按钮 -->
    <div class="global-actions-wrapper">
        <!-- 屏幕切换按钮 -->
        <div class="screen-switcher">
            {#each screens as screen, index}
                <button
                    class="screen-btn"
                    class:active={index === currentScreenIndex}
                    on:click={() => switchToScreen(index)}
                    title="屏幕 {index + 1}"
                >
                    {index + 1}
                </button>
            {/each}

            <!-- 添加屏幕按钮 -->
            <button
                class="screen-action-btn"
                on:click={addScreen}
                title="新增屏幕"
            >
                +
            </button>

            <!-- 删除当前屏幕按钮 -->
            {#if screens.length > 1}
                <button
                    class="screen-action-btn danger"
                    on:click={() => removeScreen(currentScreenIndex)}
                    title="删除当前屏幕"
                >
                    -
                </button>
            {/if}
        </div>

        <!-- 分隔线 -->
        <div class="toolbar-separator"></div>

        <!-- 刷新按钮 -->
        <button
            class="toolbar-btn"
            on:click={refreshAllWidgets}
            title="刷新所有组件"
        >
            <svg style="width: 16px; height: 16px;"><use xlink:href="#iconRefresh"></use></svg>
        </button>

        <!-- 设置按钮 -->
        <button
            class="toolbar-btn"
            on:click={() => showConfigPanel = true}
            title="设置"
        >
            <svg style="width: 16px; height: 16px;"><use xlink:href="#iconSettings"></use></svg>
        </button>
    </div>

    <div class="widgets-grid" style="--row-height: {calculatedRowHeight}px;">
        {#if enabledWidgets.length === 0}
            <!-- 空状态：显示添加组件占位符 -->
            <div class="empty-widget-placeholder" on:click={() => showConfigPanel = true}>
                <svg class="add-icon"><use xlink:href="#iconAdd"></use></svg>
                <span>添加组件</span>
            </div>
        {:else}
            {#each enabledWidgets as widget, index}
                <div
                    class="widget-wrapper"
                    style="grid-column: span {widget.colSpan}; grid-row: span {widget.rowSpan};"
                    on:contextmenu={(e) => handleWidgetContextMenu(e, widget)}
                >
                    <div class="widget-header-actions">
                        <button
                            class="widget-action-btn"
                            on:click={(e) => handleWidgetContextMenu(e, widget)}
                            title="配置"
                        >
                            <svg><use xlink:href="#iconMore"></use></svg>
                        </button>
                    </div>
                    <svelte:component
                        this={widget.component}
                        bind:this={widgetRefs[index]}
                        colSpan={widget.colSpan}
                        rowSpan={widget.rowSpan}
                        config={widget.config}
                        onConfigChange={(newConfig) => {
                            widget.config = newConfig;
                            widgets = [...widgets];
                            saveConfig();
                        }}
                        {app}
                        {plugin}
                    />
                </div>
            {/each}
        {/if}
    </div>
</div>

{#if contextMenu.show}
    <div
        class="widget-context-menu"
        style="top: {contextMenu.y}px; left: {contextMenu.x}px;"
        on:click|stopPropagation
    >
        <div class="context-menu-header">调整尺寸</div>
        <div class="context-menu-item" on:click={() => handleResizeWidget(1, 3)}>
            <span>1行 × 3列</span>
        </div>
        <div class="context-menu-item" on:click={() => handleResizeWidget(1, 6)}>
            <span>1行 × 6列</span>
        </div>
        <div class="context-menu-item" on:click={() => handleResizeWidget(2, 6)}>
            <span>2行 × 6列</span>
        </div>
        <div class="context-menu-item" on:click={() => handleResizeWidget(3, 6)}>
            <span>3行 × 6列</span>
        </div>
        <div class="context-menu-item" on:click={() => handleResizeWidget(2, 12)}>
            <span>2行 × 12列</span>
        </div>
        <div class="context-menu-item" on:click={() => handleResizeWidget(1, 12)}>
            <span>1行 × 12列（全宽）</span>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" on:click={openWidgetConfig}>
            <svg><use xlink:href="#iconSettings"></use></svg>
            <span>详细配置...</span>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item danger" on:click={() => handleDisableWidget()}>
            <svg><use xlink:href="#iconEyeoff"></use></svg>
            <span>隐藏组件</span>
        </div>
    </div>
{/if}

{#if contextMenu.show}
    <div class="context-menu-overlay" on:click={closeContextMenu}></div>
{/if}

{#if showConfigPanel}
    <WidgetConfigPanel
        bind:widgets={widgets}
        {WIDGET_REGISTRY}
        maxRows={FIXED_ROWS}
        onClose={() => showConfigPanel = false}
        on:save={(e) => {
            widgets = e.detail.widgets;
            saveConfig();
        }}
    />
{/if}

<style lang="scss">
    .homepage-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 16px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
    }

    .top-trigger-area {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100px;
        z-index: 99;

        &:hover ~ .global-actions-wrapper,
        ~ .global-actions-wrapper:hover {
            opacity: 1;
        }
    }

    .global-actions-wrapper {
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 12px;
        opacity: 0;
        transition: opacity 0.3s ease;
        background: var(--b3-theme-background);
        padding: 6px 10px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }

    .screen-switcher {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .screen-btn {
        width: 28px;
        height: 28px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        transition: all 0.2s;

        &:hover {
            background: var(--b3-list-hover);
            border-color: var(--b3-theme-primary);
        }

        &.active {
            background: var(--b3-theme-primary);
            color: var(--b3-theme-on-primary);
            border-color: var(--b3-theme-primary);
        }
    }

    .screen-action-btn {
        width: 28px;
        height: 28px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
        transition: all 0.2s;

        &:hover {
            background: var(--b3-list-hover);
            border-color: var(--b3-theme-primary);
            transform: scale(1.05);
        }

        &.danger {
            color: var(--b3-theme-error);

            &:hover {
                background: var(--b3-theme-error);
                color: white;
                border-color: var(--b3-theme-error);
            }
        }
    }

    .toolbar-separator {
        width: 1px;
        height: 20px;
        background: var(--b3-border-color);
    }

    .toolbar-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: all 0.2s;

        &:hover {
            background: var(--b3-list-hover);
        }
    }

    .widgets-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-auto-rows: var(--row-height, 120px);
        grid-auto-flow: dense;
        gap: 20px;
        flex: 1;
        min-height: 0;
    }

    .empty-widget-placeholder {
        grid-column: span 1;
        grid-row: span 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 2px dashed var(--b3-border-color);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.3s;

        .add-icon {
            width: 32px;
            height: 32px;
            color: var(--b3-theme-on-surface-light);
            transition: all 0.3s;
        }

        span {
            font-size: 12px;
            font-weight: 500;
            color: var(--b3-theme-on-surface-light);
            transition: all 0.3s;
        }

        &:hover {
            border-color: var(--b3-theme-primary);

            .add-icon {
                color: var(--b3-theme-primary);
                transform: scale(1.1);
            }

            span {
                color: var(--b3-theme-primary);
            }
        }
    }

    .widget-wrapper {
        position: relative;
        transition: all 0.3s;

        &:hover {
            .widget-header-actions {
                opacity: 1;
            }
        }
    }

    .widget-header-actions {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
        opacity: 0;
        transition: opacity 0.2s;

        .widget-action-btn {
            width: 24px;
            height: 24px;
            border: none;
            background: var(--b3-theme-background);
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            padding: 0;

            &:hover {
                background: var(--b3-list-hover);
                transform: scale(1.1);
            }

            svg {
                width: 14px;
                height: 14px;
                color: var(--b3-theme-on-surface);
            }
        }
    }

    // 全局样式，应用于所有组件
    :global(.widget) {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    // 右键菜单
    .widget-context-menu {
        position: fixed;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-border-color);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 6px 0;
        min-width: 180px;
        z-index: 1001;
    }

    .context-menu-header {
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        color: var(--b3-theme-on-surface-light);
        text-transform: uppercase;
    }

    .context-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 14px;
        color: var(--b3-theme-on-surface);

        svg {
            width: 16px;
            height: 16px;
            color: var(--b3-theme-on-surface);
        }

        &:hover {
            background: var(--b3-list-hover);
        }

        &.danger {
            color: var(--b3-theme-error);

            svg {
                color: var(--b3-theme-error);
            }
        }
    }

    .context-menu-separator {
        height: 1px;
        background: var(--b3-border-color);
        margin: 4px 0;
    }

    .context-menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
    }
</style>
