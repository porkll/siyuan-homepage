/**
 * 快速笔记工具函数
 * 提供快速笔记的创建、查询等功能
 */

import type { QuickNoteConfig } from '@/types/quick-note';
import { fetchPostAsync } from '@/libs/utils';

/**
 * 自定义属性常量
 */
export const QUICK_NOTE_ATTRS = {
    /** 快速笔记标题标记 */
    HEADING: 'custom-daily-quick-note',
    /** 快速笔记条目标记 */
    NOTE: 'custom-quick-note'
} as const;

/**
 * 默认配置
 */
export const DEFAULT_QUICK_NOTE_CONFIG: QuickNoteConfig = {
    notebookId: '',
    enableEnterToSend: false,
    headingName: '快速笔记'
};

/**
 * 使用 SQL 查询查找快速笔记标题
 * @param docId 日记文档 ID
 * @returns 标题块 ID，如果不存在返回 null
 */
export async function findQuickNoteHeading(docId: string): Promise<string | null> {
    try {
        const sql = `
            SELECT b.id FROM blocks b
            WHERE b.root_id = '${docId}'
            AND b.type = 'h'
            AND b.id IN (
                SELECT block_id FROM attributes
                WHERE name = '${QUICK_NOTE_ATTRS.HEADING}' AND value = 'true'
            )
            LIMIT 1
        `;

        const result = await fetchPostAsync('/api/query/sql', { stmt: sql });
        return result?.data?.[0]?.id || null;
    } catch (error) {
        console.error('查找快速笔记标题失败:', error);
        return null;
    }
}

/**
 * 创建快速笔记标题
 * @param docId 日记文档 ID
 * @param headingName 标题名称
 * @returns 创建的标题块 ID
 */
export async function createQuickNoteHeading(docId: string, headingName: string): Promise<string> {
    try {
        // 1. 在文档开头创建二级标题
        const result = await fetchPostAsync('/api/block/prependBlock', {
            dataType: 'markdown',
            data: `## ${headingName}`,
            parentID: docId
        });

        const headingId = result.data[0].doOperations[0].id;

        // 2. 设置自定义属性标记
        await fetchPostAsync('/api/attr/setBlockAttrs', {
            id: headingId,
            attrs: {
                [QUICK_NOTE_ATTRS.HEADING]: 'true'
            }
        });

        return headingId;
    } catch (error) {
        console.error('创建快速笔记标题失败:', error);
        throw error;
    }
}

/**
 * 添加快速笔记条目
 * @param headingId 快速笔记标题块 ID
 * @param content 笔记内容
 * @returns 创建的笔记块 ID
 */
export async function addQuickNote(headingId: string, content: string): Promise<string> {
    try {
        // 1. 在标题下添加列表项
        const result = await fetchPostAsync('/api/block/appendBlock', {
            dataType: 'markdown',
            data: `- ${content}`,
            parentID: headingId
        });

        const noteId = result.data[0].doOperations[0].id;

        // 2. 设置自定义属性标记（方便 SQL 查询）
        await fetchPostAsync('/api/attr/setBlockAttrs', {
            id: noteId,
            attrs: {
                [QUICK_NOTE_ATTRS.NOTE]: 'true'
            }
        });

        return noteId;
    } catch (error) {
        console.error('添加快速笔记失败:', error);
        throw error;
    }
}
