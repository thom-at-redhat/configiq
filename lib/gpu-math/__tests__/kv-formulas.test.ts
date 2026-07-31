import { describe, it, expect } from 'vitest'
import {
  validateTP,
  blockAlignedSeqLen,
  computeKVCacheResult,
  computeKVMemory,
  computeRecurrentState,
} from '../kv-formulas'
import type {
  DeploymentParams,
  DetectionResult,
  ExtractedConfig,
  ModelFamilies,
} from '../kv-types'
import modelFamiliesData from '../model-families.json'

const REAL_FAMILIES = modelFamiliesData as ModelFamilies

// ─── Fixtures ────────────────────────────────────────────────────────────────
// A minimal, fully-specified dense (KV-1) config. Individual tests override
// only the fields relevant to what they're exercising.

function baseConfig(overrides: Partial<ExtractedConfig> = {}): ExtractedConfig {
  return {
    model_type: 'llama',
    L: 1,
    H_q: 1,
    H_kv: 1,
    d: 64,
    d_source: 'explicit',
    hidden_size: 64,
    intermediate_size: 128,
    vocab_size: 1000,
    B: 2,
    dtype: 'bfloat16',

    sliding_window: null,
    sliding_window_pattern: null,
    use_sliding_window: null,
    global_attn_every_n_layers: null,
    layer_types: null,
    max_window_layers: null,

    kv_lora_rank: null,
    qk_rope_head_dim: null,

    use_cla: null,
    cla_share_factor: null,

    ssm_cfg: null,
    mamba_d_state: null,
    mamba_d_conv: null,
    mamba_expand: null,

    attn_layer_period: null,
    attn_layer_offset: null,
    attention_layers_idx: null,

    block_types: null,
    attention_window_size: null,
    lru_width: null,
    conv1d_width: null,
    residual_in_fp32: null,

    is_moe: false,
    total_routed_experts: null,
    shared_experts: 0,
    active_routed_per_tok: null,
    total_experts: null,
    active_experts_per_tok: null,
    active_ratio: null,
    moe_intermediate_size: null,
    expert_layer_period: null,
    expert_layer_offset: 0,

    is_multimodal: false,
    mm_tokens_per_image: null,

    quantization_config: { type: 'none' },
    ...overrides,
  }
}

function baseDeploy(overrides: Partial<DeploymentParams> = {}): DeploymentParams {
  return {
    tp: 1,
    max_model_len: 32,
    max_num_seqs: 1,
    gpu_memory_utilization: 0.9,
    ISL: 16,
    OSL: 16,
    block_size: 16,
    kv_cache_dtype: undefined,
    mamba_ssm_cache_dtype: 'bfloat16',
    ...overrides,
  }
}

const detection = (category: DetectionResult['category']): DetectionResult => ({
  category,
  source: 'config.json',
  confidence: 'high',
  fields: [],
})

const NO_FAMILIES: ModelFamilies = {}

// ─── validateTP ──────────────────────────────────────────────────────────────

describe('validateTP', () => {
  it('rejects TP < 1', () => {
    const result = validateTP(8, 8, 0)
    expect(result.hard_reject).toBe(true)
    expect(result.is_valid).toBe(false)
  })

  it('rejects TP that does not evenly divide H_q', () => {
    const result = validateTP(7, 7, 2)
    expect(result.hard_reject).toBe(true)
    expect(result.reject_reason).toContain('not divisible')
  })

  it('shards cleanly when TP <= H_kv and divides evenly', () => {
    const result = validateTP(8, 8, 4)
    expect(result.is_valid).toBe(true)
    expect(result.kv_replication).toBe(false)
    expect(result.kv_tp_mode).toBe('sharded')
    expect(result.kv_heads_per_gpu).toBe(2)
    expect(result.tp_gives_kv_benefit).toBe(true)
  })

  it('warns of KV replication when TP exceeds H_kv (no further KV benefit)', () => {
    const result = validateTP(8, 2, 8)
    expect(result.is_valid).toBe(true)
    expect(result.kv_replication).toBe(true)
    expect(result.kv_tp_mode).toBe('replicated')
    expect(result.kv_heads_per_gpu).toBe(1)
    expect(result.tp_gives_kv_benefit).toBe(false)
    expect(result.warning).toContain('replicated')
  })
})

// ─── blockAlignedSeqLen ──────────────────────────────────────────────────────

describe('blockAlignedSeqLen', () => {
  it('rounds up to the next full block', () => {
    expect(blockAlignedSeqLen(17, 16)).toBe(32)
  })

  it('leaves an already block-aligned length unchanged', () => {
    expect(blockAlignedSeqLen(32, 16)).toBe(32)
  })
})

// ─── computeKVCacheResult ────────────────────────────────────────────────────

describe('computeKVCacheResult', () => {
  it('KV-1 dense: bytes/token = 2 x heads x head_dim x dtype_bytes x layers', () => {
    const cfg = baseConfig({ H_q: 4, H_kv: 4, d: 128, L: 2 })
    const kv = computeKVCacheResult(cfg, detection('KV-1'), baseDeploy({ tp: 1 }), NO_FAMILIES, 'bfloat16')
    // 2 * 4 heads * 128 head_dim * 2 bytes(bf16) * 2 layers
    expect(kv.kv_bytes_per_token).toBe(2 * 4 * 128 * 2 * 2)
    expect(kv.kv_tp_mode).toBe('sharded')
    expect(kv.is_bounded).toBe(false)
  })

  it('KV-2 MLA: bytes/token = (kv_lora_rank + qk_rope_head_dim) x dtype_bytes x layers', () => {
    const cfg = baseConfig({ kv_lora_rank: 512, qk_rope_head_dim: 64, L: 3 })
    const kv = computeKVCacheResult(cfg, detection('KV-2'), baseDeploy(), NO_FAMILIES, 'bfloat16')
    expect(kv.kv_bytes_per_token).toBe((512 + 64) * 2 * 3)
    expect(kv.kv_tp_mode).toBe('mla_replicated')
    expect(kv.tp_gives_kv_benefit).toBe(false)
  })

  it('KV-5a pure SSM: zero KV cache bytes/token', () => {
    const cfg = baseConfig({ ssm_cfg: {} })
    const kv = computeKVCacheResult(cfg, detection('KV-5a'), baseDeploy(), NO_FAMILIES, 'bfloat16')
    expect(kv.kv_bytes_per_token).toBe(0)
    expect(kv.kv_tp_mode).toBe('zero')
  })
})

// ─── computeKVMemory — multimodal image-token fix ───────────────────────────
// Regression coverage for the imgTokens no-op bug: effectiveSeqLen() used to
// multiply mm_tokens_per_image by 0, permanently dropping image tokens from
// multimodal KV sizing. The interim fix counts exactly 1 image's worth.

describe('computeKVMemory — multimodal image tokens', () => {
  it('counts mm_tokens_per_image once (not zero) for multimodal configs', () => {
    // H_q=H_kv=1, d=64, L=1, bf16 (2 bytes) => kv_bytes_per_token = 2*1*64*2*1 = 256
    const cfg = baseConfig({ is_multimodal: true, mm_tokens_per_image: 16 })
    const deploy = baseDeploy({ ISL: 16, OSL: 0, max_model_len: 16, max_num_seqs: 1, block_size: 16 })

    const kv = computeKVCacheResult(cfg, detection('KV-1'), deploy, NO_FAMILIES, 'bfloat16')
    const memory = computeKVMemory(kv, cfg, deploy, NO_FAMILIES)

    // effectiveSeqLen(16) = 16 + 1*16 (image tokens) = 32, block-aligned to 32
    // (with the old `0 * mm_tokens_per_image` bug this would stay 16, i.e. half this value)
    const expectedBytes = kv.kv_bytes_per_token * 32 * 1
    expect(memory.optimistic).toBe(expectedBytes)
    expect(memory.optimistic).not.toBe(kv.kv_bytes_per_token * 16 * 1)
  })

  it('leaves non-multimodal configs unaffected by mm_tokens_per_image', () => {
    const cfg = baseConfig({ is_multimodal: false, mm_tokens_per_image: 16 })
    const deploy = baseDeploy({ ISL: 16, OSL: 0, max_model_len: 16, max_num_seqs: 1, block_size: 16 })

    const kv = computeKVCacheResult(cfg, detection('KV-1'), deploy, NO_FAMILIES, 'bfloat16')
    const memory = computeKVMemory(kv, cfg, deploy, NO_FAMILIES)

    expect(memory.optimistic).toBe(kv.kv_bytes_per_token * 16 * 1)
  })
})

// ─── computeRecurrentState — mamba2 d_state fix ─────────────────────────────
// Regression coverage for the mamba2 d_state bug: without a family-specific
// state_defaults entry, mamba2 silently fell back to the generic d_state=16
// default (an 8x understatement of recurrent-state memory). This test uses
// the real, merged model-families.json so it fails if that fix regresses.

describe('computeRecurrentState — mamba2 family default (d_state=128)', () => {
  it('uses d_state=128 from model-families.json for mamba2, not the generic 16 default', () => {
    const cfg = baseConfig({
      model_type: 'mamba2',
      L: 4,
      hidden_size: 64,
      B: 2,
      ssm_cfg: {}, // signals SSM architecture; mamba_d_state/d_conv/expand left null
    })
    const deploy = baseDeploy({ max_num_seqs: 1 })

    const state = computeRecurrentState(cfg, deploy, REAL_FAMILIES)
    expect(state).not.toBeNull()

    // family state_defaults: d_state=128, d_conv=4, expand=2
    // d_inner = hidden_size * expand = 64 * 2 = 128
    // n_recurrent = L = 4 (no attn_layer_period)
    // state_bytes_per_seq  = n_recurrent * d_inner * d_state       * B = 4*128*128*2 = 131072
    // conv_bytes_per_seq   = n_recurrent * d_inner * (d_conv - 1)  * B = 4*128*3*2   = 3072
    expect(state!.state_bytes_per_seq).toBe(131072)
    expect(state!.conv_bytes_per_seq).toBe(3072)
    expect(state!.total_state_bytes_per_seq).toBe(134144)
    expect(state!.total_state_memory_bytes).toBe(134144)

    // Sanity check against the pre-fix value: d_state=16 would give exactly 1/8th
    // the state_bytes_per_seq (131072 / 16 = 8192, vs the correct 131072).
    const buggyStateBytes = 4 * 128 * 16 * 2
    expect(state!.state_bytes_per_seq).toBe(buggyStateBytes * 8)
  })

  it('mamba (not mamba2) still uses d_state=16 from its own family entry', () => {
    const cfg = baseConfig({
      model_type: 'mamba',
      L: 4,
      hidden_size: 64,
      B: 2,
      ssm_cfg: {},
    })
    const deploy = baseDeploy({ max_num_seqs: 1 })

    const state = computeRecurrentState(cfg, deploy, REAL_FAMILIES)
    expect(state).not.toBeNull()
    // d_inner = 64 * 2 = 128; state_bytes = 4*128*16*2 = 16384
    expect(state!.state_bytes_per_seq).toBe(16384)
  })

  it('an explicit cfg.mamba_d_state always overrides the family default', () => {
    const cfg = baseConfig({
      model_type: 'mamba2',
      L: 4,
      hidden_size: 64,
      B: 2,
      mamba_d_state: 32,
      mamba_d_conv: 4,
      mamba_expand: 2,
    })
    const deploy = baseDeploy({ max_num_seqs: 1 })

    const state = computeRecurrentState(cfg, deploy, REAL_FAMILIES)
    // d_inner = 128; state_bytes = 4*128*32*2 = 32768 (uses explicit 32, not family's 128)
    expect(state!.state_bytes_per_seq).toBe(32768)
  })
})
