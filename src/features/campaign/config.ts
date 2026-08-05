import {
  type NoteName,
  type SessionPitch,
  type ToneSplashMode,
  type EarTrainerSessionConfig,
} from '../earTrainer/config'
import type { CampaignRangeId, CampaignVoiceType } from './types'

export const CAMPAIGN_PROGRESS_STORAGE_KEY = 'earTrainer-campaign-v1'
export const CAMPAIGN_NOTE_COUNT_MIN = 3
export const CAMPAIGN_NOTE_COUNT_MAX = 72
export const CAMPAIGN_FALLBACK_BREAK_OPTIONS = [3, 2, 1, 0] as const
export const CAMPAIGN_TOTAL_NOTES_MIN = 30
export const CAMPAIGN_TOTAL_NOTES_MAX = 100
export const CAMPAIGN_DEFAULT_FALLBACK_BREAK_COUNT = 3
export const CAMPAIGN_DEFAULT_TOTAL_NOTES = 50
const CAMPAIGN_TONE_STYLE_DIFFICULTY_MAX = 4
const CAMPAIGN_TONE_SPLASH_DIFFICULTY_MAX = 4

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
  fallbackBreakCount: CAMPAIGN_DEFAULT_FALLBACK_BREAK_COUNT,
  totalNotes: CAMPAIGN_DEFAULT_TOTAL_NOTES,
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
  fallbackBreakCount: number,
  totalNotes: number,
) {
  const fallbackDifficultyPoints = resolveFallbackBreakDifficultyPoints(fallbackBreakCount)
  const totalNotesDifficultyPoints = resolveTotalNotesDifficultyPoints(totalNotes)

  return (
    Math.max(0, Math.round(noteDifficultyPoints)) +
    Math.max(0, Math.round(toneStyleDifficultyPoints)) +
    Math.max(0, Math.round(toneSplashDifficultyPoints)) +
    fallbackDifficultyPoints +
    totalNotesDifficultyPoints
  )
}

export function resolveRequiredDifficultyForLevel(levelIdx: number) {
  return Math.max(0, Math.round(levelIdx)) + 3
}

export function resolveCampaignSectionSteps(
  fallbackBreakCount: number,
  totalNotes: number,
): number[] {
  const safeFallbackBreakCount = Math.max(0, Math.min(3, Math.round(fallbackBreakCount)))
  const safeTotalNotes = Math.max(
    CAMPAIGN_TOTAL_NOTES_MIN,
    Math.min(CAMPAIGN_TOTAL_NOTES_MAX, Math.round(totalNotes)),
  )
  const fullIntervalCount = 4
  const activeIntervalCount = safeFallbackBreakCount + 1
  const intervalWeights = [1, 1, 1, 2]
  const weightSum = intervalWeights.reduce((sum, weight) => sum + weight, 0)

  const fullSteps = intervalWeights.map((weight) =>
    Math.floor((safeTotalNotes * weight) / weightSum),
  )
  let remainingNotes = safeTotalNotes - fullSteps.reduce((sum, step) => sum + step, 0)
  let fillIdx = fullIntervalCount - 1
  while (remainingNotes > 0) {
    fullSteps[fillIdx] += 1
    fillIdx = fillIdx === 0 ? fullIntervalCount - 1 : fillIdx - 1
    remainingNotes -= 1
  }

  // Wenn Intervalle reduziert werden, entfernen wir immer den letzten Abschnitt.
  return fullSteps.slice(0, activeIntervalCount)
}

export function resolveFallbackBreakDifficultyPoints(fallbackBreakCount: number) {
  const safeFallbackBreakCount = Math.max(0, Math.min(3, Math.round(fallbackBreakCount)))
  return 3 - safeFallbackBreakCount
}

export function resolveTotalNotesDifficultyPoints(totalNotes: number) {
  const safeTotalNotes = Math.max(
    CAMPAIGN_TOTAL_NOTES_MIN,
    Math.min(CAMPAIGN_TOTAL_NOTES_MAX, Math.round(totalNotes)),
  )

  return Math.round(((safeTotalNotes - CAMPAIGN_TOTAL_NOTES_MIN) * 3) / (CAMPAIGN_TOTAL_NOTES_MAX - CAMPAIGN_TOTAL_NOTES_MIN))
}

const CAMPAIGN_MAX_TOTAL_DIFFICULTY = resolveCampaignTotalDifficulty(
  CAMPAIGN_NOTE_COUNT_MAX,
  CAMPAIGN_TONE_STYLE_DIFFICULTY_MAX,
  CAMPAIGN_TONE_SPLASH_DIFFICULTY_MAX,
  0,
  CAMPAIGN_TOTAL_NOTES_MAX,
)

export const CAMPAIGN_LEVEL_COUNT = CAMPAIGN_MAX_TOTAL_DIFFICULTY - 2
export const CAMPAIGN_PLAYABLE_LEVEL_COUNT = CAMPAIGN_LEVEL_COUNT

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

const resolveOrderedMultipliersFromStartRange = (
  startRangeId: CampaignRangeId,
): number[] => {
  const startMultiplier = CAMPAIGN_RANGES[startRangeId].frequencyMultipliers[0] ?? 1
  const startIdx = OCTAVE_MULTIPLIERS.findIndex(
    (multiplier) => multiplier === startMultiplier,
  )

  if (startIdx === -1) {
    return [...OCTAVE_MULTIPLIERS]
  }

  const higherOrEqual = OCTAVE_MULTIPLIERS.slice(startIdx)
  const lower = OCTAVE_MULTIPLIERS.slice(0, startIdx).reverse()
  return [...higherOrEqual, ...lower]
}

const createCampaignPitchPool = (
  startRangeId: CampaignRangeId,
  noteCount: number,
): SessionPitch[] => {
  const orderedMultipliers = resolveOrderedMultipliersFromStartRange(startRangeId)
  const orderedPitches = orderedMultipliers.flatMap((frequencyMultiplier) =>
    NOTE_ORDER_FROM_A.map((note) => ({
      note,
      frequencyMultiplier,
    })),
  )

  return orderedPitches.slice(0, noteCount)
}

const createUniqueNoteSet = (pitchPool: SessionPitch[]): NoteName[] =>
  [...new Set(pitchPool.map((pitch) => pitch.note))] as NoteName[]

const createUniqueMultipliers = (pitchPool: SessionPitch[]): number[] =>
  [...new Set(pitchPool.map((pitch) => pitch.frequencyMultiplier))].sort(
    (a, b) => a - b,
  )

export function createCampaignSessionConfig(
  startRangeId: CampaignRangeId,
  _currentLevelIdx: number,
  noteDifficultyPoints: number,
  toneStyleDifficultyPoints: number,
  toneSplashDifficultyPoints: number,
  fallbackBreakCount: number,
  totalNotes: number,
): EarTrainerSessionConfig {
  const noteCount = resolveCampaignExerciseLevelIdx(noteDifficultyPoints)
  const pitchPool = createCampaignPitchPool(startRangeId, noteCount)
  const aidSettings = resolveCampaignAidSettings(
    toneStyleDifficultyPoints,
    toneSplashDifficultyPoints,
  )
  const sectionSteps = resolveCampaignSectionSteps(
    fallbackBreakCount,
    totalNotes,
  )

  return {
    toneSet: createUniqueNoteSet(pitchPool),
    frequencyMultipliers: createUniqueMultipliers(pitchPool),
    pitchPool,
    toneStyleCount: aidSettings.toneStyleCount,
    sectionSteps,
    levelCount: CAMPAIGN_LEVEL_COUNT,
  }
}