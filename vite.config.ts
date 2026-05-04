import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
  return {
    base: '/',
    server: {
      port: 3000,
      host: 'localhost',
    },
    plugins: [react(), tailwindcss()],
    define: {
      // LLM API keys 已遷移至 Cloud Functions（functions/src/index.ts）
      // 前端僅持有 Firebase 公鑰，所有 LLM 呼叫透過 httpsCallable 走後端 proxy
      '__APP_BUILD_TIME__': JSON.stringify(process.env.VITE_APP_BUILD_TIME || new Date().toISOString()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
