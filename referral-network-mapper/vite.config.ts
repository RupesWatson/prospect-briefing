import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, /api/ch forwards to Companies House directly.
      // In production (Vercel), the api/ch.ts edge function handles it instead.
      '/api/ch': {
        target: 'https://api.company-information.service.gov.uk',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            // Extract the chPath param and set it as the actual forwarded path
            const rawUrl: string = req.url || '';
            const qs = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
            const params = new URLSearchParams(qs);
            const chPath = params.get('chPath') || '/';
            proxyReq.path = chPath;

            // Convert x-ch-key header → Authorization: Basic …
            const key: string = (req.headers['x-ch-key'] as string) || '';
            if (key) {
              const auth = Buffer.from(`${key}:`).toString('base64');
              proxyReq.setHeader('Authorization', `Basic ${auth}`);
              proxyReq.removeHeader('x-ch-key');
            }
          });
        },
      },
    },
  },
})
