# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.db.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.db.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: Supabase gateway the studio uses for auth, entities, and function calls.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- The studio reads and writes through Supabase. `src/api/base44Client.js` expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
- Local development is `npm run dev` against the local Supabase stack. Pointing those variables at a hosted project writes that project's data.
- `base44 dev` is not the data path for this app. The Vite plugin still warns when `VITE_BASE44_APP_BASE_URL` is unset; entity calls do not use that proxy.
- `base44/config.jsonc` sets `site.serveCommand` to `npm run dev`.
- Reuse the existing client and Vite plugin patterns before adding new Base44 integration paths.
- Run `npm run lint` and `npm run build` before finishing code changes. `npm run typecheck` currently fails on existing TypeScript errors in the app.

## Cursor Cloud

- Install installs Docker (`docker.io`, `fuse-overlayfs`, legacy iptables) and runs `npm ci`. Node 22 is already on the image.
- Start launches dockerd with the fuse-overlayfs storage driver, a local Supabase project in `~/musicpromo-supabase` (Postgres, Auth, REST, and Storage). Studio, analytics, realtime, pooler, and Edge Functions stay off. It applies `supabase/schema.sql` once, writes `.env.local`, and serves Vite at http://127.0.0.1:5173.
- Email/password sign-in and entity saves work on that database. The saved local database includes `cloudagent@example.com` / `password123` and an artist named Cloud Agent.
- Handle checks, AI, billing, and OAuth call Edge Functions, which this local stack does not run.
- Do not commit `.env.local`.
