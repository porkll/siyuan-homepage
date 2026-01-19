/**
 * 任务管理工具函数
 */

import type {
    Task,
    TaskBlock,
    TaskStatus,
    TaskPriority,
    TaskFilter,
    QuickFilterType,
    Notebook,
    SqlResponse,
    TaskStatusDefinition,
    TaskStatusConfig
} from '../types/task';

// ==================== 配置 ====================

/**
 * 任务自定义属性配置
 */
export const TASK_ATTRS = {
    STATUS: 'custom-task-status',
    PRIORITY: 'custom-task-priority',
    DUE_DATE: 'custom-task-duedate',
    COMPLETED_TIME: 'custom-task-completed-time',
    ARCHIVED_TIME: 'custom-task-archived-time',
    DAILY_TODO_HEADING: 'custom-daily-todo',
    EXCLUDE_FROM_MANAGEMENT: 'custom-task-exclude', // 排除任务管理
} as const;

/**
 * 任务状态配置常量
 * 将来可以支持用户自定义状态
 */
export const TASK_STATUS = {
    TODO: 'todo' as TaskStatus,
    IN_PROGRESS: 'in-progress' as TaskStatus,
    REVIEW: 'review' as TaskStatus,
    DONE: 'done' as TaskStatus,
    ARCHIVED: 'archived' as TaskStatus,
} as const;

/**
 * 默认新建任务的状态
 */
export const DEFAULT_TASK_STATUS = TASK_STATUS.TODO;

// ==================== 数据转换 ====================

/**
 * 从 markdown 内容解析任务状态（仅处理标准 markdown）
 */
export function parseTaskStatus(markdown: string): { completed: boolean; status: TaskStatus } {
    // 标准任务标记
    if (markdown.startsWith('* [ ] ') || markdown.startsWith('- [ ] ')) {
        return { completed: false, status: TASK_STATUS.TODO };
    }
    if (markdown.startsWith('* [x] ') || markdown.startsWith('* [X] ') ||
        markdown.startsWith('- [x] ') || markdown.startsWith('- [X] ')) {
        return { completed: true, status: TASK_STATUS.DONE };
    }

    // 默认为待办
    return { completed: false, status: TASK_STATUS.TODO };
}

/**
 * 从自定义属性中提取任务状态
 * 如果状态不在已定义的状态中，则归类为"其他"状态
 */
export function extractStatus(customAttrs: Record<string, any>, markdown: string, validStatuses?: string[]): { completed: boolean; status: TaskStatus } {
    const customStatus = customAttrs[TASK_ATTRS.STATUS];

    // 默认有效状态（如果未提供）
    const defaultValidStatuses = Object.values(TASK_STATUS);
    const statusesToCheck = validStatuses || defaultValidStatuses;

    // 如果有自定义状态属性
    if (customStatus) {
        // 检查状态是否有效
        if (statusesToCheck.includes(customStatus)) {
            const status = customStatus as TaskStatus;
            const completed = status === TASK_STATUS.DONE || status === TASK_STATUS.ARCHIVED;
            return { completed, status };
        } else {
            // 状态不在定义中，归类为"其他"
            const completed = markdown.includes('[x]') || markdown.includes('[X]');
            return { completed, status: '__other__' };
        }
    }

    // 否则从 markdown 解析
    return parseTaskStatus(markdown);
}

/**
 * 从属性字符串解析自定义属性
 */
export function parseCustomAttrs(ial: string): Record<string, any> {
    const attrs: Record<string, any> = {};

    if (!ial) return attrs;

    // ial 格式: {: key1="value1" key2="value2"}
    const matches = ial.matchAll(/([\w-]+)="([^"]*)"/g);
    for (const match of matches) {
        const [, key, value] = match;
        attrs[key] = value;
    }

    return attrs;
}

/**
 * 从自定义属性中提取优先级
 */
export function extractPriority(customAttrs: Record<string, any>): TaskPriority | undefined {
    const priority = customAttrs[TASK_ATTRS.PRIORITY];
    if (['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return priority as TaskPriority;
    }
    return undefined;
}

/**
 * 从自定义属性中提取截止日期
 */
export function extractDueDate(customAttrs: Record<string, any>): Date | undefined {
    const dueDate = customAttrs[TASK_ATTRS.DUE_DATE];
    if (dueDate) {
        const date = new Date(dueDate);
        return isNaN(date.getTime()) ? undefined : date;
    }
    return undefined;
}

/**
 * 从自定义属性中提取完成时间
 */
export function extractCompletedTime(customAttrs: Record<string, any>): Date | undefined {
    const completedTime = customAttrs[TASK_ATTRS.COMPLETED_TIME];
    if (completedTime) {
        const date = new Date(completedTime);
        return isNaN(date.getTime()) ? undefined : date;
    }
    return undefined;
}

/**
 * 从自定义属性中提取归档时间
 */
export function extractArchivedTime(customAttrs: Record<string, any>): Date | undefined {
    const archivedTime = customAttrs[TASK_ATTRS.ARCHIVED_TIME];
    if (archivedTime) {
        const date = new Date(archivedTime);
        return isNaN(date.getTime()) ? undefined : date;
    }
    return undefined;
}

/**
 * 将思源时间戳（14位字符串：yyyyMMddHHmmss）转换为 Date 对象
 */
export function parseSiyuanTimestamp(timestamp: string): Date {
    // 思源时间戳格式：20251117123456 (yyyyMMddHHmmss)
    if (!timestamp || timestamp.length !== 14) {
        return new Date();
    }

    const year = parseInt(timestamp.substring(0, 4));
    const month = parseInt(timestamp.substring(4, 6)) - 1; // 月份从0开始
    const day = parseInt(timestamp.substring(6, 8));
    const hour = parseInt(timestamp.substring(8, 10));
    const minute = parseInt(timestamp.substring(10, 12));
    const second = parseInt(timestamp.substring(12, 14));

    return new Date(year, month, day, hour, minute, second);
}

/**
 * 将 TaskBlock 转换为标准化的 Task 对象
 */
export function transformTaskBlock(block: TaskBlock): Task {
    const customAttrs = parseCustomAttrs(block.ial);
    const { completed, status } = extractStatus(customAttrs, block.markdown);

    // 提取内容（只取第一行，去除任务标记，避免包含子任务）
    const firstLine = block.markdown.split('\n')[0];
    const content = firstLine.replace(/^[*-]\s*\[[^\]]*\]\s*/, '').trim();

    // 从 hpath 提取文档名称（最后一个 / 后面的部分）
    const docName = block.hpath ? block.hpath.split('/').pop() || 'Untitled' : 'Untitled';

    // 提取完成时间和归档时间
    const completedTime = extractCompletedTime(customAttrs);
    const archivedTime = extractArchivedTime(customAttrs);

    return {
        id: block.id,
        content,
        markdown: block.markdown,

        status,
        completed,
        priority: extractPriority(customAttrs),

        createdAt: parseSiyuanTimestamp(block.created),
        updatedAt: parseSiyuanTimestamp(block.updated),
        dueDate: extractDueDate(customAttrs),
        // 完成时间优先使用自定义属性，如果没有则回退使用更新时间（仅限已完成但非归档的任务）
        completedAt: completedTime || (completed && status !== TASK_STATUS.ARCHIVED ? parseSiyuanTimestamp(block.updated) : undefined),
        archivedAt: archivedTime,

        notebookId: block.box,
        notebookName: block.boxName || block.box,
        docId: block.root_id,
        docName: docName,
        docPath: block.hpath,

        tags: [],
        assignee: undefined,
        progress: undefined,

        customAttrs,
        raw: block
    };
}

/**
 * 批量转换任务数据
 */
export function transformTasks(blocks: TaskBlock[]): Task[] {
    return blocks.map(transformTaskBlock);
}

// ==================== 数据筛选 ====================

/**
 * 检查日期是否为今天
 */
function isToday(date: Date): boolean {
    const today = new Date();
    const isSameDay = date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();

    // 调试日志
    if (isSameDay) {
        console.log('[今日筛选] 匹配到今日任务:', {
            date: date.toLocaleString(),
            today: today.toLocaleString(),
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate()
        });
    }

    return isSameDay;
}

/**
 * 应用筛选器到任务列表
 */
export function applyFilter(tasks: Task[], filter: TaskFilter): Task[] {
    let filtered = [...tasks];

    // 快捷筛选
    if (filter.quickFilter === 'today') {
        console.log('[今日筛选] 开始筛选，总任务数:', tasks.length);
        console.log('[今日筛选] 当前日期:', new Date().toLocaleString());

        // 今日筛选：今天创建的或今天到期的任务
        filtered = filtered.filter(task => {
            const createdToday = isToday(task.createdAt);
            const dueToday = task.dueDate && isToday(task.dueDate);
            const match = createdToday || dueToday;

            if (!match) {
                console.log('[今日筛选] 任务不匹配:', {
                    content: task.content.substring(0, 30),
                    createdAt: task.createdAt.toLocaleString(),
                    dueDate: task.dueDate?.toLocaleString(),
                    createdToday,
                    dueToday
                });
            }

            return match;
        });

        console.log('[今日筛选] 筛选完成，匹配任务数:', filtered.length);
    }

    // 笔记本筛选
    if (filter.notebooks?.enabled && filter.notebooks.notebookIds.length > 0) {
        if (filter.notebooks.mode === 'include') {
            filtered = filtered.filter(task =>
                filter.notebooks!.notebookIds.includes(task.notebookId)
            );
        } else {
            filtered = filtered.filter(task =>
                !filter.notebooks!.notebookIds.includes(task.notebookId)
            );
        }
    }

    // 状态筛选
    if (filter.statuses && filter.statuses.length > 0) {
        filtered = filtered.filter(task =>
            filter.statuses!.includes(task.status)
        );
    }

    // 优先级筛选
    if (filter.priorities && filter.priorities.length > 0) {
        filtered = filtered.filter(task =>
            task.priority && filter.priorities!.includes(task.priority)
        );
    }

    // 创建日期筛选
    if (filter.dateFilters?.created?.enabled) {
        const { start, end } = filter.dateFilters.created;
        filtered = filtered.filter(task => {
            const createdDate = task.createdAt;
            if (start && createdDate < start) return false;
            if (end) {
                // 结束日期包含当天的 23:59:59
                const endOfDay = new Date(end);
                endOfDay.setHours(23, 59, 59, 999);
                if (createdDate > endOfDay) return false;
            }
            return true;
        });
    }

    // 截止日期筛选
    if (filter.dateFilters?.dueDate?.enabled) {
        const { start, end } = filter.dateFilters.dueDate;
        filtered = filtered.filter(task => {
            if (!task.dueDate) return false; // 没有截止日期的任务不显示
            const dueDate = task.dueDate;
            if (start && dueDate < start) return false;
            if (end) {
                const endOfDay = new Date(end);
                endOfDay.setHours(23, 59, 59, 999);
                if (dueDate > endOfDay) return false;
            }
            return true;
        });
    }

    // 完成日期筛选
    if (filter.dateFilters?.completedDate?.enabled) {
        const { start, end } = filter.dateFilters.completedDate;
        filtered = filtered.filter(task => {
            if (!task.completedAt) return false; // 没有完成日期的任务不显示
            const completedDate = task.completedAt;
            if (start && completedDate < start) return false;
            if (end) {
                const endOfDay = new Date(end);
                endOfDay.setHours(23, 59, 59, 999);
                if (completedDate > endOfDay) return false;
            }
            return true;
        });
    }

    // 关键词搜索
    if (filter.keyword) {
        const keyword = filter.keyword.toLowerCase();
        filtered = filtered.filter(task =>
            task.content.toLowerCase().includes(keyword) ||
            task.docName.toLowerCase().includes(keyword) ||
            task.tags?.some(tag => tag.toLowerCase().includes(keyword))
        );
    }

    // 标签筛选
    if (filter.tags && filter.tags.length > 0) {
        filtered = filtered.filter(task =>
            task.tags?.some(tag => filter.tags!.includes(tag))
        );
    }

    // 是否显示已完成
    if (filter.showCompleted === false) {
        filtered = filtered.filter(task => !task.completed);
    }

    return filtered;
}

// ==================== 数据排序 ====================

/**
 * 任务排序
 */
export function sortTasks(
    tasks: Task[],
    sortBy: 'created' | 'updated' | 'priority' | 'dueDate',
    order: 'asc' | 'desc' = 'desc'
): Task[] {
    const sorted = [...tasks];

    const priorityOrder: Record<TaskPriority, number> = {
        urgent: 4,
        high: 3,
        medium: 2,
        low: 1
    };

    sorted.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'created':
                comparison = a.createdAt.getTime() - b.createdAt.getTime();
                break;

            case 'updated':
                comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
                break;

            case 'priority': {
                const aPriority = a.priority ? priorityOrder[a.priority] : 0;
                const bPriority = b.priority ? priorityOrder[b.priority] : 0;
                comparison = aPriority - bPriority;
                break;
            }

            case 'dueDate': {
                const aTime = a.dueDate?.getTime() || Infinity;
                const bTime = b.dueDate?.getTime() || Infinity;
                comparison = aTime - bTime;
                break;
            }
        }

        return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
}

// ==================== 数据分组 ====================

/**
 * 按状态分组
 */
export function groupByStatus(tasks: Task[]): Map<TaskStatus, Task[]> {
    const groups = new Map<TaskStatus, Task[]>();

    for (const task of tasks) {
        if (!groups.has(task.status)) {
            groups.set(task.status, []);
        }
        groups.get(task.status)!.push(task);
    }

    return groups;
}

/**
 * 按笔记本分组
 */
export function groupByNotebook(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();

    for (const task of tasks) {
        const key = task.notebookId;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(task);
    }

    return groups;
}

/**
 * 按优先级分组
 */
export function groupByPriority(tasks: Task[]): Map<TaskPriority | 'none', Task[]> {
    const groups = new Map<TaskPriority | 'none', Task[]>();

    for (const task of tasks) {
        const key = task.priority || 'none';
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(task);
    }

    return groups;
}

// ==================== 统计信息 ====================

/**
 * 计算任务统计信息
 */
export function calculateStats(tasks: Task[]) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const inProgress = tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length;
    const overdue = tasks.filter(t =>
        t.dueDate && !t.completed && t.dueDate < new Date()
    ).length;

    return {
        total,
        completed,
        inProgress,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

// ==================== SQL 查询构建 ====================

/**
 * 构建任务查询 SQL
 */
export function buildTaskQuery(filter?: TaskFilter): string {
    let sql = "SELECT * FROM blocks WHERE type = 'i' AND subtype = 't'";

    // 排除带有 EXCLUDE_FROM_MANAGEMENT 属性的任务
    sql += ` AND id NOT IN (
        SELECT block_id
        FROM attributes
        WHERE name = '${TASK_ATTRS.EXCLUDE_FROM_MANAGEMENT}'
          AND value = 'true'
    )`;

    // 笔记本筛选
    if (filter?.notebooks?.enabled && filter.notebooks.notebookIds.length > 0) {
        const ids = filter.notebooks.notebookIds.map(id => `'${id}'`).join(',');
        if (filter.notebooks.mode === 'include') {
            sql += ` AND box IN (${ids})`;
        } else {
            sql += ` AND box NOT IN (${ids})`;
        }
    }

    // 默认排序
    sql += " ORDER BY created DESC LIMIT 2000";

    return sql;
}

// ==================== 状态配置管理 ====================

/**
 * 默认任务状态配置
 */
export const DEFAULT_TASK_STATUSES: TaskStatusDefinition[] = [
    { id: 'todo', label: '待办', isCompleted: false },
    { id: 'in-progress', label: '进行中', isCompleted: false },
    { id: 'review', label: '审核中', isCompleted: false },
    { id: 'done', label: '已完成', isCompleted: true },
    { id: 'archived', label: '已归档', isCompleted: true },
    { id: '__other__', label: '其他', isCompleted: false },  // 特殊状态，用于未定义的状态
];

/**
 * 默认任务状态配置（完整）
 */
export const DEFAULT_STATUS_CONFIG: TaskStatusConfig = {
    statuses: DEFAULT_TASK_STATUSES,
    visibleColumns: ['todo', 'in-progress', 'review', 'done'],
    defaultStatus: 'todo',
};

/**
 * 获取状态配置（如果没有配置则返回默认配置）
 */
export function getStatusConfig(config?: TaskStatusConfig): TaskStatusConfig {
    if (!config || !config.statuses || config.statuses.length === 0) {
        return DEFAULT_STATUS_CONFIG;
    }
    return config;
}

/**
 * 根据状态 ID 获取状态定义
 */
export function getStatusDefinition(
    statusId: string,
    config?: TaskStatusConfig
): TaskStatusDefinition | undefined {
    const statusConfig = getStatusConfig(config);
    return statusConfig.statuses.find(s => s.id === statusId);
}

/**
 * 获取状态的展示标签
 */
export function getStatusLabel(
    statusId: string,
    config?: TaskStatusConfig
): string {
    const def = getStatusDefinition(statusId, config);
    return def ? def.label : statusId;
}

/**
 * 检查状态是否为完成态
 */
export function isStatusCompleted(
    statusId: string,
    config?: TaskStatusConfig
): boolean {
    const def = getStatusDefinition(statusId, config);
    return def ? def.isCompleted : false;
}

/**
 * 获取所有可见的状态列
 */
export function getVisibleStatuses(config?: TaskStatusConfig): TaskStatusDefinition[] {
    const statusConfig = getStatusConfig(config);
    return statusConfig.statuses.filter(s =>
        statusConfig.visibleColumns.includes(s.id)
    );
}

/**
 * 验证状态配置的有效性
 */
export function validateStatusConfig(config: TaskStatusConfig): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // 检查是否有状态定义
    if (!config.statuses || config.statuses.length === 0) {
        errors.push('至少需要一个状态定义');
    }

    // 检查状态 ID 唯一性
    const ids = new Set<string>();
    for (const status of config.statuses) {
        if (!status.id) {
            errors.push('状态 ID 不能为空');
        } else if (ids.has(status.id)) {
            errors.push(`状态 ID "${status.id}" 重复`);
        } else {
            ids.add(status.id);
        }

        // 检查标签
        if (!status.label) {
            errors.push(`状态 "${status.id}" 缺少展示标签`);
        }
    }

    // 检查默认状态是否存在
    if (!config.defaultStatus) {
        errors.push('必须指定默认状态');
    } else if (!ids.has(config.defaultStatus)) {
        errors.push(`默认状态 "${config.defaultStatus}" 不存在`);
    }

    // 检查可见列中的状态是否都存在
    for (const colId of config.visibleColumns) {
        if (!ids.has(colId)) {
            errors.push(`可见列中的状态 "${colId}" 不存在`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

