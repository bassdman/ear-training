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
const clampDifficultySlider = (value: number) => Math.max(0, Math.min(4, Math.round(value)))

const normalizeProgress = (raw?: Partial<CampaignProgressState>): CampaignProgressState => {
  const currentLevelIdx = clampPlayableLevel(raw?.currentLevelIdx ?? 0)
  const spentPoints = clampNonNegative(raw?.spentPoints ?? 0)
  return {
    voiceType: raw?.voiceType ?? DEFAULT_CAMPAIGN_PROGRESS.voiceType,
    startRangeId: raw?.startRangeId ?? DEFAULT_CAMPAIGN_PROGRESS.startRangeId,
    currentLevelIdx,
    sectionIdx: clampSection(raw?.sectionIdx ?? 0),
    bestStreak: Math.max(0, Math.round(raw?.bestStreak ?? 0)),
    unlockedLevelIdx: clampPlayableLevel(
      Math.max(raw?.unlockedLevelIdx ?? 0, currentLevelIdx),
    ),
    spentPoints,
    noteDifficultyPoints: clampDifficultySlider(raw?.noteDifficultyPoints ?? 1),
    toneStyleDifficultyPoints: clampDifficultySlider(raw?.toneStyleDifficultyPoints ?? 1),
    toneSplashDifficultyPoints: clampDifficultySlider(raw?.toneSplashDifficultyPoints ?? 1),
  }
}

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
      noteDifficultyPoints: 1,
      toneStyleDifficultyPoints: 1,
      toneSplashDifficultyPoints: 1,
    })
  }

  const setCurrentLevelIdx = (nextValue: React.SetStateAction<number>) => {
    setProgress((prev) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(prev.currentLevelIdx) : nextValue
      const currentLevelIdx = clampPlayableLevel(resolved)

      return normalizeProgress({
        ...prev,
        currentLevelIdx,
        unlockedLevelIdx: Math.max(prev.unlockedLevelIdx, currentLevelIdx),
      })
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
      const nextUnlockedLevelIdx = Math.max(
        prev.currentLevelIdx,
        clampPlayableLevel(resolved),
      )

      return normalizeProgress({
        ...prev,
        unlockedLevelIdx: nextUnlockedLevelIdx,
        spentPoints: Math.max(prev.spentPoints, nextUnlockedLevelIdx),
      })
    })
  }

  const setCampaignDifficulty = (next: {
    notes: number
    toneStyle: number
    toneSplash: number
  }) => {
    setProgress((prev) => {
      return normalizeProgress({
        ...prev,
        noteDifficultyPoints: next.notes,
        toneStyleDifficultyPoints: next.toneStyle,
        toneSplashDifficultyPoints: next.toneSplash,
      })
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
    setCampaignDifficulty,
    resetProfile,
  }
}