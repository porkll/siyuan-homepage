/**
 * 快速笔记工具函数
 * 提供快速笔记的创建、查询等功能
 */

import type { QuickNoteConfig, FileCard } from '@/types/quick-note';
import { fetchPostAsync } from '@/libs/utils';
import { createDailyNote } from '@/api';

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
    headingName: '快速笔记',
    selectedFileId: 'daily',
    pinnedFileIds: []
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

/**
 * 获取所有笔记本中最近修改的文档
 * @param limit 返回数量限制
 * @param excludeIds 排除的文档 ID 列表
 * @returns 最近修改的文档列表
 */
export async function getRecentDocuments(
    limit: number = 10,
    excludeIds: string[] = []
): Promise<FileCard[]> {
    try {
        const excludeClause = excludeIds.length > 0
            ? `AND b.id NOT IN ('${excludeIds.join("','")}')`
            : '';

        const sql = `
            SELECT b.id, b.content, b.hpath, b.updated
            FROM blocks b
            WHERE b.type = 'd'
            ${excludeClause}
            ORDER BY b.updated DESC
            LIMIT ${limit}
        `;

        const result = await fetchPostAsync('/api/query/sql', { stmt: sql });

        return (result?.data || []).map(doc => ({
            id: doc.id,
            name: doc.content,
            path: doc.hpath,
            isPinned: false,
            isDaily: false,
            lastModified: doc.updated
        }));
    } catch (error) {
        console.error('获取最近文档失败:', error);
        return [];
    }
}

/**
 * 根据 ID 列表获取文档信息
 */
async function getDocumentsByIds(docIds: string[]): Promise<FileCard[]> {
    if (docIds.length === 0) return [];

    try {
        const sql = `
            SELECT b.id, b.content, b.hpath, b.updated
            FROM blocks b
            WHERE b.id IN ('${docIds.join("','")}')
            AND b.type = 'd'
        `;

        const result = await fetchPostAsync('/api/query/sql', { stmt: sql });

        return (result?.data || []).map(doc => ({
            id: doc.id,
            name: doc.content,
            path: doc.hpath,
            isPinned: false,
            isDaily: false,
            lastModified: doc.updated
        }));
    } catch (error) {
        console.error('获取文档信息失败:', error);
        return [];
    }
}

/**
 * 构建完整的文件卡片列表
 * @param config 快速笔记配置
 * @returns 排序后的文件卡片列表
 */
export async function buildFileCardList(config: QuickNoteConfig): Promise<FileCard[]> {
    const cards: FileCard[] = [];

    // 1. 添加日记卡片（固定第一位）
    cards.push({
        id: 'daily',
        name: '日记',
        path: '/日记',
        isPinned: true,
        isDaily: true
    });

    // 2. 添加钉选的文件
    if (config.pinnedFileIds.length > 0) {
        const pinnedDocs = await getDocumentsByIds(config.pinnedFileIds);
        cards.push(...pinnedDocs.map(doc => ({ ...doc, isPinned: true })));
    }

    // 3. 添加最近文件（排除已钉选的，避免重复）
    const excludeIds = config.pinnedFileIds;
    const recentDocs = await getRecentDocuments(10, excludeIds);
    cards.push(...recentDocs);

    return cards;
}

/**
 * 添加快速笔记到指定文件
 * @param fileId 目标文件 ID（'daily' 表示日记）
 * @param content 笔记内容
 * @param config 快速笔记配置
 */
export async function addQuickNoteToFile(
    fileId: string,
    content: string,
    config: QuickNoteConfig
): Promise<void> {
    let targetDocId: string;

    // 如果是日记，创建或获取今日日记
    if (fileId === 'daily') {
        const dailyNote = await createDailyNote(config.notebookId);
        targetDocId = dailyNote.id;
    } else {
        targetDocId = fileId;
    }

    // 查找或创建快速笔记标题
    let headingId = await findQuickNoteHeading(targetDocId);
    if (!headingId) {
        headingId = await createQuickNoteHeading(targetDocId, config.headingName);
    }

    // 添加笔记
    await addQuickNote(headingId, content);
}
