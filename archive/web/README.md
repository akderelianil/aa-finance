# aa-finance web

React 19 + Vite 8 + TypeScript + Tailwind 4 + shadcn/ui (base-ui), TanStack Query, react-router 8, i18next (TR/EN), PWA (vite-plugin-pwa).

```
npm install
npm run dev     # geliştirme
npm run build   # tsc -b + vite build
npm run lint    # oxlint
```

Ortam değişkenleri `.env.local` içinde (repoya girmez): `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY`. service_role anahtarı asla frontend'e girmez.

Proje geneli: `../CLAUDE.md`, `../docs/ARCHITECTURE.md`, `../docs/DEVELOPMENT.md`.
