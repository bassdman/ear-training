import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react'

import {
  LEVEL_COUNT,
  PROGRESS_STORAGE_KEY,
  SECTION_COUNT,
  TRAINING_CATEGORIES,
  TONE_STYLE_IDS,
  type ToneStyleMode,
  type CategoryProgressState,
  type ProgressState,
} from '../config'
import { readProgress, writeProgress } from '../storage'

const DEFAULT_CATEGORY_PROGRESS = (): CategoryProgressState[] =>
  TRAINING_CATEGORIES.map(() => ({
    levelIdx: 0,
    sectionIdx: 0,
    unlockedLevelIdx: 0,
  }))

const clampLevel = (value: number) => Math.min(Math.max(value, 0), LEVEL_COUNT - 1)
const clampSection = (value: number) => Math.min(Math.max(value, 0), SECTION_COUNT - 1)

export function useTrainerProgress() {
  const [loaded, setLoaded] = useState(false)
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0)
  const [categoryProgress, setCategoryProgress] = useState<CategoryProgressState[]>(
    DEFAULT_CATEGORY_PROGRESS,
  )
  const [bestStreak, setBestStreak] = useState(0)
  const [toneStyleMode, setToneStyleMode] = useState<ToneStyleMode>('auto')
  const [playbackVolume, setPlaybackVolume] = useState(100)

  const safeActiveCategoryIdx = useMemo(
    () => Math.min(Math.max(activeCategoryIdx, 0), TRAINING_CATEGORIES.length - 1),
    [activeCategoryIdx],
  )

  const activeProgress =
    categoryProgress[safeActiveCategoryIdx] ?? DEFAULT_CATEGORY_PROGRESS()[0]

  const levelIdx = activeProgress.levelIdx
  const sectionIdx = activeProgress.sectionIdx
  const unlockedLevelIdx = activeProgress.unlockedLevelIdx

  const updateCategoryValue = useCallback(
    (
      categoryIdx: number,
      key: keyof CategoryProgressState,
      nextValue: SetStateAction<number>,
    ) => {
      setCategoryProgress((prev) => {
        const next = [...prev]
        const safeIdx = Math.min(Math.max(categoryIdx, 0), TRAINING_CATEGORIES.length - 1)
        const current = next[safeIdx] ?? DEFAULT_CATEGORY_PROGRESS()[0]
        const baseValue = current[key]
        const resolved =
          typeof nextValue === 'function'
            ? (nextValue as (prevState: number) => number)(baseValue)
            : nextValue

        const clamped =
          key === 'sectionIdx'
            ? clampSection(resolved)
            : clampLevel(resolved)

        next[safeIdx] = {
          ...current,
          [key]: clamped,
        }

        if (key !== 'unlockedLevelIdx') {
          const unlocked = Math.max(next[safeIdx].unlockedLevelIdx, next[safeIdx].levelIdx)
          next[safeIdx].unlockedLevelIdx = clampLevel(unlocked)
        }

        return next
      })
    },
    [],
  )

  const setLevelIdx = useCallback(
    (nextValue: SetStateAction<number>) => {
      updateCategoryValue(safeActiveCategoryIdx, 'levelIdx', nextValue)
    },
    [safeActiveCategoryIdx, updateCategoryValue],
  )

  const setSectionIdx = useCallback(
    (nextValue: SetStateAction<number>) => {
      updateCategoryValue(safeActiveCategoryIdx, 'sectionIdx', nextValue)
    },
    [safeActiveCategoryIdx, updateCategoryValue],
  )

  const setUnlockedLevelIdx = useCallback(
    (nextValue: SetStateAction<number>) => {
      updateCategoryValue(safeActiveCategoryIdx, 'unlockedLevelIdx', nextValue)
    },
    [safeActiveCategoryIdx, updateCategoryValue],
  )

  const setCategoryLevelIdx = useCallback(
    (categoryIdx: number, nextValue: SetStateAction<number>) => {
      updateCategoryValue(categoryIdx, 'levelIdx', nextValue)
    },
    [updateCategoryValue],
  )

  const setCategorySectionIdx = useCallback(
    (categoryIdx: number, nextValue: SetStateAction<number>) => {
      updateCategoryValue(categoryIdx, 'sectionIdx', nextValue)
    },
    [updateCategoryValue],
  )

  const setCategoryUnlockedLevelIdx = useCallback(
    (categoryIdx: number, nextValue: SetStateAction<number>) => {
      updateCategoryValue(categoryIdx, 'unlockedLevelIdx', nextValue)
    },
    [updateCategoryValue],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const rawProgress = await readProgress(PROGRESS_STORAGE_KEY)
        if (rawProgress) {
          const data = JSON.parse(rawProgress) as ProgressState
          if (typeof data.activeCategoryIdx === 'number') {
            setActiveCategoryIdx(data.activeCategoryIdx)
          }

          if (Array.isArray(data.categoryProgress) && data.categoryProgress.length > 0) {
            const mapped = TRAINING_CATEGORIES.map((_, idx) => {
              const source = data.categoryProgress?.[idx]
              return {
                levelIdx: clampLevel(source?.levelIdx ?? 0),
                sectionIdx: clampSection(source?.sectionIdx ?? 0),
                unlockedLevelIdx: clampLevel(
                  Math.max(source?.unlockedLevelIdx ?? 0, source?.levelIdx ?? 0),
                ),
              }
            })
            setCategoryProgress(mapped)
          } else {
            const legacyLevel = clampLevel(data.levelIdx ?? 0)
            const legacySection = clampSection(data.sectionIdx ?? 0)
            const legacyUnlocked = clampLevel(
              Math.max(data.unlockedLevelIdx ?? legacyLevel, legacyLevel),
            )
            setCategoryProgress((prev) => {
              const next = [...prev]
              next[0] = {
                levelIdx: legacyLevel,
                sectionIdx: legacySection,
                unlockedLevelIdx: legacyUnlocked,
              }
              return next
            })
          }

          if (typeof data.bestStreak === 'number') setBestStreak(data.bestStreak)
          if (
            data.toneStyleMode === 'auto' ||
            (typeof data.toneStyleMode === 'string' &&
              TONE_STYLE_IDS.includes(data.toneStyleMode as (typeof TONE_STYLE_IDS)[number]))
          ) {
            setToneStyleMode(data.toneStyleMode)
          }
          if (typeof data.playbackVolume === 'number') {
            setPlaybackVolume(Math.min(127, Math.max(0, data.playbackVolume)))
          }
        }
      } catch {
        // noch kein gespeicherter Fortschritt
      }
      setLoaded(true)
    })()
  }, [])

  const saveProgress = useCallback(async (best: number) => {
    try {
      const active = categoryProgress[safeActiveCategoryIdx] ?? DEFAULT_CATEGORY_PROGRESS()[0]
      await writeProgress(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({
          activeCategoryIdx: safeActiveCategoryIdx,
          categoryProgress,
          levelIdx: active.levelIdx,
          sectionIdx: active.sectionIdx,
          bestStreak: best,
          unlockedLevelIdx: active.unlockedLevelIdx,
          toneStyleMode,
          playbackVolume,
        }),
      )
    } catch (error) {
      console.error('Speichern fehlgeschlagen', error)
    }
  }, [categoryProgress, playbackVolume, safeActiveCategoryIdx, toneStyleMode])

  useEffect(() => {
    if (!loaded) return
    void saveProgress(bestStreak)
  }, [bestStreak, loaded, playbackVolume, saveProgress, toneStyleMode])

  return {
    loaded,
    activeCategoryIdx: safeActiveCategoryIdx,
    setActiveCategoryIdx,
    categoryProgress,
    levelIdx,
    sectionIdx,
    bestStreak,
    toneStyleMode,
    playbackVolume,
    unlockedLevelIdx,
    setLevelIdx,
    setSectionIdx,
    setBestStreak,
    setToneStyleMode,
    setPlaybackVolume,
    setUnlockedLevelIdx,
    setCategoryLevelIdx,
    setCategorySectionIdx,
    setCategoryUnlockedLevelIdx,
  }
}
