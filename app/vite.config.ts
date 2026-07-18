/// <reference types="vitest/config" />
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// In production /api/subscribe is a Vercel function; `vite dev` doesn't serve
// those, so this plugin mounts it on the dev server. With SYSTEME_API_KEY set
// (e.g. in app/.env.local) it runs the real handler; without it, requests are
// validated and logged but no lead is sent.
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      for (const key of ['SYSTEME_API_KEY', 'DATABASE_URL', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }
      const routes: Record<string, string> = {
        '/api/subscribe': '/api/subscribe.ts',
        '/api/events': '/api/events.ts',
        '/api/admin/login': '/api/admin/login.ts',
        '/api/admin/stats': '/api/admin/stats.ts',
      }
      for (const [route, modulePath] of Object.entries(routes)) {
        server.middlewares.use(route, (req: IncomingMessage, res: ServerResponse) => {
          void (async () => {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            let body: unknown = {}
            try {
              body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
            } catch {
              // fall through with an empty body; handlers reject it
            }
            const send = (status: number, payload: unknown) => {
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            }
            // vite strips the mount prefix from req.url; what remains is query string
            const query = Object.fromEntries(
              new URL(req.url ?? '', 'http://localhost').searchParams,
            )

            if (route === '/api/subscribe' && !process.env.SYSTEME_API_KEY) {
              if (req.method !== 'POST') return send(405, { ok: false, error: 'method_not_allowed' })
              const { email, firstName } = (body ?? {}) as { email?: string; firstName?: string }
              if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
                return send(400, { ok: false, error: 'invalid_email' })
              }
              console.log(
                `[dev-api] mock subscribe accepted for ${firstName ? `${firstName} <${email}>` : email} — set SYSTEME_API_KEY in app/.env.local to send real leads`,
              )
              return send(200, { ok: true })
            }

            const mod = await server.ssrLoadModule(modulePath)
            const vercelReq = Object.assign(req, { body, query })
            const vercelRes = {
              status: (code: number) => ({ json: (payload: unknown) => send(code, payload) }),
            }
            await mod.default(vercelReq, vercelRes)
          })().catch((err) => {
            console.error(`[dev-api] ${route} failed:`, err)
            if (!res.writableEnded) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'provider_error' }))
            }
          })
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, __dirname, ''))],
  resolve: {
    alias: {
      '@config': path.resolve(__dirname, '../content/diagnostic-config.json'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
}))
