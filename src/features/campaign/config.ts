import {
  EXERCISES,
  SECTION_STEPS,
  type EarTrainerSessionConfig,
} from '../earTrainer/config'
import type { CampaignRangeId, CampaignVoiceType } from './types'

export const CAMPAIGN_LEVEL_COUNT = 80
export const CAMPAIGN_PLAYABLE_LEVEL_COUNT = EXERCISES.length
export const CAMPAIGN_PROGRESS_STORAGE_KEY = 'earTrainer-campaign-v1'

export const CAMPAIGN_RANGES: Record<
  CampaignRangeId,
  {
    label: string
    subtitle: string
    frequencyMultipliers: number[]
  }
> = {
  'male-low': {
    label: 'Sehr tiefe Männerlage',
    subtitle: 'C2 bis H2',
    frequencyMultipliers: [0.25],
  },
  low: {
    label: 'Tiefe Lage',
    subtitle: 'C3 bis H3',
    frequencyMultipliers: [0.5],
  },
  mid: {
    label: 'Mittlere Lage',
    subtitle: 'C4 bis H4',
    frequencyMultipliers: [1],
  },
  high: {
    label: 'Hohe Lage',
    subtitle: 'C5 bis H5',
    frequencyMultipliers: [2],
  },
}

export const CAMPAIGN_VOICE_TYPES: Record<
  CampaignVoiceType,
  {
    label: string
    description: string
    startRangeOptions: CampaignRangeId[]
  }
> = {
  bass: {
    label: 'Tiefe Männerstimme (Bass)',
    description: 'Seemannslieder klingen oft so.',
    startRangeOptions: ['male-low'],
  },
  tenor: {
    label: 'Hohe Männerstimme (Tenor)',
    description: 'Klingt oft heller und direkter.',
    startRangeOptions: ['low'],
  },
  alto: {
    label: 'Tiefe Frauenstimme (Alt)',
    description: 'Wirkt oft warm und getragen.',
    startRangeOptions: ['low', 'mid'],
  },
  soprano: {
    label: 'Hohe Frauenstimme (Sopran)',
    description: 'Liegt oft klar und weit oben.',
    startRangeOptions: ['mid', 'high'],
  },
}

export const CAMPAIGN_VOICE_TYPE_IDS = Object.keys(
  CAMPAIGN_VOICE_TYPES,
) as CampaignVoiceType[]

export const DEFAULT_CAMPAIGN_PROGRESS = {
  voiceType: null,
  startRangeId: null,
  currentLevelIdx: 0,
  sectionIdx: 0,
  bestStreak: 0,
  unlockedLevelIdx: 0,
  spentPoints: 0,
} as const

export function createCampaignSessionConfig(
  startRangeId: CampaignRangeId,
  currentLevelIdx: number,
): EarTrainerSessionConfig {
  const safeLevelIdx = Math.max(
    0,
    Math.min(CAMPAIGN_PLAYABLE_LEVEL_COUNT - 1, Math.round(currentLevelIdx)),
  )

  return {
    toneSet: EXERCISES[safeLevelIdx] ?? EXERCISES[0],
    frequencyMultipliers: CAMPAIGN_RANGES[startRangeId].frequencyMultipliers,
    toneStyleCount: 1,
    sectionSteps: SECTION_STEPS,
    levelCount: CAMPAIGN_PLAYABLE_LEVEL_COUNT,
  }
}