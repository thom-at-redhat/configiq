import { describe, it, expect } from 'vitest'
import { detectKVCategory } from '../kv-detect'
import type { ExtractedConfig, ModelFamilies } from '../kv-types'
import modelFamiliesData from '../model-families.json'

// Use the real, merged model-families.json (sub-task 1) so these tests fail
// if the family-detection data regresses.
const REAL_FAMILIES = modelFamiliesData as ModelFamilies

// ─── Fixtures ────────────────────────────────────────────────────────────────

function baseConfig(overrides: Partial<ExtractedConfig> = {}): ExtractedConfig {
  return {
    model_type: 'llama',
    L: 8,
    H_q: 8,
    H_kv: 8,
    d: 64,
    d_source: 'explicit',
    hidden_size: 512,
    intermediate_size: 1024,
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

// ─── KV-2 / KV-4 config-driven detection ────────────────────────────────────

describe('detectKVCategory — config-signal categories', () => {
  it('detects KV-2 (MLA) from kv_lora_rank + qk_rope_head_dim', () => {
    const cfg = baseConfig({ kv_lora_rank: 512, qk_rope_head_dim: 64 })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-2')
    expect(result.confidence).toBe('high')
  })

  it('detects KV-4 (CLA) from use_cla + cla_share_factor > 1', () => {
    const cfg = baseConfig({ use_cla: true, cla_share_factor: 2 })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-4')
  })

  it('falls back to KV-1 dense when no special signals are present', () => {
    const cfg = baseConfig()
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-1')
  })
})

// ─── KV-5b: Jamba / Nemotron-H hybrid SSM detection (must keep working) ─────

describe('detectKVCategory — jamba / nemotron_h KV-5b detection', () => {
  it('detects KV-5b for jamba via model-families.json even with no SSM/attn config signals', () => {
    const cfg = baseConfig({ model_type: 'jamba' })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-5b')
    expect(result.source).toBe('model-families.json')
    // No config signals present -> low confidence, with a warning to verify manually.
    expect(result.confidence).toBe('low')
    expect(result.warnings?.[0]).toContain('no SSM config fields found')
  })

  it('detects KV-5b for nemotron_h with high confidence when SSM + attention config signals are present', () => {
    const cfg = baseConfig({
      model_type: 'nemotron_h',
      mamba_d_state: 128,
      attn_layer_period: 8,
    })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-5b')
    expect(result.confidence).toBe('high')
  })

  it('detects KV-5b purely from config signals (SSM + attention), independent of model_type', () => {
    const cfg = baseConfig({
      model_type: 'some-future-hybrid-model',
      mamba_d_state: 16,
      attn_layer_period: 4,
    })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-5b')
    expect(result.source).toBe('config.json')
  })
})

// ─── KV-5a: pure SSM (mamba family) ──────────────────────────────────────────

describe('detectKVCategory — pure SSM (KV-5a)', () => {
  it('detects KV-5a for mamba2 model_type with no attention signal', () => {
    const cfg = baseConfig({ model_type: 'mamba2' })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-5a')
  })

  it('detects KV-5a from an explicit ssm_cfg signal regardless of model_type', () => {
    const cfg = baseConfig({ model_type: 'unknown-ssm-model', ssm_cfg: {} })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-5a')
  })
})

// ─── Qwen sliding-window semantics (sub-task 1 data) ────────────────────────

describe('detectKVCategory — qwen max_window_layers_semantics', () => {
  it('qwen2_vl: first_N_layers_are_full resolves to KV-3b (hybrid)', () => {
    const cfg = baseConfig({
      model_type: 'qwen2_vl',
      sliding_window: 4096,
      max_window_layers: 4,
    })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-3b')
    expect(result.fields).toContain('max_window_layers')
  })

  it('qwen2: version_sensitive_or_ambiguous resolves to KV-3a with a low-confidence warning', () => {
    const cfg = baseConfig({
      model_type: 'qwen2',
      sliding_window: 4096,
      max_window_layers: 4,
    })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-3a')
    expect(result.confidence).toBe('low')
    expect(result.warnings?.[0]).toContain('ambiguous')
  })

  it('qwen3: version_sensitive_or_ambiguous also resolves conservatively to KV-3a', () => {
    const cfg = baseConfig({
      model_type: 'qwen3',
      sliding_window: 4096,
      max_window_layers: 4,
    })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-3a')
  })

  it('sliding_window with no layer_types/max_window_layers falls back to KV-3a', () => {
    const cfg = baseConfig({ model_type: 'mistral', sliding_window: 4096 })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-3a')
    expect(result.source).toBe('inferred')
  })
})

// ─── KV-3b: Gemma 3 pattern-based hybrid override ───────────────────────────

describe('detectKVCategory — gemma3_text model-families.json override', () => {
  it('resolves to KV-3b for gemma3_text with a sliding window present', () => {
    const cfg = baseConfig({ model_type: 'gemma3_text', sliding_window: 1024 })
    const result = detectKVCategory(cfg, REAL_FAMILIES)
    expect(result.category).toBe('KV-3b')
    expect(result.source).toBe('model-families.json')
  })
})
