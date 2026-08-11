import type { EarTrainerSessionConfig, NoteName, SessionPitch } from "../../earTrainer/config"
import { CAMPAIGN_LEVEL_COUNT, NOTE_ORDER_FROM_A } from "../config"
import { resolveCampaignAidSettings, resolveCampaignExerciseLevelIdx, resolveCampaignSectionSteps, resolveOrderedMultipliersFromStartRange } from "../helpers"
import type { CampaignRangeId } from "../types"



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