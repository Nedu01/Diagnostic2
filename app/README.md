# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Admin dashboard

`/admin` shows funnel numbers, result patterns, traffic sources, and recent
Systeme.io leads. Setup:

1. Create a free Postgres database at neon.tech and run `db/schema.sql` in its
   SQL editor (once per database).
2. Environment variables (in `.env.local` locally; in Vercel project settings
   in production):
   - `DATABASE_URL` — the Neon connection string
   - `ADMIN_PASSWORD` — the dashboard password
   - `ADMIN_SESSION_SECRET` — any long random string; signs the 30-day session,
     and is also required for event recording — IP hashing for rate limits
     fails closed without it
   - `SYSTEME_API_KEY` — already used by /api/subscribe; also powers the leads list

Anonymous quiz events (never emails, names, or raw answers — result bands
only) are recorded via `/api/events` into the `events` table.
