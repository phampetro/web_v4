import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { getStoreData, setStoreData, getCacheMeta, setCacheMeta } from '../utils/indexedDB';
import { getCookie } from '../utils/cookie';

interface UseCachedDataProps<T> {
  storeName: string;
  cacheKey: string;
  apiPath: string;
  ngayUpdate: string;
  setNgayUpdate?: (d: string) => void;
}

export function useCachedData<T>({
  storeName,
  cacheKey,
  apiPath,
  ngayUpdate,
  setNgayUpdate,
}: UseCachedDataProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFromAPI = useCallback(async (newNgayUpdate?: string) => {
    setLoading(true);
    try {
      // Ưu tiên lấy Quyen_QL từ IndexedDB (đã được fetch tập trung ở HomePage)
      let quyenQL = (await getCacheMeta('common_quyen_dl')) || '';
      
      // Fallback: Nếu cache trống mới lấy từ localStorage
      if (!quyenQL) {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          quyenQL = userInfo.quyenDL || '';
        }
      }
      const separator = apiPath.includes('?') ? '&' : '?';
      const res = await fetch(`${apiPath}${separator}quyen_dl=${encodeURIComponent(quyenQL)}`);
      const json = await res.json();
      
      if (json.data) {
        setData(json.data);
        await setStoreData(storeName, json.data);
        
        const dateToSave = newNgayUpdate || json.ngayUpdate || ngayUpdate;
        if (dateToSave) {
          await setCacheMeta(cacheKey, dateToSave);
          if (setNgayUpdate) setNgayUpdate(dateToSave);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      message.error('Lỗi tải dữ liệu từ máy chủ');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath, cacheKey, ngayUpdate, setNgayUpdate, storeName]);

  const reloadData = useCallback(async () => {
    setLoading(true);
    try {
      const metaNgay = await getCacheMeta(cacheKey);
      let quyenQL = (await getCacheMeta('common_quyen_dl')) || '';
      
      if (!quyenQL) {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          quyenQL = userInfo.quyenDL || '';
        }
      }

      const res = await fetch(`${apiPath}?quyen_dl=${encodeURIComponent(quyenQL)}&checkOnly=true`);
      const json = await res.json();

      const serverNgayUpdate = json.ngayUpdate;
      const isLatest = metaNgay === serverNgayUpdate;

      if (isLatest && metaNgay) {
        const cachedData = await getStoreData<T>(storeName);
        if (cachedData.length > 0) {
          setData(cachedData);
          setLoading(false);
          return { updated: false, serverNgayUpdate };
        }
      }

      await fetchFromAPI(serverNgayUpdate);
      return { updated: true, serverNgayUpdate };
    } catch (error) {
      console.error('Lỗi kiểm tra cache:', error);
      const cachedData = await getStoreData<T>(storeName);
      setData(cachedData);
      return { updated: false, error: true };
    } finally {
      setLoading(false);
    }
  }, [apiPath, cacheKey, fetchFromAPI, storeName]);

  const forceReload = useCallback(async () => {
    // Bây giờ forceReload chỉ đơn giản là gọi fetchFromAPI trực tiếp không cần hỏi
    await fetchFromAPI();
    return { updated: true };
  }, [fetchFromAPI]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  return {
    data,
    setData,
    loading,
    reloadData,
    forceReload
  };
}
