import { useState, useEffect, useCallback } from 'react';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 分鐘

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkUpdate = useCallback(async () => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.buildTime && data.buildTime !== __APP_BUILD_TIME__) {
        setUpdateAvailable(true);
      }
    } catch {
      // 網路錯誤時靜默忽略
    }
  }, []);

  useEffect(() => {
    // 開發環境不輪詢（沒有 version.json）
    if (import.meta.env.DEV) return;

    checkUpdate();
    const id = setInterval(checkUpdate, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkUpdate]);

  return { updateAvailable };
}
