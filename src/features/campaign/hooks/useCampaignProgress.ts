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

const normalizeProgress = (raw?: Partial<CampaignProgressState>): CampaignProgressState => ({
  voiceType: raw?.voiceType ?? DEFAULT_CAMPAIGN_PROGRESS.voiceType,
  startRangeId: raw?.startRangeId ?? DEFAULT_CAMPAIGN_PROGRESS.startRangeId,
  currentLevelIdx: clampLevel(raw?.currentLevelIdx ?? 0),
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
      unlockedLevelIdx: 0,
      spentPoints: 0,
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
    resetProfile,
  }
}