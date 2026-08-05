import { useEffect, useMemo, useState } from 'react'

import {
  CAMPAIGN_DEFAULT_FALLBACK_BREAK_COUNT,
  CAMPAIGN_DEFAULT_TOTAL_NOTES,
  CAMPAIGN_FALLBACK_BREAK_OPTIONS,
  CAMPAIGN_NOTE_COUNT_MAX,
  CAMPAIGN_NOTE_COUNT_MIN,
  CAMPAIGN_PLAYABLE_LEVEL_COUNT,
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  CAMPAIGN_TOTAL_NOTES_MAX,
  CAMPAIGN_TOTAL_NOTES_MIN,
  DEFAULT_CAMPAIGN_PROGRESS,
} from '../config'
import { readCampaignProgress, writeCampaignProgress } from '../storage'
import type {
  CampaignProgressState,
  CampaignRangeId,
  CampaignVoiceType,
} from '../types'

const clampSection = (value: number, fallbackBreakCount: number) =>
  Math.max(0, Math.min(fallbackBreakCount, Math.round(value)))
const clampPlayableLevel = (value: number) =>
  Math.max(0, Math.min(CAMPAIGN_PLAYABLE_LEVEL_COUNT - 1, Math.round(value)))
const clampNonNegative = (value: number) => Math.max(0, Math.round(value))
const clampAidSlider = (value: number) => Math.max(0, Math.min(4, Math.round(value)))
const clampNoteCount = (value: number) =>
  Math.max(CAMPAIGN_NOTE_COUNT_MIN, Math.min(CAMPAIGN_NOTE_COUNT_MAX, Math.round(value)))
const clampFallbackBreakCount = (value: number) =>
  CAMPAIGN_FALLBACK_BREAK_OPTIONS.includes(
    Math.round(value) as (typeof CAMPAIGN_FALLBACK_BREAK_OPTIONS)[number],
  )
    ? Math.round(value)
    : CAMPAIGN_DEFAULT_FALLBACK_BREAK_COUNT
const clampTotalNotes = (value: number) =>
  Math.max(CAMPAIGN_TOTAL_NOTES_MIN, Math.min(CAMPAIGN_TOTAL_NOTES_MAX, Math.round(value)))

const normalizeProgress = (raw?: Partial<CampaignProgressState>): CampaignProgressState => {
  const currentLevelIdx = clampPlayableLevel(raw?.currentLevelIdx ?? 0)
  const spentPoints = clampNonNegative(raw?.spentPoints ?? 0)
  const fallbackBreakCount = clampFallbackBreakCount(
    raw?.fallbackBreakCount ?? CAMPAIGN_DEFAULT_FALLBACK_BREAK_COUNT,
  )
  const totalNotes = clampTotalNotes(
    (raw?.totalNotes ??
      (raw as { intervalToneCount?: number } | undefined)?.intervalToneCount ??
      CAMPAIGN_DEFAULT_TOTAL_NOTES),
  )
  return {
    voiceType: raw?.voiceType ?? DEFAULT_CAMPAIGN_PROGRESS.voiceType,
    startRangeId: raw?.startRangeId ?? DEFAULT_CAMPAIGN_PROGRESS.startRangeId,
    currentLevelIdx,
    sectionIdx: clampSection(raw?.sectionIdx ?? 0, fallbackBreakCount),
    bestStreak: Math.max(0, Math.round(raw?.bestStreak ?? 0)),
    unlockedLevelIdx: clampPlayableLevel(
      Math.max(raw?.unlockedLevelIdx ?? 0, currentLevelIdx),
    ),
    spentPoints,
    noteDifficultyPoints: clampNoteCount(raw?.noteDifficultyPoints ?? CAMPAIGN_NOTE_COUNT_MIN),
    toneStyleDifficultyPoints: clampAidSlider(raw?.toneStyleDifficultyPoints ?? 0),
    toneSplashDifficultyPoints: clampAidSlider(raw?.toneSplashDifficultyPoints ?? 0),
    fallbackBreakCount,
    totalNotes,
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
    () => Boolean(progress.startRangeId),
    [progress.startRangeId],
  )

  const resolveVoiceTypeForRange = (startRangeId: CampaignRangeId): CampaignVoiceType => {
    switch (startRangeId) {
      case 'male-low':
        return 'bass'
      case 'low':
        return 'tenor'
      case 'mid':
        return 'alto'
      case 'high':
      default:
        return 'soprano'
    }
  }

  const setProfile = (voiceType: CampaignVoiceType, startRangeId: CampaignRangeId) => {
    setProgress({
      voiceType,
      startRangeId,
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

  const setStartRangeId = (startRangeId: CampaignRangeId) => {
    setProgress((prev) =>
      normalizeProgress({
        ...prev,
        startRangeId,
        voiceType: resolveVoiceTypeForRange(startRangeId),
      }),
    )
  }

  const setSectionIdx = (nextValue: React.SetStateAction<number>) => {
    setProgress((prev) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(prev.sectionIdx) : nextValue

      return {
        ...prev,
        sectionIdx: clampSection(resolved, prev.fallbackBreakCount),
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
    fallbackBreakCount: number
    totalNotes: number
  }) => {
    setProgress((prev) => {
      return normalizeProgress({
        ...prev,
        noteDifficultyPoints: next.notes,
        toneStyleDifficultyPoints: next.toneStyle,
        toneSplashDifficultyPoints: next.toneSplash,
        fallbackBreakCount: next.fallbackBreakCount,
        totalNotes: next.totalNotes,
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
    setStartRangeId,
    setCampaignDifficulty,
    resetProfile,
  }
}