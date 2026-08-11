import type { ToneSplashMode } from "../../features/earTrainer/config"
import { CAMPAIGN_NOTE_COUNT_MAX, CAMPAIGN_NOTE_COUNT_MIN, CAMPAIGN_RANGES, CAMPAIGN_TOTAL_NOTES_MAX, CAMPAIGN_TOTAL_NOTES_MIN, OCTAVE_MULTIPLIERS, type CampaignAidSettings } from "./config"
import type { CampaignRangeId } from "./types"

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

export const resolveOrderedMultipliersFromStartRange = (
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



