/**
 * 文件卡片信息
 */
export interface FileCard {
    /** 文件块 ID，'daily' 表示日记 */
    id: string;
    /** 文件名称 */
    name: string;
    /** 文件路径（用于显示） */
    path: string;
    /** 是否钉选 */
    isPinned: boolean;
    /** 是否为日记特殊卡片 */
    isDaily: boolean;
    /** 最后修改时间（毫秒时间戳） */
    lastModified?: number;
}

/**
 * 快速笔记配置
 */
export interface QuickNoteConfig {
    /** 日记笔记本 ID */
    notebookId: string;
    /** 是否启用回车发送（默认 false，Shift+Enter 换行） */
    enableEnterToSend: boolean;
    /** 快速笔记标题名称 */
    headingName: string;
    /** 当前选中的目标文件 ID */
    selectedFileId: string;
    /** 钉选的文件 ID 列表 */
    pinnedFileIds: string[];
}
