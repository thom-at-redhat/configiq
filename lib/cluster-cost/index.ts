// Cluster Cost Module
// Calculate real monthly cost of GPU clusters beyond headline GPU-hour pricing

export { computeClusterCost } from './engine'
export { getProviderProfile, listProviderProfiles, PROVIDER_PROFILES } from './profiles'
export type {
  ClusterCostInput,
  ClusterCostResult,
  ProviderProfile,
  ProviderType,
  PricingModel,
} from './types'

// Helper: Merge provider profile defaults with user overrides
import type { ClusterCostInput, ProviderProfile } from './types'

// Fields that must be present on every ClusterCostInput section regardless of
// pricing model. `compute` is intentionally excluded here since its required
// fields depend on `pricingModel` (validated separately below).
const REQUIRED_FIELDS: {
  [K in Exclude<keyof ClusterCostInput, 'compute'>]: Array<keyof ClusterCostInput[K]>
} = {
  cluster: ['name', 'providerType', 'gpuType', 'gpuCount', 'gpusPerNode', 'hoursPerMonth', 'utilizationTarget', 'durationMonths'],
  storage: ['hotTb', 'warmTb', 'coldTb', 'hotPricePerTbMonth', 'warmPricePerTbMonth', 'coldPricePerTbMonth'],
  network: ['egressTbMonth', 'egressPricePerTb', 'loadBalancerMonthly', 'natFirewallMonthly', 'dataTransferMonthly'],
  controlPlane: ['monthlyCost', 'cpuHelperNodeMonthly', 'cpuHelperNodeCount'],
  support: ['included', 'percentOfBill', 'fixedMonthly'],
  operations: ['engineerHourlyRate', 'setupHours', 'setupAmortizationMonths', 'debuggingHoursPerMonth'],
  goodput: ['enabled', 'lossPercent'],
}

/**
 * Validate that a merged (profile defaults + overrides) object actually
 * satisfies ClusterCostInput before we hand it to computeClusterCost.
 *
 * Provider profiles only declare `Partial<ClusterCostInput>` defaults, and
 * overrides are also partial — nothing previously guaranteed the merge
 * result was complete. A profile or override missing a required field used
 * to compile fine (via an unchecked cast) and produce NaN/undefined deep
 * inside computeClusterCost instead of a clear, actionable error here.
 */
function assertCompleteClusterCostInput(
  merged: Partial<ClusterCostInput>
): asserts merged is ClusterCostInput {
  for (const section of Object.keys(REQUIRED_FIELDS) as Array<keyof typeof REQUIRED_FIELDS>) {
    const sectionValue = merged[section]
    if (sectionValue == null || typeof sectionValue !== 'object') {
      throw new Error(`applyProviderProfile: missing required section "${section}" in provider profile / overrides`)
    }
    for (const field of REQUIRED_FIELDS[section]) {
      if (sectionValue[field as keyof typeof sectionValue] === undefined) {
        throw new Error(`applyProviderProfile: missing required field "${section}.${String(field)}" in provider profile / overrides`)
      }
    }
  }

  const compute = merged.compute
  if (compute == null || typeof compute !== 'object' || compute.pricingModel == null) {
    throw new Error('applyProviderProfile: missing required field "compute.pricingModel" in provider profile / overrides')
  }
  if (compute.pricingModel === 'rental' && compute.gpuHourPrice == null) {
    throw new Error('applyProviderProfile: missing required field "compute.gpuHourPrice" for pricingModel "rental"')
  }
  if (compute.pricingModel === 'capex' && (compute.hardwareCapex == null || compute.hardwareLifetimeMonths == null)) {
    throw new Error('applyProviderProfile: missing required field "compute.hardwareCapex" or "compute.hardwareLifetimeMonths" for pricingModel "capex"')
  }
}

export function applyProviderProfile(
  profile: ProviderProfile,
  overrides: Partial<ClusterCostInput>
): ClusterCostInput {
  const merged = JSON.parse(JSON.stringify(profile.defaults)) as Partial<ClusterCostInput>

  // Deep merge overrides
  if (overrides.cluster) {
    merged.cluster = { ...merged.cluster, ...overrides.cluster }
  }
  if (overrides.compute) {
    merged.compute = { ...merged.compute, ...overrides.compute }
  }
  if (overrides.storage) {
    merged.storage = { ...merged.storage, ...overrides.storage }
  }
  if (overrides.network) {
    merged.network = { ...merged.network, ...overrides.network }
  }
  if (overrides.controlPlane) {
    merged.controlPlane = { ...merged.controlPlane, ...overrides.controlPlane }
  }
  if (overrides.support) {
    merged.support = { ...merged.support, ...overrides.support }
  }
  if (overrides.operations) {
    merged.operations = { ...merged.operations, ...overrides.operations }
  }
  if (overrides.goodput) {
    merged.goodput = { ...merged.goodput, ...overrides.goodput }
  }

  assertCompleteClusterCostInput(merged)
  return merged
}

// Helper: Format cost breakdown as percentages
import type { ClusterCostResult } from './types'

export function formatBreakdownPercentages(result: ClusterCostResult): Record<string, string> {
  const total = result.monthlyCost

  return {
    gpu: `${((result.breakdown.gpu / total) * 100).toFixed(1)}%`,
    storage: `${((result.breakdown.storage / total) * 100).toFixed(1)}%`,
    network: `${((result.breakdown.network / total) * 100).toFixed(1)}%`,
    controlPlane: `${((result.breakdown.controlPlane / total) * 100).toFixed(1)}%`,
    support: `${((result.breakdown.support / total) * 100).toFixed(1)}%`,
    setup: `${((result.breakdown.setup / total) * 100).toFixed(1)}%`,
    debugging: `${((result.breakdown.debugging / total) * 100).toFixed(1)}%`,
    goodput: `${((result.breakdown.goodput / total) * 100).toFixed(1)}%`,
  }
}
