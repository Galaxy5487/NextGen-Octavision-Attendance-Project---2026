import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

function apiDevServerPlugin(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      // Ensure process.env has .env.local & vercel.json env vars
      try {
        const envLocalPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envLocalPath)) {
          const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx > 0) {
              const k = trimmed.slice(0, idx).trim();
              const v = trimmed.slice(idx + 1).trim();
              if (!process.env[k]) process.env[k] = v;
            }
          }
        }
        const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
        if (fs.existsSync(vercelJsonPath)) {
          const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
          if (vercelJson.env) {
            for (const [k, v] of Object.entries(vercelJson.env)) {
              if (!process.env[k]) process.env[k] = String(v);
            }
          }
        }
      } catch {}

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        try {
          const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const apiName = parsedUrl.pathname.replace(/^\/api\//, '').split('/')[0];
          const filePath = path.resolve(process.cwd(), 'api', `${apiName}.js`);

          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `API endpoint /api/${apiName} not found` }));
          }

          // Populate query params
          (req as any).query = Object.fromEntries(parsedUrl.searchParams.entries());

          // Read body if method has body
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(chunk as Buffer);
            }
            const rawBody = Buffer.concat(buffers).toString('utf-8');
            try {
              (req as any).body = rawBody ? JSON.parse(rawBody) : {};
            } catch {
              (req as any).body = rawBody;
            }
          }

          // Add Vercel response helper methods
          (res as any).status = (code: number) => {
            res.statusCode = code;
            return res;
          };
          (res as any).json = (obj: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
            return res;
          };
          (res as any).send = (data: any) => {
            if (typeof data === 'object') return (res as any).json(data);
            res.end(String(data));
            return res;
          };

          // Load module via ssrLoadModule
          const mod = await server.ssrLoadModule(filePath);
          if (typeof mod.default === 'function') {
            await mod.default(req, res);
          } else {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Module /api/${apiName}.js has no default export function` }));
          }
        } catch (err: any) {
          console.error(`[API Dev Server Error] ${req.url}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal API Error' }));
          }
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins: any[] = [react(), tailwindcss(), apiDevServerPlugin()];
  if (fs.existsSync(path.resolve(process.cwd(), '.vite-source-tags.js'))) {
    try {
      // @ts-ignore
      const m = await import('./.vite-source-tags.js');
      if (m && typeof m.sourceTags === 'function') {
        plugins.push(m.sourceTags());
      }
    } catch {}
  }

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
  };
})

