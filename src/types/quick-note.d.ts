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
}
