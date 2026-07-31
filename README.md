# GPUCalc

LLM inference sizing, GPU comparison, and cost modeling for engineers and infrastructure teams.

**🚀 Live at [gpu-calc-v2.vercel.app](https://gpu-calc-v2.vercel.app/quick-estimate)**

Built with Next.js + PatternFly + Red Hat design system.

## What it does

| Tool | Description |
|------|-------------|
| **Quick Estimate** | Fast GPU memory and cost estimate from model + load profile |
| **Advanced Calculator** | Detailed sizing with batching, quantization, and cost modeling |
| **GPU Explorer** | Compare GPUs across memory, throughput, cost, and availability |
| **Hybrid Savings** | Model cost savings across cloud, on-premise, and hybrid strategies |
| **Routing Economics** | Analyze request routing between model tiers |
| **Pricing Admin** | Admin dashboard for managing GPU and API token pricing data |

## Getting started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Setup

```bash
git clone https://github.com/nb-qbits/gpu-calc-v2.git
cd gpu-calc
npm install
npm run dev
```

App runs at **http://localhost:3000**.

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values below. None of these
have hardcoded fallbacks — if a required var is missing, the corresponding
feature fails closed (see "What breaks" column) rather than silently using a
default host or allowing public access.

> **Heads up if you're deploying this branch:** `GPU_SIZER_URL` and
> `AICONFIGURATOR_API_URL` used to fall back to a hardcoded internal IP, and
> `/pricing-admin.html` used to have no auth gate at all. Both of those
> fallbacks are gone. Set the vars below in your deployment environment
> **before or during** the deploy — otherwise the GPU Sizer / KV cache calc
> APIs return "not configured" errors and the pricing admin page returns a
> 503 until they're set.

| Variable | Required? | Default | What breaks if missing/misconfigured |
|---|---|---|---|
| `GPU_SIZER_URL` | Yes, for `/api/v1/gpu-sizer` | none | `POST /api/v1/gpu-sizer` returns `GPU_SIZER_NOT_CONFIGURED` (HTTP 503) |
| `GPU_SIZER_USERNAME` | Yes, for `/api/v1/gpu-sizer` | none | Same as above (`GPU_SIZER_NOT_CONFIGURED`, HTTP 503) |
| `GPU_SIZER_PASSWORD` | Yes, for `/api/v1/gpu-sizer` | none | Same as above (`GPU_SIZER_NOT_CONFIGURED`, HTTP 503) |
| `GPU_SIZER_TIMEOUT_SECONDS` | No | `90` | N/A — falls back to the default timeout |
| `AICONFIGURATOR_API_URL` | Yes, for `/api/v1/kv-cache-calc` | none | `POST /api/v1/kv-cache-calc` returns `KV_CACHE_NOT_CONFIGURED` (HTTP 503) |
| `AICONFIGURATOR_USERNAME` | Yes, for `/api/v1/kv-cache-calc` | none | Same as above (`KV_CACHE_NOT_CONFIGURED`, HTTP 503) |
| `AICONFIGURATOR_PASSWORD` | Yes, for `/api/v1/kv-cache-calc` | none | Same as above (`KV_CACHE_NOT_CONFIGURED`, HTTP 503) |
| `AICONFIGURATOR_TIMEOUT_SECONDS` | No | `90` | N/A — falls back to the default timeout |
| `PRICING_ADMIN_USERNAME` | Yes, for `/pricing-admin.html` | none | `/pricing-admin.html` returns HTTP 503 ("Pricing admin is not configured") for everyone, admin included |
| `PRICING_ADMIN_PASSWORD` | Yes, for `/pricing-admin.html` | none | Same as above (HTTP 503) |

**HTTPS is required.** `GPU_SIZER_URL` and `AICONFIGURATOR_API_URL` must use
`https://` — plaintext `http://` is only accepted when the host is
`localhost` or `127.0.0.1` (local dev). A non-local `http://` URL is rejected
with `GPU_SIZER_INSECURE_URL` / `KV_CACHE_INSECURE_URL` (HTTP 503) instead of
being sent in plaintext.

`PRICING_ADMIN_USERNAME` / `PRICING_ADMIN_PASSWORD` gate `/pricing-admin.html`
with HTTP Basic Auth via `middleware.ts`. They're independent of the admin
token the page itself uses to talk to the Cloudflare Worker — see
[Pricing Admin](#pricing-admin) below.

### Available commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run type-check   # TypeScript check without building
npm run lint         # ESLint
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router + TypeScript |
| UI | PatternFly v5 (Red Hat design system) |
| Fonts | Red Hat Display / Text / Mono |
| Deployment | Vercel |

## Project structure

```
app/                  Next.js App Router pages
  layout.tsx          Root layout, fonts, PatternFly CSS imports
  page.tsx            Homepage
  quick-estimate/     Quick Estimate tool
  calculator/         Advanced Calculator (stub)
  gpu-explorer/       GPU Explorer (stub)
  hybrid-savings/     Hybrid Savings (stub)
  routing/            Routing Economics (stub)
components/
  layout/
    AppShell.tsx      Top-nav masthead + PatternFly Page wrapper
lib/
  gpu-math/           ALL GPU sizing formulas live here
    memory.ts         Memory estimation
    throughput.ts     Throughput estimation
    cost.ts           Cost modeling
    models.ts         Model catalog
    gpus.ts           GPU catalog
    quick-estimate.ts Quick Estimate calculation engine
  utils/
    format.ts         Number / unit formatting helpers
docs/                 Architecture docs and ADRs
```

## Pricing Admin

The Pricing Admin dashboard (`/pricing-admin.html`) is a standalone tool for managing GPU cloud and API token pricing data sourced via a Cloudflare Worker.

**Access:** Gated behind HTTP Basic Auth at the middleware level (`PRICING_ADMIN_USERNAME` / `PRICING_ADMIN_PASSWORD` — see [Environment variables](#environment-variables)), fails closed with HTTP 503 if unset. Once past that gate, the page itself also needs a Cloudflare Worker URL and an admin token to connect to the pricing data source.

**Capabilities:**

- View and search all GPU cloud and API token prices across providers (AWS, GCP, Azure, Lambda, CoreWeave, RunPod, Vast.ai, etc.)
- Filter by GPU type, confidence level (API-sourced, scraped, or manually verified), and pricing type (on-demand, reserved, spot)
- Review and approve/reject flagged price changes before they take effect
- Trigger manual collection runs against specific provider sources
- View run history with fetch/update/error metrics
- Export full pricing dataset as CSV

## Contributing

### Branching

- Branch from `main`: `git checkout -b feature/your-feature-name`
- Keep branches short-lived — one feature or fix per branch
- PR target is always `main`

### Before opening a PR

CI runs automatically and must pass. You can run the same checks locally:

```bash
npm run type-check   # Must be clean — no TypeScript errors
npm run lint         # Must be clean — no ESLint errors
npm run build        # Must succeed
```

Pre-commit hooks (Husky) run lint-staged automatically on `git commit` so most issues are caught before you push.

### Code conventions

1. **GPU math belongs in `lib/gpu-math/`** — never write sizing formulas inside React components. Components call lib functions and display the results.

2. **PatternFly only** — do not add Tailwind, shadcn/ui, or any other component library. PatternFly v5 is the single source of truth for UI components.

3. **Red Hat design system** — use the established CSS variables (`--rh-red`, `--rh-gray-*`, etc.) and PF spacing tokens. Do not introduce arbitrary hex colors.

4. **Sentence case everywhere** — Red Hat brand standard. No title case in headings or labels.

5. **Server components by default** — add `"use client"` only when you need browser APIs, state, or event handlers.

6. **No `any` types** — TypeScript strict mode is enforced. Define proper interfaces in the relevant lib file or component.

7. **No unnecessary comments** — only add a comment when the *why* is non-obvious. Well-named identifiers are self-documenting.

### PR checklist

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] New GPU math is in `lib/gpu-math/`, not in a component
- [ ] No new third-party UI libraries added
- [ ] Sentence case used in all UI text

## What is deferred (do not add yet)

- Database / Prisma / PostgreSQL
- Authentication / NextAuth.js
- Turborepo / monorepo structure
- Tailwind CSS

These will be added in later phases when there is a real requirement for them.
