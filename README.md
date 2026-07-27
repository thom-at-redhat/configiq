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

**Access:** Requires a Cloudflare Worker URL and an admin token to connect.

**Capabilities:**

- View and search all GPU cloud and API token prices across providers (AWS, GCP, Azure, Lambda, CoreWeave, RunPod, Vast.ai, etc.)
- Filter by GPU type, confidence level (API-sourced, scraped, or manually verified), and pricing type (on-demand, reserved, spot)
- Review and approve/reject flagged price changes before they take effect
- Trigger manual collection runs against specific provider sources
- View run history with fetch/update/error metrics
- Export full pricing dataset as CSV

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching, local checks, code
conventions, and the PR checklist.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
