import { useEffect, useMemo, useState } from 'react'

import {
  CAMPAIGN_PLAYABLE_LEVEL_COUNT,
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  DEFAULT_CAMPAIGN_PROGRESS,
} from '../config'
import { readCampaignProgress, writeCampaignProgress } from '../storage'
import type {
  CampaignProgressState,
  CampaignRangeId,
  CampaignVoiceType,
} from '../types'

const clampSection = (value: number) => Math.max(0, Math.min(3, Math.round(value)))
const clampPlayableLevel = (value: number) =>
  Math.max(0, Math.min(CAMPAIGN_PLAYABLE_LEVEL_COUNT - 1, Math.round(value)))
const clampNonNegative = (value: number) => Math.max(0, Math.round(value))
const clampAidReduction = (value: number) => Math.max(0, Math.min(2, Math.round(value)))

const normalizeProgress = (raw?: Partial<CampaignProgressState>): CampaignProgressState => ({
  voiceType: raw?.voiceType ?? DEFAULT_CAMPAIGN_PROGRESS.voiceType,
  startRangeId: raw?.startRangeId ?? DEFAULT_CAMPAIGN_PROGRESS.startRangeId,
  currentLevelIdx: clampPlayableLevel(raw?.currentLevelIdx ?? 0),
  sectionIdx: clampSection(raw?.sectionIdx ?? 0),
  bestStreak: Math.max(0, Math.round(raw?.bestStreak ?? 0)),
  unlockedLevelIdx: clampPlayableLevel(
    Math.max(raw?.unlockedLevelIdx ?? 0, raw?.currentLevelIdx ?? 0),
  ),
  spentPoints: clampNonNegative(raw?.spentPoints ?? 0),
  noteUpgradePoints: clampNonNegative(raw?.noteUpgradePoints ?? 0),
  aidReductionPoints: clampAidReduction(raw?.aidReductionPoints ?? 0),
})

export function useCampaignProgress() {
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState<CampaignProgressState>(
    normalizeProgress(DEFAULT_CAMPAIGN_PROGRESS),
  )

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await readCampaignProgress(CAMPAIGN_PROGRESS_STORAGE_KEY)
        if (raw) {
          setProgress(normalizeProgress(JSON.parse(raw) as Partial<CampaignProgressState>))
        }
      } finally {
        setLoaded(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!loaded) return
    void writeCampaignProgress(
      CAMPAIGN_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    )
  }, [loaded, progress])

  const hasProfile = useMemo(
    () => Boolean(progress.voiceType && progress.startRangeId),
    [progress.startRangeId, progress.voiceType],
  )

  const setProfile = (voiceType: CampaignVoiceType, startRangeId: CampaignRangeId) => {
    setProgress({
      voiceType,
      startRangeId,
      currentLevelIdx: 0,
      sectionIdx: 0,
      bestStreak: 0,
      unlockedLevelIdx: 0,
      spentPoints: 0,
      noteUpgradePoints: 0,
      aidReductionPoints: 0,
    })
  }

  const setCurrentLevelIdx = (nextValue: React.SetStateAction<number>) => {
    setProgress((prev) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(prev.currentLevelIdx) : nextValue
      const currentLevelIdx = clampPlayableLevel(resolved)

      return {
        ...prev,
        currentLevelIdx,
        unlockedLevelIdx: Math.max(prev.unlockedLevelIdx, currentLevelIdx),
      }
    })
  }

  const setSectionIdx = (nextValue: React.SetStateAction<number>) => {
    setProgress((prev) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(prev.sectionIdx) : nextValue

      return {
        ...prev,
        sectionIdx: clampSection(resolved),
      }
    })
  }

  const setBestStreak = (nextValue: React.SetStateAction<number>) => {
    setProgress((prev) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(prev.bestStreak) : nextValue

      return {
        ...prev,
        bestStreak: Math.max(0, Math.round(resolved)),
      }
    })
  }

  const setUnlockedLevelIdx = (nextValue: React.SetStateAction<number>) => {
    setProgress((prev) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(prev.unlockedLevelIdx) : nextValue

      return {
        ...prev,
        unlockedLevelIdx: Math.max(prev.currentLevelIdx, clampPlayableLevel(resolved)),
        spentPoints: Math.max(prev.spentPoints, Math.max(prev.currentLevelIdx, clampPlayableLevel(resolved))),
      }
    })
  }

  const allocatePoint = (kind: 'notes' | 'aids') => {
    setProgress((prev) => {
      const allocatedPoints = prev.noteUpgradePoints + prev.aidReductionPoints
      const pendingPoints = Math.max(0, prev.spentPoints - allocatedPoints)
      if (pendingPoints < 1) {
        return prev
      }

      if (kind === 'notes') {
        return {
          ...prev,
          noteUpgradePoints: prev.noteUpgradePoints + 1,
        }
      }

      if (prev.aidReductionPoints >= 2) {
        return prev
      }

      return {
        ...prev,
        aidReductionPoints: prev.aidReductionPoints + 1,
      }
    })
  }

  const resetProfile = () => {
    setProgress(normalizeProgress(DEFAULT_CAMPAIGN_PROGRESS))
  }

  return {
    loaded,
    progress,
    hasProfile,
    setProfile,
    setCurrentLevelIdx,
    setSectionIdx,
    setBestStreak,
    setUnlockedLevelIdx,
    allocatePoint,
    resetProfile,
  }
}