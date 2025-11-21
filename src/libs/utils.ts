/**
 * 通用工具函数
 */

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
