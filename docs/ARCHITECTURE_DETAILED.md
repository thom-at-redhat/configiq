# GPU Calc - Detailed Architecture

This document provides comprehensive component diagrams, data flow visualizations, and module relationships for the gpu-calc system.

> **Note**: This supplements the high-level [architecture.md](./architecture.md) with detailed diagrams showing how components interact.

## Table of Contents
- [System Overview](#system-overview)
- [Inference Config Engine](#inference-config-engine)
- [Data Flow](#data-flow)
- [Module Dependencies](#module-dependencies)
- [Component Responsibilities](#component-responsibilities)
- [Current Integration Status](#current-integration-status)
- [API Architecture](#api-architecture)
- [Type System](#type-system)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js App Router)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐        ┌──────────────────────┐     │
│  │  Quick Estimate Page │        │ Shared Components    │     │
│  │  app/quick-estimate/ │◄───────┤ components/          │     │
│  │                      │        │ - ProductTour        │     │
│  │  - Model input       │        │ - FlipTile           │     │
│  │  - GPU selector      │        │ - Term (glossary)    │     │
│  │  - Result tiles      │        └──────────────────────┘     │
│  │  - Live pricing      │                                      │
│  └──────────┬───────────┘                                      │
│             │                                                  │
└─────────────┼──────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────┐        │
│  │  Inference Config Engine                           │        │
│  │  lib/gpu-math/inference-config/                    │        │
│  │                                                     │        │
│  │  ┌──────────────┐  ┌──────────────┐               │        │
│  │  │ core.ts      │  │ validation   │               │        │
│  │  │ (orchestrate)│─→│ (check input)│               │        │
│  │  └──────┬───────┘  └──────────────┘               │        │
│  │         │                                          │        │
│  │         ▼                                          │        │
│  │  ┌──────────────┐  ┌──────────────┐               │        │
│  │  │tensor-       │  │ vllm-        │               │        │
│  │  │parallel.ts   │─→│ defaults.ts  │               │        │
│  │  └──────────────┘  └──────┬───────┘               │        │
│  │                           │                        │        │
│  │                           ▼                        │        │
│  │  ┌──────────────┐  ┌──────────────┐               │        │
│  │  │ bottleneck.ts│  │ parallelism  │               │        │
│  │  │              │─→│              │               │        │
│  │  └──────────────┘  └──────────────┘               │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ GPU Catalog  │  │ Model Catalog│  │ Other Helpers│        │
│  │ gpus.ts      │  │ models.ts    │  │ memory.ts    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ gpu-catalog    │  │ HuggingFace    │  │ Cloudflare Worker│ │
│  │ .json          │  │ config.json    │  │ (Live Pricing)   │ │
│  │                │  │ (live fetch)   │  │                  │ │
│  │ 15 GPUs        │  │ layers, heads, │  │ Live prices      │ │
│  │ VRAM, bandwidth│  │ hidden size... │  │ 15 GPUs          │ │
│  └────────────────┘  └───────┬────────┘  └──────────────────┘ │
│                               │ fallback when fetch fails/      │
│                               │ is incomplete                   │
│                       ┌───────▼────────┐                        │
│                       │ model-families │                        │
│                       │ .json          │                        │
│                       │ KV-category +  │                        │
│                       │ config fallbacks│                       │
│                       └────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Note**: `models.ts` (`MODEL_CATALOG`) is display metadata only — id, name,
> vendor, HF path, UI tags. It holds no architecture values (layers, hidden
> size, heads). All per-model math uses the config fetched live from
> HuggingFace at request time (`lib/huggingface/fetch-config.ts`), with
> `model-families.json` supplying KV-cache-category detection and config
> fallbacks for families whose `config.json` is incomplete or unconventional.
> There is no `model-specs.json` file in this codebase.

---

## Inference Config Engine - Internal Architecture

The core calculation engine that determines GPU requirements.

```
                 ┌─────────────────────────┐
                 │   InferenceRequest      │
                 │                         │
                 │ - model_name            │
                 │ - gpu_type              │
                 │ - concurrent_users      │
                 │ - isl, osl              │
                 │ - workload_type         │
                 │ - sla_priority          │
                 │ - precision             │
                 └───────────┬─────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │  validation.ts                         │
        │  validateInferenceRequest()            │
        │  - Check all params valid              │
        │  - Return errors if invalid            │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │  core.ts                               │
        │  computeInferenceConfig()              │
        │  - Main orchestrator                   │
        │  - Calls all sub-modules in order     │
        └────────────────┬───────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│quantization  │ │ Get GPU/Model│ │Calculate     │
│.ts           │ │ Specs        │ │Weight Memory │
│              │ │              │ │              │
│Determine     │ │from catalogs │ │params × bytes│
│bytes/param   │ │              │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │  tensor-parallel.ts                    │
        │  computeTensorParallelSize()           │
        │  - Determine TP size (1, 2, 4, 8...)   │
        │  - Calculate replicas                  │
        │  - Compute usable HBM per GPU          │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │  vllm-defaults.ts                      │
        │  computeVLLMConfig()                   │
        │  - max_model_len (context window)      │
        │  - max_num_seqs (batch size)           │
        │  - enable_chunked_prefill (ISL > 1000?)│
        │  - enable_prefix_caching (workload?)   │
        │  - max_num_batched_tokens              │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │  bottleneck.ts                         │
        │  classifyBottleneck()                  │
        │  - Analyze TTFT vs TPOT vs throughput  │
        │  - Identify primary bottleneck         │
        │  - Generate fix suggestions            │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │  parallelism.ts                        │
        │  determineParallelismStrategy()        │
        │  - TP_ONLY vs PP_ACROSS_NODES          │
        │  - Disaggregated serving (llmd)        │
        │  - Network topology recommendations    │
        └────────────────┬───────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │  llmd.ts (optional)                    │
        │  computeLLMDConfig()                   │
        │  - Prefill instances config            │
        │  - Decode instances config             │
        │  - KV transfer settings                │
        └────────────────┬───────────────────────┘
                         │
                         ▼
                 ┌─────────────────────────┐
                 │ InferenceConfigResult   │
                 │                         │
                 │ - memory_analysis       │
                 │ - vllm_config           │
                 │ - bottleneck_analysis   │
                 │ - parallelism_strategy  │
                 │ - llmd_config (opt)     │
                 │ - warnings              │
                 └─────────────────────────┘
```

---

## Data Flow - Quick Estimate Page

Shows how data flows from user input through calculations to display.

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. Select Model: "Llama 3.1 70B"
     │ 2. Select GPU: "H100 80GB"
     │
     ▼
┌─────────────────────────────────────────┐
│  Quick Estimate UI                      │
│  (QuickEstimate.tsx)                    │
│                                         │
│  React State:                           │
│  - model = "meta-llama/..."             │
│  - gpu = "NVIDIA H100 80GB"             │
└────┬────────────────────────────────────┘
     │
     │ useEffect triggered on model/gpu change
     │
     ▼
┌─────────────────────────────────────────┐
│  GPU Name Mapping                       │
│  mapGpuToCatalogId()                    │
│                                         │
│  "NVIDIA H100 80GB" → "h100-80gb"       │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Call Inference Engine                  │
│  computeInferenceConfig({               │
│    model_name: "meta-llama/...",        │
│    gpu_type: "h100-80gb",               │
│    concurrent_users: 97,                │
│    isl: 1000,                           │
│    osl: 150,                            │
│    workload_type: "chat",               │
│    sla_priority: "ttft",                │
│    precision: "FP16"                    │
│  })                                     │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Inference Engine Processing            │
│                                         │
│  1. Validate inputs ✓                   │
│  2. Get model specs (70B params)        │
│  3. Get GPU specs (80 GB VRAM)          │
│  4. Calculate weight: 70B × 2 = 140 GB  │
│  5. Determine TP: 140 GB > 80 GB → TP=2 │
│  6. Calculate KV cache budget           │
│  7. Generate vLLM config                │
│  8. Analyze bottlenecks                 │
│  9. Determine parallelism strategy      │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Return Result                          │
│  {                                      │
│    memory_analysis: {                   │
│      tp_size: 2,                        │
│      replicas: 1,                       │
│      weight_gb: 140,                    │
│      kv_cache_budget_gb: 45             │
│    },                                   │
│    vllm_config: {...},                  │
│    bottleneck_analysis: {               │
│      primary: "TTFT"                    │
│    },                                   │
│    warnings: [...]                      │
│  }                                      │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Update React State                     │
│  setTestResult(result)                  │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Display in Flip Tiles + Memory Bar     │
│                                         │
│  GPU Count: 2                           │
│     (TP=2 × Replicas=1)                 │
│  Bottleneck: TTFT                       │
└─────────────────────────────────────────┘
```

> The `testResult` / `setTestResult` variable names in `QuickEstimate.tsx`
> are a holdover from early engine integration — they hold the live,
> production result, not test/mock data.

---

## Module Dependencies

```
QuickEstimate.tsx
    │
    ├─→ fetchModelConfig (from lib/huggingface/fetch-config.ts)
    │       └─→ live GET of the model's config.json from HuggingFace
    │           (10s timeout; failure/incompleteness falls back to
    │            model-families.json + name-pattern detection)
    │
    ├─→ computeInferenceConfig (from core.ts)
    │       │
    │       ├─→ validateOrThrow (from validation.ts)
    │       ├─→ MODEL_CATALOG.find() (from models.ts) — display metadata only
    │       ├─→ detectKVCategory / extractConfig (from kv-detect.ts, kv-config.ts)
    │       │       └─→ model-families.json (KV category + config fallbacks)
    │       ├─→ getStorageBytesPerParam / estimateWeightMemoryBytes (from weight-memory.ts)
    │       ├─→ computeTensorParallelSize (from tensor-parallel.ts)
    │       │       └─→ getGpuById (from gpus.ts)
    │       │               └─→ GPU_CATALOG (from gpu-catalog.json)
    │       ├─→ computeVLLMConfig (from vllm-defaults.ts)
    │       ├─→ classifyBottleneck (from bottleneck.ts)
    │       ├─→ determineParallelismStrategy (from parallelism.ts)
    │       └─→ computeLLMDConfig (from llmd.ts)
    │
    ├─→ FlipTile (from quickEstimateHelpers.tsx)
    ├─→ Term (from quickEstimateHelpers.tsx)
    ├─→ useCountUp (from quickEstimateHelpers.tsx)
    └─→ ProductTour (from components/ProductTour/)
```

> **Note**: `quantization.ts` (`recommendQuantization()`) still exists and is
> exported from the module's `index.ts`, but `core.ts` does not call it —
> quantization is now detected inline from the live HuggingFace
> `quantization_config` during weight-memory calculation.

---

## Component Responsibilities

### Frontend Components

| Component | File | Responsibility | Status |
|-----------|------|----------------|--------|
| **QuickEstimate** | `app/quick-estimate/QuickEstimate.tsx` | Main page, state management, orchestrates all other components | ✅ Active |
| **FlipTile** | `quickEstimateHelpers.tsx` | Interactive card that flips to show formulas on click/Enter | ✅ Complete |
| **ProductTour** | `components/ProductTour/ProductTour.tsx` | Guided tour with spotlight and tooltips | ✅ Complete |
| **Term** | `quickEstimateHelpers.tsx` | Glossary popover (? icon with explanation) | ✅ Complete |
| **useCountUp** | `quickEstimateHelpers.tsx` | Animates numbers from 0 → target | ✅ Complete |

### Inference Engine Modules

| Module | File | Key Function | What It Does |
|--------|------|--------------|--------------|
| **Core** | `core.ts` | `computeInferenceConfig()` | Main orchestrator, calls all sub-modules |
| **Validation** | `validation.ts` | `validateInferenceRequest()` | Validates input parameters |
| **Tensor Parallel** | `tensor-parallel.ts` | `computeTensorParallelSize()` | Calculates TP size (1, 2, 4, 8...) and replicas |
| **vLLM Defaults** | `vllm-defaults.ts` | `computeVLLMConfig()` | Generates vLLM configuration |
| **Bottleneck** | `bottleneck.ts` | `classifyBottleneck()` | Identifies TTFT/TPOT/throughput bottlenecks |
| **Parallelism** | `parallelism.ts` | `determineParallelismStrategy()` | Selects parallelism strategy |
| **Quantization** | `quantization.ts` | `recommendQuantization()` | Recommends FP16/FP8/INT8/INT4 |
| **LLMD** | `llmd.ts` | `computeLLMDConfig()` | Disaggregated serving configuration |

### Data Modules

| Module | File | Purpose | Exports |
|--------|------|---------|---------|
| **GPU Catalog** | `gpus.ts` | Loads GPU specifications | `GPU_CATALOG`, `getGpuById()` |
| **Model Catalog** | `models.ts` | Display metadata only (name, vendor, HF path, UI tags) — no architecture values | `MODEL_CATALOG` |
| **Model Families** | `model-families.json` | Per-family KV-cache category + config fallback values, used when the live HuggingFace config is missing or incomplete | Raw JSON data |
| **GPU JSON** | `gpu-catalog.json` | 15 GPU specs with VRAM, bandwidth, pricing | Raw JSON data |

---

## Current Integration Status

### ✅ Fully integrated (production)

The Quick Estimate page runs the real inference engine directly on every
input change — there is no mock-data mode or separate test panel; the earlier
"🧪 TEST" naming on a couple of internal state variables is leftover from
early integration and does not reflect a visible UI element anymore.

```
┌───────────────────────────────────────────────────────┐
│  Quick Estimate Page                                  │
│                                                       │
│  1. fetchModelConfig() pulls the live HuggingFace     │
│     config.json for the selected model (10s timeout,  │
│     falls back to model-families.json config          │
│     fallbacks / name-pattern detection on failure)    │
│                     │                                │
│                     ▼                                │
│  2. computeInferenceConfig() runs the full engine:    │
│     KV-category detection, weight memory, TP sizing,  │
│     replicas, vLLM config, bottleneck + parallelism   │
│                     │                                │
│                     ▼                                │
│  3. Result renders directly into the flip tiles,      │
│     the "Why this GPU count?" card, and the memory    │
│     bar — all real data, no mock values                │
│                     │                                │
│                     ▼                                │
│  4. GPU pricing is enriched live from the Cloudflare   │
│     Worker (GET /api/v1/gpus?live_pricing=true),       │
│     refreshed every 5 minutes                          │
└───────────────────────────────────────────────────────┘
```

Also live and wired to real data: concurrent-users/ISL/OSL sliders, workload
type and SLA priority controls, weight/KV precision selectors, manual
overrides for parallelism and vLLM config, the "Save estimate" flow, and the
first-visit product tour.

---

## API Architecture

```
┌──────────┐
│ Browser  │
└────┬─────┘
     │
     ├─→ GET /api/v1/gpus?live_pricing=true
     │   │
     │   ├─→ Load gpu-catalog.json
     │   └─→ Fetch from Cloudflare Worker
     │       └─→ Returns 133 prices for 15 GPUs
     │
     ├─→ GET /api/v1/models
     │   │
     │   └─→ Load MODEL_CATALOG from models.ts (display metadata only)
     │
     └─→ POST /api/v1/config
         │
         ├─→ fetchModelConfig() — server-side HuggingFace config.json fetch
         │   (10s timeout; non-fatal on failure, engine falls back to estimation)
         │
         └─→ Call computeInferenceConfig()
             └─→ Returns full inference result
```

> **Admin surface (not yet merged into this branch)**: `public/pricing-admin.html`
> is served statically with no app-level auth of its own. A root
> `middleware.ts` that gates it behind HTTP Basic Auth (checked against
> `PRICING_ADMIN_USERNAME` / `PRICING_ADMIN_PASSWORD`, failing closed if unset)
> was added on `fix/secrets-ip-and-admin-gate` — it does not exist in this
> worktree's checkout yet. Once that branch merges, `/pricing-admin.html`
> requests will pass through `middleware.ts` before reaching the static file.

---

## Type System

### Key Interfaces

```typescript
// INPUT to inference engine
interface InferenceRequest {
  model_name: string                // "meta-llama/Llama-3.1-70B-Instruct"
  precision: 'FP16' | 'FP8' | ...   // Weight precision
  gpu_type: string                  // "h100-80gb"
  concurrent_users: number          // 100
  isl: number                       // Input sequence length (2000)
  osl: number                       // Output sequence length (500)
  workload_type: 'chat' | 'rag' ... // Workload category
  sla_priority: 'ttft' | 'tpot' ... // Performance priority
  hf_config?: HFModelConfig         // Live-fetched HuggingFace config.json
                                     // (takes precedence over catalog/estimation)
  // ...plus optional manual overrides for TP size, replicas, and vLLM config
}

// OUTPUT from inference engine
interface InferenceConfigResult {
  memory_analysis: {
    weight_gb: number               // 140
    tp_size: number                 // 2
    replicas: number                // 1
    kv_cache_budget_gb: number      // 45
    usable_hbm_per_gpu: number      // 72
  }
  vllm_config: {
    max_num_seqs: number            // 256
    max_model_len: number           // 8192
    enable_chunked_prefill: boolean // true
    enable_prefix_caching: boolean  // false
  }
  bottleneck_analysis: {
    primary: 'TTFT' | 'TPOT' | ...  // 'TTFT'
    risk: string                    // "high"
    fix_suggestions: string[]       // ["Reduce ISL", ...]
  }
  parallelism_strategy: {...}
  llmd_config?: {...}
  warnings: string[]                // ["Memory tight", ...]
}
```

---

## Calculation Example

**Input:**
- Model: Llama 3.1 70B
- GPU: H100 80GB
- Concurrent users: 100
- ISL: 2000, OSL: 500
- Workload: chat
- Priority: ttft

**Processing:**
1. **Quantization**: FP16 → 2 bytes/param
2. **Weight memory**: 70B × 2 = 140 GB
3. **TP size**: 140 GB needs 2× H100 (80 GB each) → TP=2
4. **Usable HBM**: 80 GB × 90% = 72 GB per GPU
5. **Weight per GPU**: 140 GB ÷ 2 = 70 GB
6. **KV cache budget**: 72 - 70 = 2 GB per GPU → 4 GB total
7. **KV per request**: ~450 MB (2000 tokens × layers × heads)
8. **Max sequences**: 4000 MB ÷ 450 MB = ~8 concurrent requests (low!)
9. **Bottleneck**: KV cache is tight → THROUGHPUT bottleneck
10. **Warnings**: "Consider reducing ISL or adding more GPUs"

**Output:**
- Total GPUs: 2 (TP=2, Replicas=1)
- vLLM config: max_num_seqs=8, enable_chunked_prefill=true
- Bottleneck: THROUGHPUT (not enough KV cache)
- Warnings: ["KV cache budget tight for 100 concurrent users"]

---

## Next Steps

The engine-integration plan that used to live in this section (test panel →
interactive controls → live pricing → mock-data removal) is complete; all of
it is described as current state above. Remaining work visible in the
codebase today:

- **Routing Economics** (`app/routing/`), **Hybrid Savings**
  (`app/hybrid-savings/`), and **Cluster Cost** (`app/cluster-cost/`) are
  built out but wrapped in `<ComingSoonRibbon>` — not yet promoted to fully
  supported tools.
- **Pricing admin auth**: see the note under [API Architecture](#api-architecture) —
  `middleware.ts` exists on `fix/secrets-ip-and-admin-gate` but hasn't merged
  into this branch yet.

---

**Last Updated**: Corrected to match current codebase state (inference
engine fully integrated; see git history for prior "Step 1" milestone notes)

**Status**: Inference engine fully integrated into Quick Estimate (production).
Routing Economics, Hybrid Savings, and Cluster Cost remain gated behind
"Coming Soon".
