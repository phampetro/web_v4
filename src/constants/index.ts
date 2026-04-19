export const THU_LIST = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Tự động tạo Options từ THU_LIST
export const THU_OPTIONS = THU_LIST.map((v) => ({ label: v, value: v }));

export const DEFAULT_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [100, 500, 1000];

export const CACHE_META_STORE = 'cache_meta';
