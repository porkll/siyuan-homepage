/**
 * 通用工具函数
 */

import { fetchPost } from 'siyuan';

/**
 * 生成 UUID
 */
export function generateUUID(): string {
    return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
}

/**
 * 深拷贝工具函数 - 用于防止配置对象引用共享
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj) as T;
    if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as T;

    const cloned = {} as T;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * 深度合并对象
 * 用于合并配置时保留嵌套对象结构
 *
 * @param target 目标对象（默认值）
 * @param source 源对象（用户配置）
 * @returns 合并后的对象
 *
 * @example
 * const defaults = { a: 1, b: { c: 2, d: 3 } };
 * const config = { b: { c: 4 } };
 * deepMerge(defaults, config); // { a: 1, b: { c: 4, d: 3 } }
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (sourceValue !== undefined) {
            if (Array.isArray(sourceValue)) {
                // 数组直接替换
                result[key] = sourceValue as any;
            } else if (typeof sourceValue === 'object' && sourceValue !== null && !isDateValue(sourceValue)) {
                // 对象递归合并
                result[key] = deepMerge(targetValue as any, sourceValue as any);
            } else {
                // 基本类型直接替换
                result[key] = sourceValue as any;
            }
        }
    }

    return result;
}

/**
 * 判断值是否为日期对象或日期字符串
 *
 * @param value 要判断的值
 * @returns 是否为日期
 */
export function isDateValue(value: any): boolean {
    if (value instanceof Date) return true;

    // 更严格的日期字符串检查（仅接受 ISO 8601 格式）
    if (typeof value === 'string') {
        const date = new Date(value);
        // 验证是否为有效日期 && 是否符合 ISO 8601 格式
        return date instanceof Date && !isNaN(date.getTime()) &&
               /^\d{4}-\d{2}-\d{2}/.test(value);
    }

    return false;
}

/**
 * Promise 包装 fetchPost
 * 将 SiYuan 的 callback 风格 API 转换为 Promise 风格
 *
 * @param url API 路径
 * @param data 请求数据
 * @returns Promise<response>
 *
 * @example
 * const result = await fetchPostAsync('/api/query/sql', { stmt: 'SELECT * FROM blocks' });
 */
export function fetchPostAsync(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
        fetchPost(url, data, (response) => {
            if (response && response.code === 0) {
                resolve(response);
            } else {
                reject(new Error(response?.msg || `Request failed: ${url}`));
            }
        });
    });
}
