import {
  EXERCISES,
  SECTION_STEPS,
  type ToneSplashMode,
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
  noteDifficultyPoints: 1,
  toneStyleDifficultyPoints: 1,
  toneSplashDifficultyPoints: 1,
} as const

export type CampaignAidSettings = {
  toneStyleCount: number
  toneSplashMode: ToneSplashMode
}

export function resolveCampaignExerciseLevelIdx(
  currentLevelIdx: number,
  noteDifficultyPoints: number,
) {
  const effectiveLevelIdx =
    Math.round(currentLevelIdx) + Math.max(0, Math.round(noteDifficultyPoints - 1))

  return Math.max(0, Math.min(CAMPAIGN_PLAYABLE_LEVEL_COUNT - 1, effectiveLevelIdx))
}

export function resolveCampaignAidSettings(
  toneStyleDifficultyPoints: number,
  toneSplashDifficultyPoints: number,
): CampaignAidSettings {
  const toneStyleCountMap = [1, 2, 2, 3, 4]
  const toneSplashModeMap: ToneSplashMode[] = [
    'persistent',
    'persistent',
    'transient',
    'transient',
    'off',
  ]

  const safeToneStyleIdx = Math.max(0, Math.min(4, Math.round(toneStyleDifficultyPoints)))
  const safeToneSplashIdx = Math.max(0, Math.min(4, Math.round(toneSplashDifficultyPoints)))

  return {
    toneStyleCount: toneStyleCountMap[safeToneStyleIdx] ?? 1,
    toneSplashMode: toneSplashModeMap[safeToneSplashIdx] ?? 'persistent',
  }
}

export function resolveCampaignTotalDifficulty(
  noteDifficultyPoints: number,
  toneStyleDifficultyPoints: number,
  toneSplashDifficultyPoints: number,
) {
  return (
    Math.max(0, Math.round(noteDifficultyPoints)) +
    Math.max(0, Math.round(toneStyleDifficultyPoints)) +
    Math.max(0, Math.round(toneSplashDifficultyPoints))
  )
}

export function resolveRequiredDifficultyForLevel(levelIdx: number) {
  return Math.max(0, Math.round(levelIdx)) + 3
}

export function createCampaignSessionConfig(
  startRangeId: CampaignRangeId,
  currentLevelIdx: number,
  noteDifficultyPoints: number,
  toneStyleDifficultyPoints: number,
  toneSplashDifficultyPoints: number,
): EarTrainerSessionConfig {
  const safeLevelIdx = resolveCampaignExerciseLevelIdx(
    currentLevelIdx,
    noteDifficultyPoints,
  )
  const aidSettings = resolveCampaignAidSettings(
    toneStyleDifficultyPoints,
    toneSplashDifficultyPoints,
  )

  return {
    toneSet: EXERCISES[safeLevelIdx] ?? EXERCISES[0],
    frequencyMultipliers: CAMPAIGN_RANGES[startRangeId].frequencyMultipliers,
    toneStyleCount: aidSettings.toneStyleCount,
    sectionSteps: SECTION_STEPS,
    levelCount: CAMPAIGN_PLAYABLE_LEVEL_COUNT,
  }
}