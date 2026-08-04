import { useEffect, useMemo, useState } from 'react'

import {
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  DEFAULT_CAMPAIGN_PROGRESS,
} from '../config'
import { readCampaignProgress, writeCampaignProgress } from '../storage'
import type {
  CampaignProgressState,
  CampaignRangeId,
  CampaignVoiceType,
} from '../types'

const clampLevel = (value: number) => Math.max(0, Math.min(79, Math.round(value)))
const clampSection = (value: number) => Math.max(0, Math.min(3, Math.round(value)))

const normalizeProgress = (raw?: Partial<CampaignProgressState>): CampaignProgressState => ({
  voiceType: raw?.voiceType ?? DEFAULT_CAMPAIGN_PROGRESS.voiceType,
  startRangeId: raw?.startRangeId ?? DEFAULT_CAMPAIGN_PROGRESS.startRangeId,
  currentLevelIdx: clampLevel(raw?.currentLevelIdx ?? 0),
  sectionIdx: clampSection(raw?.sectionIdx ?? 0),
  bestStreak: Math.max(0, Math.round(raw?.bestStreak ?? 0)),
  unlockedLevelIdx: clampLevel(
    Math.max(raw?.unlockedLevelIdx ?? 0, raw?.currentLevelIdx ?? 0),
  ),
  spentPoints: Math.max(0, Math.round(raw?.spentPoints ?? 0)),
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
    })
  }

  const setCurrentLevelIdx = (nextValue: React.SetStateAction<number>) => {
    setProgress((prev) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(prev.currentLevelIdx) : nextValue
      const currentLevelIdx = clampLevel(resolved)

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
        unlockedLevelIdx: Math.max(prev.currentLevelIdx, clampLevel(resolved)),
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
    resetProfile,
  }
}