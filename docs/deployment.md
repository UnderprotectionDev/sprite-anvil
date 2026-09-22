# Deployment wiring

Railway infrastructure is defined in `.railway/railway.ts`. The app service builds the React site and Hono API together; Hono serves `apps/web/dist` and exposes `/health`. The worker service runs the Cloudflare Queues HTTP pull consumer. Both services use Railpack.

Connect both Railway services to this repository, then run `railway config plan` and review the proposed changes before applying them. This repository has no Git remote or linked Railway project, so service sources and domains cannot be inferred here.

Set `NODE_ENV=production`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `CORS_ORIGIN` on the app. Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_QUEUE_ID`, `CLOUDFLARE_QUEUES_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` on both services. The worker also needs the existing server environment schema values because it imports that schema. Set `VITE_SERVER_URL` to the public app URL for the web build. R2 bucket CORS must permit `PUT` from that app origin with the `Content-Type` header. Enable HTTP pull on the Cloudflare queue and use a token with Queues read and write permissions.

Copy `cloudflare/r2-cors.example.json`, replace `https://example.com` with the exact web origin (scheme and host, no trailing slash), then apply it with `bunx wrangler r2 bucket cors set <BUCKET> --file <POLICY_FILE>`. Verify with `bunx wrangler r2 bucket cors list <BUCKET>`. The bucket and its live origin are account-specific, so this policy is a deployment template.

If the packaged desktop app will upload directly to R2, also configure and verify its platform origin (`tauri://localhost` on macOS or `http://tauri.localhost` on Windows/Linux) in the bucket policy. This cross-origin upload path needs a live bucket test on each packaged platform.

The queue transport currently checks that uploaded objects exist, then acknowledges the message. It does not yet implement the PRD's durable background operation record, transactional outbox, or reconciliation. Do not use this transport for consequential jobs until those records exist.

If deploying the separate Fumadocs site, set `NEXT_PUBLIC_DOCS_URL` to its public origin at build time. The local build uses `http://localhost:4000` for social metadata.
