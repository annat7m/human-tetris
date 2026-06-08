<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Project Context

## Scaffolding

- App name: `body-blocks`
- Exact TanStack CLI command used:
  `npx @tanstack/cli@latest create body-blocks --agent --tailwind --add-ons cloudflare`
- Follow-up TanStack Intent commands run:
  - `npx @tanstack/intent@latest install`
  - `npx @tanstack/intent@latest list`
- Template intent: Blank/base TanStack Start scaffold.
- Note: the CLI reported that `--tailwind` is deprecated and ignored because Tailwind is enabled by default in TanStack Start scaffolds.

## Chosen Stack and Integrations

- Framework: TanStack Start with React 19 and TypeScript.
- Routing: TanStack Router file-based routes in `src/routes`; generated route tree is imported from `src/routeTree.gen` by `src/router.tsx`.
- Styling: Tailwind CSS v4 via `@tailwindcss/vite`; keep Tailwind enabled.
- Deployment target: Cloudflare Workers via `@cloudflare/vite-plugin`, `wrangler`, and `wrangler.jsonc`.
- Devtools: TanStack Devtools plus TanStack Router Devtools are scaffolded and stripped from production builds by `@tanstack/devtools-vite`.
- Tests: Vitest is installed; there are no test files yet.
- Package manager: pnpm (`packageManager: pnpm@11.5.2`); keep `pnpm-lock.yaml` as the canonical lockfile.

## Commands

- Install dependencies: `pnpm install`
- Start dev server: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test`
- Deploy: `pnpm deploy`
- Inspect local TanStack Intent skills: `pnpm dlx @tanstack/intent@latest list`
- Load relevant skill before TanStack-specific work: `pnpm dlx @tanstack/intent@latest load <package>#<skill>`

## Environment Variables

- No application-specific environment variables are required yet.
- Cloudflare secrets should be added with `pnpm exec wrangler secret put <NAME>`.
- Public, non-secret Cloudflare Worker vars belong in `wrangler.jsonc` under `vars`.
- Client-exposed Vite env vars must use the `VITE_` prefix; do not expose secrets through client env vars.

## Deployment Notes

- Worker name is `body-blocks` in `wrangler.jsonc`.
- `wrangler.jsonc` uses `compatibility_flags: ["nodejs_compat"]` and `main: "@tanstack/react-start/server-entry"`.
- The Cloudflare Vite plugin is configured for TanStack Start SSR with `viteEnvironment: { name: 'ssr' }`.
- Run `pnpm exec wrangler login` before the first deployment.
- `pnpm deploy` runs `pnpm build && wrangler deploy`.

## Architectural Decisions

- Keep the app minimal: use only the scaffolded React/TanStack Start/Tailwind/Cloudflare essentials.
- Keep file-based routing under `src/routes`; add new pages as route files rather than a custom router tree unless a loaded Intent skill says otherwise.
- Keep `devtools()` first in `vite.config.ts`, matching the shipped devtools skill guidance.
- Keep `tanstackStart()` before `viteReact()` in `vite.config.ts`, matching the React Start skill guidance.
- `src/routes/__root.tsx` owns the document shell and must include `HeadContent` in `<head>` and `Scripts` in `<body>`.
- Server-only logic should use TanStack Start server APIs such as `createServerFn`; do not put secrets in isomorphic route loaders or client code.

## Known Gotchas

- The scaffolding command installed with npm initially; this repo was converted to pnpm by removing `package-lock.json`, generating `pnpm-lock.yaml`, adding `packageManager`, and updating `.cta.json`.
- pnpm 11 does not read the old `package.json#pnpm.onlyBuiltDependencies` field; build approvals are tracked in `pnpm-workspace.yaml` via `allowBuilds`.
- Vitest 4 injects SSR externals that conflict with the Cloudflare Vite plugin. `vite.config.ts` skips the Cloudflare plugin when `mode === 'test'` or `process.env.VITEST === 'true'`; use Cloudflare's Workers Vitest integration later if Worker-runtime tests are needed.
- The installed devtools Vite skill mentions Vite `^6 || ^7`; this scaffold currently resolves Vite 8 and `pnpm build` passes. Re-check local Intent/package guidance if devtools behavior changes.
- Current `pnpm test` passes with no tests because the script uses `--passWithNoTests`.

## Next Steps

- Customize `src/routes/index.tsx`, `src/components/Header.tsx`, and `src/components/Footer.tsx` for the product.
- Add app routes under `src/routes`.
- Add `.env.example` when the first environment variable is introduced.
- Add real Vitest tests when functionality is implemented.
- Before TanStack-specific changes, run `pnpm dlx @tanstack/intent@latest list` and load the relevant local skill.
