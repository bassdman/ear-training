import {
  SECTION_STEPS,
  type NoteName,
  type SessionPitch,
  type ToneSplashMode,
  type EarTrainerSessionConfig,
} from '../earTrainer/config'
import type { CampaignRangeId, CampaignVoiceType } from './types'

export const CAMPAIGN_LEVEL_COUNT = 80
export const CAMPAIGN_PLAYABLE_LEVEL_COUNT = CAMPAIGN_LEVEL_COUNT
export const CAMPAIGN_PROGRESS_STORAGE_KEY = 'earTrainer-campaign-v1'
export const CAMPAIGN_NOTE_COUNT_MIN = 3
export const CAMPAIGN_NOTE_COUNT_MAX = 72

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
  noteDifficultyPoints: CAMPAIGN_NOTE_COUNT_MIN,
  toneStyleDifficultyPoints: 0,
  toneSplashDifficultyPoints: 0,
} as const

export type CampaignAidSettings = {
  toneStyleCount: number
  toneSplashMode: ToneSplashMode
}

export function resolveCampaignExerciseLevelIdx(
  noteDifficultyPoints: number,
) {
  return Math.max(
    CAMPAIGN_NOTE_COUNT_MIN,
    Math.min(CAMPAIGN_NOTE_COUNT_MAX, Math.round(noteDifficultyPoints)),
  )
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

const NOTE_ORDER_FROM_A: NoteName[] = [
  'A',
  'Ais',
  'H',
  'C',
  'Cis',
  'D',
  'Dis',
  'E',
  'F',
  'Fis',
  'G',
  'Gis',
]

const OCTAVE_MULTIPLIERS = [0.125, 0.25, 0.5, 1, 2, 4]

const ALL_CAMPAIGN_PITCHES: SessionPitch[] = OCTAVE_MULTIPLIERS.flatMap(
  (frequencyMultiplier) =>
    NOTE_ORDER_FROM_A.map((note) => ({
      note,
      frequencyMultiplier,
    })),
)

const createCampaignPitchPool = (noteCount: number): SessionPitch[] =>
  ALL_CAMPAIGN_PITCHES.slice(0, noteCount)

const createUniqueNoteSet = (pitchPool: SessionPitch[]): NoteName[] =>
  [...new Set(pitchPool.map((pitch) => pitch.note))] as NoteName[]

const createUniqueMultipliers = (pitchPool: SessionPitch[]): number[] =>
  [...new Set(pitchPool.map((pitch) => pitch.frequencyMultiplier))].sort(
    (a, b) => a - b,
  )

export function createCampaignSessionConfig(
  _startRangeId: CampaignRangeId,
  _currentLevelIdx: number,
  noteDifficultyPoints: number,
  toneStyleDifficultyPoints: number,
  toneSplashDifficultyPoints: number,
): EarTrainerSessionConfig {
  const noteCount = resolveCampaignExerciseLevelIdx(noteDifficultyPoints)
  const pitchPool = createCampaignPitchPool(noteCount)
  const aidSettings = resolveCampaignAidSettings(
    toneStyleDifficultyPoints,
    toneSplashDifficultyPoints,
  )

  return {
    toneSet: createUniqueNoteSet(pitchPool),
    frequencyMultipliers: createUniqueMultipliers(pitchPool),
    pitchPool,
    toneStyleCount: aidSettings.toneStyleCount,
    sectionSteps: SECTION_STEPS,
    levelCount: CAMPAIGN_LEVEL_COUNT,
  }
}