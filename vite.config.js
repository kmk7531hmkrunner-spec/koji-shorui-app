import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // 全てのIPからのアクセスを許可
    allowedHosts: true, // Cloudflareなどの外部トンネルからのアクセスを許可
    cors: true
  }
});
