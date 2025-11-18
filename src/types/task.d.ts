/**
 * 任务管理模块的类型定义
 */

// ==================== 基础数据类型 ====================

/**
 * 任务项的原始数据（从 SiYuan SQL 查询返回）
 */
export interface TaskBlock {
    id: string;              // 块 ID
    root_id: string;         // 文档 ID
    parent_id: string;       // 父块 ID
    box: string;             // 笔记本 ID
    boxName?: string;        // 笔记本名称
    path: string;            // 路径
    hpath: string;           // 人类可读路径
    name: string;            // 文档名称
    content: string;         // 内容
    fcontent: string;        // 格式化内容
    markdown: string;        // Markdown 原文
    type: string;            // 块类型 (i = 列表项)
    subtype: string;         // 子类型 (t = 任务)
    created: string;         // 创建时间戳
    updated: string;         // 更新时间戳
    ial: string;             // 属性字符串
    sort: number;            // 排序
}

/**
 * 任务视图枚举
 */
export type TaskViewType = 'kanban' | 'list' | 'calendar' | 'timeline';

/**
 * 任务状态（可自定义扩展）
 */
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'archived';

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// ==================== 任务数据模型 ====================

/**
 * 标准化的任务数据模型（视图无关）
 */
export interface Task {
    // 基础信息
    id: string;                    // 任务 ID
    content: string;               // 任务内容
    markdown: string;              // 原始 Markdown

    // 状态信息
    status: TaskStatus;            // 任务状态
    completed: boolean;            // 是否完成
    priority?: TaskPriority;       // 优先级

    // 时间信息
    createdAt: Date;               // 创建时间
    updatedAt: Date;               // 更新时间
    dueDate?: Date;                // 截止日期
    completedAt?: Date;            // 完成时间
    archivedAt?: Date;             // 归档时间

    // 位置信息
    notebookId: string;            // 笔记本 ID
    notebookName: string;          // 笔记本名称
    docId: string;                 // 文档 ID
    docName: string;               // 文档名称
    docPath: string;               // 文档路径

    // 扩展信息
    tags?: string[];               // 标签
    assignee?: string;             // 负责人
    progress?: number;             // 进度 (0-100)

    // 自定义属性（从 ial 解析）
    customAttrs?: Record<string, any>;

    // 原始数据引用
    raw?: TaskBlock;
}

// ==================== 视图配置 ====================

/**
 * 看板列配置
 */
export interface KanbanColumn {
    id: string;                    // 列 ID
    title: string;                 // 列标题
    status: TaskStatus;            // 对应的任务状态
    color?: string;                // 主题色
    icon?: string;                 // 图标
    maxItems?: number;             // 最大任务数限制
    collapsed?: boolean;           // 是否折叠
    order: number;                 // 排序
}

/**
 * 看板视图配置
 */
export interface KanbanViewConfig {
    columns: KanbanColumn[];       // 看板列配置
    showEmptyColumns: boolean;     // 是否显示空列
    groupBy?: 'status' | 'priority' | 'notebook' | 'assignee'; // 分组方式
    sortBy?: 'created' | 'updated' | 'priority' | 'dueDate';   // 排序方式
    sortOrder?: 'asc' | 'desc';    // 排序顺序
}

/**
 * 列表视图配置
 */
export interface ListViewConfig {
    groupBy?: 'status' | 'notebook' | 'date';
    sortBy?: 'created' | 'updated' | 'priority' | 'dueDate';
    sortOrder?: 'asc' | 'desc';
    showCompleted: boolean;
    columns?: string[];            // 显示的列
}

/**
 * 日历视图配置
 */
export interface CalendarViewConfig {
    mode: 'month' | 'week' | 'day';
    showWeekend: boolean;
    firstDayOfWeek: 0 | 1;         // 0=Sunday, 1=Monday
}

/**
 * 视图配置联合类型
 */
export type ViewConfig =
    | { type: 'kanban'; config: KanbanViewConfig }
    | { type: 'list'; config: ListViewConfig }
    | { type: 'calendar'; config: CalendarViewConfig };

// ==================== 筛选配置 ====================

/**
 * 笔记本筛选配置
 */
export interface NotebookFilter {
    enabled: boolean;              // 是否启用筛选
    mode: 'include' | 'exclude';   // 包含或排除模式
    notebookIds: string[];         // 笔记本 ID 列表
}

/**
 * 日期范围筛选（单个日期类型）
 */
export interface DateRangeFilter {
    enabled: boolean;
    start?: Date;
    end?: Date;
}

/**
 * 所有日期筛选配置
 */
export interface DateFilters {
    // 创建日期筛选
    created?: DateRangeFilter;
    // 截止日期筛选
    dueDate?: DateRangeFilter;
}

/**
 * 快捷筛选类型
 */
export type QuickFilterType = 'all' | 'today';

/**
 * 任务筛选器
 */
export interface TaskFilter {
    // 快捷筛选
    quickFilter?: QuickFilterType;

    // 笔记本筛选
    notebooks?: NotebookFilter;

    // 状态筛选
    statuses?: TaskStatus[];

    // 优先级筛选
    priorities?: TaskPriority[];

    // 日期筛选
    dateFilters?: DateFilters;

    // 关键词搜索
    keyword?: string;

    // 标签筛选
    tags?: string[];

    // 是否显示已完成
    showCompleted?: boolean;

    // 自定义筛选器（扩展用）
    custom?: Record<string, any>;
}

// ==================== 数据存储配置 ====================

/**
 * Widget 保存的完整配置
 */
export interface TaskWidgetConfig {
    // 当前视图类型
    currentView: TaskViewType;

    // 各个视图的配置
    viewConfigs: {
        kanban?: KanbanViewConfig;
        list?: ListViewConfig;
        calendar?: CalendarViewConfig;
    };

    // 当前筛选器
    filter: TaskFilter;

    // UI 偏好
    preferences?: {
        compactMode?: boolean;      // 紧凑模式
        showStats?: boolean;        // 显示统计
        autoRefresh?: boolean;      // 自动刷新
        refreshInterval?: number;   // 刷新间隔（秒）
    };
}

// ==================== API 响应类型 ====================

export interface ApiResponse<T> {
    code: number;
    msg: string;
    data: T;
}

export interface SqlResponse {
    code: number;
    msg: string;
    data: TaskBlock[];
}

// ==================== 笔记本类型 ====================

export interface Notebook {
    id: string;
    name: string;
    icon: string;
    sort: number;
    closed: boolean;
}
