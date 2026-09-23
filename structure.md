# structure.md

```text
.
├── .railway/
│   └── railway.ts
├── apps/
│   ├── fumadocs/
│   │   ├── content/
│   │   │   └── docs/
│   │   │       └── index.mdx
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (home)/
│   │   │   │   ├── api/
│   │   │   │   └── docs/
│   │   │   ├── components/
│   │   │   │   └── mdx.tsx
│   │   │   └── lib/
│   │   │       ├── layout.shared.tsx
│   │   │       └── source.ts
│   │   ├── next.config.mjs
│   │   └── package.json
│   ├── server/
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── asset-discovery/
│   │   │   │   │   └── server/
│   │   │   │   ├── asset-families/
│   │   │   │   │   └── server/
│   │   │   │   ├── asset-records/
│   │   │   │   │   └── server/
│   │   │   │   ├── asset-versions/
│   │   │   │   │   └── server/
│   │   │   │   ├── background-operations/
│   │   │   │   │   └── server/
│   │   │   │   ├── background-parallax-profile/
│   │   │   │   │   └── server/
│   │   │   │   ├── character-animation-profile/
│   │   │   │   │   └── server/
│   │   │   │   ├── delivery-fulfilment/
│   │   │   │   │   └── server/
│   │   │   │   ├── delivery-refresh/
│   │   │   │   │   └── server/
│   │   │   │   ├── delivery-targets/
│   │   │   │   │   └── server/
│   │   │   │   ├── external-visual-analysis/
│   │   │   │   │   └── server/
│   │   │   │   ├── export-bundles/
│   │   │   │   │   └── server/
│   │   │   │   ├── family-readiness/
│   │   │   │   │   └── server/
│   │   │   │   ├── gameplay-metadata/
│   │   │   │   │   └── server/
│   │   │   │   ├── icon-profile/
│   │   │   │   │   └── server/
│   │   │   │   ├── imports/
│   │   │   │   │   └── server/
│   │   │   │   ├── object-equipment-profile/
│   │   │   │   │   └── server/
│   │   │   │   ├── offline-staged-work/
│   │   │   │   │   └── server/
│   │   │   │   ├── permanent-erasure/
│   │   │   │   │   └── server/
│   │   │   │   ├── portrait-marketing-profile/
│   │   │   │   │   └── server/
│   │   │   │   ├── production-experiments/
│   │   │   │   │   └── server/
│   │   │   │   ├── production-recipes/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-archives/
│   │   │   │   │   └── server/
│   │   │   │   ├── project-context/
│   │   │   │   │   └── server/
│   │   │   │   ├── projects/
│   │   │   │   │   └── server/
│   │   │   │   │       ├── project-access-store.ts
│   │   │   │   │       └── project-routes.ts
│   │   │   │   ├── quality-evidence/
│   │   │   │   │   └── server/
│   │   │   │   ├── reference-production/
│   │   │   │   │   └── server/
│   │   │   │   ├── rights-evidence/
│   │   │   │   │   └── server/
│   │   │   │   ├── reviews/
│   │   │   │   │   └── server/
│   │   │   │   ├── runtime-validation/
│   │   │   │   │   └── server/
│   │   │   │   ├── tileset-texture-profile/
│   │   │   │   │   └── server/
│   │   │   │   ├── ui-profile/
│   │   │   │   │   └── server/
│   │   │   │   ├── vfx-profile/
│   │   │   │   │   └── server/
│   │   │   │   └── visual-worlds/
│   │   │   │       └── server/
│   │   │   ├── cloudflare.ts
│   │   │   ├── context.ts
│   │   │   ├── env.server.ts
│   │   │   ├── env.ts
│   │   │   ├── index.ts
│   │   │   ├── output-contracts.ts
│   │   │   ├── project-context-store.ts
│   │   │   ├── services.ts
│   │   │   └── worker.ts
│   │   ├── .env.schema
│   │   ├── bunfig.toml
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsdown.config.ts
│   └── web/
│       ├── desktop-e2e/
│       │   └── app-shell.spec.ts
│       ├── e2e/
│       │   └── app-shell.spec.ts
│       ├── src/
│       │   ├── components/
│       │   │   ├── header.tsx
│       │   │   ├── loader.tsx
│       │   │   ├── mode-toggle.tsx
│       │   │   └── theme-provider.tsx
│       │   ├── features/
│       │   │   ├── account-access/
│       │   │   │   └── ui/
│       │   │   │       └── forms/
│       │   │   ├── asset-discovery/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── asset-families/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── asset-records/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── asset-versions/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── background-operations/
│       │   │   │   ├── hooks/
│       │   │   │   └── ui/
│       │   │   │       └── views/
│       │   │   ├── background-parallax-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── character-animation-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── delivery-fulfilment/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── delivery-refresh/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── delivery-targets/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── external-visual-analysis/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── export-bundles/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── family-readiness/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── gameplay-metadata/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── icon-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── imports/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── object-equipment-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── offline-staged-work/
│       │   │   │   ├── lib/
│       │   │   │   ├── store/
│       │   │   │   └── ui/
│       │   │   │       └── views/
│       │   │   ├── permanent-erasure/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── pixel-editor/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── portrait-marketing-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── production-experiments/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── production-recipes/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── project-archives/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── project-context/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── projects/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── quality-evidence/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── reference-production/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── reviews/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── rights-evidence/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── runtime-validation/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── scene-qa-playground/
│       │   │   │   └── ui/
│       │   │   │       ├── components/
│       │   │   │       └── views/
│       │   │   ├── tileset-texture-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── ui-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   ├── vfx-profile/
│       │   │   │   └── ui/
│       │   │   │       ├── forms/
│       │   │   │       └── views/
│       │   │   └── visual-worlds/
│       │   │       └── ui/
│       │   │           ├── forms/
│       │   │           └── views/
│       │   ├── lib/
│       │   │   └── auth-client.ts
│       │   ├── routes/
│       │   │   ├── _auth/
│       │   │   │   ├── context-proposals.tsx
│       │   │   │   ├── dashboard.tsx
│       │   │   │   └── route.tsx
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx
│       │   │   └── login.tsx
│       │   ├── utils/
│       │   │   └── orpc.ts
│       │   ├── env.ts
│       │   ├── index.css
│       │   ├── main.tsx
│       │   └── routeTree.gen.ts
│       ├── src-tauri/
│       │   ├── capabilities/
│       │   ├── icons/
│       │   ├── src/
│       │   │   ├── lib.rs
│       │   │   └── main.rs
│       │   ├── Cargo.lock
│       │   ├── Cargo.toml
│       │   ├── build.rs
│       │   ├── tauri.conf.json
│       │   └── tauri.test.conf.json
│       ├── .env.schema
│       ├── bunfig.toml
│       ├── components.json
│       ├── index.html
│       ├── package.json
│       ├── playwright.config.ts
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       └── wdio.conf.ts
├── cloudflare/
│   └── r2-cors.example.json
├── docs/
│   ├── adr/
│   ├── agents/
│   ├── prd/
│   ├── workflow/
│   ├── CONTEXT.md
│   ├── deployment.md
│   ├── prd.md
│   └── tech-stack.md
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routers/
│   │   │   ├── context.ts
│   │   │   ├── project-access-policy.ts
│   │   │   ├── project-access-store.ts
│   │   │   ├── project-context.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── auth/
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── config/
│   │   ├── package.json
│   │   └── tsconfig.base.json
│   ├── db/
│   │   ├── src/
│   │   │   ├── migrations/
│   │   │   ├── schema/
│   │   │   ├── project-access.ts
│   │   │   ├── project-context.ts
│   │   │   ├── config.ts
│   │   │   ├── env.ts
│   │   │   ├── index.ts
│   │   │   ├── relations.ts
│   │   │   └── neon.test.ts
│   │   ├── .env.schema
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── ui/
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── styles/
│       ├── package.json
│       └── postcss.config.mjs
├── .gitignore
├── AGENTS.md
├── README.md
├── biome.json
├── bts.jsonc
├── bun.lock
├── bunfig.toml
├── lefthook.yml
├── package.json
├── tsconfig.json
└── turbo.json
```
