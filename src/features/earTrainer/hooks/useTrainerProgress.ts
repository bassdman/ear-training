import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react'

import {
  DIFFICULTY_IDS,
  INSTRUMENT_IDS,
  LEVEL_COUNT,
  PROGRESS_STORAGE_KEY,
  SECTION_COUNT,
  TRAINING_DIFFICULTIES,
  TRAINING_CATEGORIES,
  type InstrumentId,
  type DifficultyId,
  type CategoryDifficultyProgressState,
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

const DEFAULT_CATEGORY_DIFFICULTY_PROGRESS = (): CategoryDifficultyProgressState => ({
  easy: DEFAULT_CATEGORY_PROGRESS(),
  medium: DEFAULT_CATEGORY_PROGRESS(),
  hard: DEFAULT_CATEGORY_PROGRESS(),
})

const clampLevel = (value: number) => Math.min(Math.max(value, 0), LEVEL_COUNT - 1)
const clampSection = (value: number) => Math.min(Math.max(value, 0), SECTION_COUNT - 1)

const normalizeProgressEntry = (source?: Partial<CategoryProgressState>): CategoryProgressState => ({
  levelIdx: clampLevel(source?.levelIdx ?? 0),
  sectionIdx: clampSection(source?.sectionIdx ?? 0),
  unlockedLevelIdx: clampLevel(Math.max(source?.unlockedLevelIdx ?? 0, source?.levelIdx ?? 0)),
})

export function useTrainerProgress() {
  const [loaded, setLoaded] = useState(false)
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0)
  const [activeDifficultyId, setActiveDifficultyId] = useState<DifficultyId>('easy')
  const [categoryDifficultyProgress, setCategoryDifficultyProgress] =
    useState<CategoryDifficultyProgressState>(
      DEFAULT_CATEGORY_DIFFICULTY_PROGRESS,
    )
  const [bestStreakByDifficulty, setBestStreakByDifficulty] = useState<Record<DifficultyId, number>>(
    {
      easy: 0,
      medium: 0,
      hard: 0,
    },
  )
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<InstrumentId>('piano')
  const [playbackVolume, setPlaybackVolume] = useState(100)

  const safeActiveCategoryIdx = useMemo(
    () => Math.min(Math.max(activeCategoryIdx, 0), TRAINING_CATEGORIES.length - 1),
    [activeCategoryIdx],
  )

  const safeActiveDifficultyId = useMemo(
    () => (DIFFICULTY_IDS.includes(activeDifficultyId) ? activeDifficultyId : 'easy'),
    [activeDifficultyId],
  )

  const categoryProgress = categoryDifficultyProgress[safeActiveDifficultyId]
  const activeProgress =
    categoryProgress[safeActiveCategoryIdx] ?? DEFAULT_CATEGORY_PROGRESS()[0]

  const levelIdx = activeProgress.levelIdx
  const sectionIdx = activeProgress.sectionIdx
  const unlockedLevelIdx = activeProgress.unlockedLevelIdx
  const bestStreak = bestStreakByDifficulty[safeActiveDifficultyId] ?? 0

  const updateCategoryValue = useCallback(
    (
      categoryIdx: number,
      difficultyId: DifficultyId,
      key: keyof CategoryProgressState,
      nextValue: SetStateAction<number>,
    ) => {
      setCategoryDifficultyProgress((prev) => {
        const next = { ...prev }
        const nextDifficultyProgress = [...next[difficultyId]]
        const safeIdx = Math.min(Math.max(categoryIdx, 0), TRAINING_CATEGORIES.length - 1)
        const current = nextDifficultyProgress[safeIdx] ?? DEFAULT_CATEGORY_PROGRESS()[0]
        const baseValue = current[key]
        const resolved =
          typeof nextValue === 'function'
            ? (nextValue as (prevState: number) => number)(baseValue)
            : nextValue

        const clamped =
          key === 'sectionIdx'
            ? clampSection(resolved)
            : clampLevel(resolved)

        nextDifficultyProgress[safeIdx] = {
          ...current,
          [key]: clamped,
        }

        if (key !== 'unlockedLevelIdx') {
          const unlocked = Math.max(
            nextDifficultyProgress[safeIdx].unlockedLevelIdx,
            nextDifficultyProgress[safeIdx].levelIdx,
          )
          nextDifficultyProgress[safeIdx].unlockedLevelIdx = clampLevel(unlocked)
        }

        next[difficultyId] = nextDifficultyProgress

        return next
      })
    },
    [],
  )

  const setLevelIdx = useCallback(
    (nextValue: SetStateAction<number>) => {
      updateCategoryValue(safeActiveCategoryIdx, safeActiveDifficultyId, 'levelIdx', nextValue)
    },
    [safeActiveCategoryIdx, safeActiveDifficultyId, updateCategoryValue],
  )

  const setSectionIdx = useCallback(
    (nextValue: SetStateAction<number>) => {
      updateCategoryValue(safeActiveCategoryIdx, safeActiveDifficultyId, 'sectionIdx', nextValue)
    },
    [safeActiveCategoryIdx, safeActiveDifficultyId, updateCategoryValue],
  )

  const setUnlockedLevelIdx = useCallback(
    (nextValue: SetStateAction<number>) => {
      updateCategoryValue(
        safeActiveCategoryIdx,
        safeActiveDifficultyId,
        'unlockedLevelIdx',
        nextValue,
      )
    },
    [safeActiveCategoryIdx, safeActiveDifficultyId, updateCategoryValue],
  )

  const setCategoryLevelIdx = useCallback(
    (categoryIdx: number, difficultyId: DifficultyId, nextValue: SetStateAction<number>) => {
      updateCategoryValue(categoryIdx, difficultyId, 'levelIdx', nextValue)
    },
    [updateCategoryValue],
  )

  const setCategorySectionIdx = useCallback(
    (categoryIdx: number, difficultyId: DifficultyId, nextValue: SetStateAction<number>) => {
      updateCategoryValue(categoryIdx, difficultyId, 'sectionIdx', nextValue)
    },
    [updateCategoryValue],
  )

  const setCategoryUnlockedLevelIdx = useCallback(
    (categoryIdx: number, difficultyId: DifficultyId, nextValue: SetStateAction<number>) => {
      updateCategoryValue(categoryIdx, difficultyId, 'unlockedLevelIdx', nextValue)
    },
    [updateCategoryValue],
  )

  const setBestStreak = useCallback(
    (nextValue: SetStateAction<number>) => {
      setBestStreakByDifficulty((prev) => {
        const current = prev[safeActiveDifficultyId] ?? 0
        const resolved =
          typeof nextValue === 'function'
            ? (nextValue as (prevState: number) => number)(current)
            : nextValue

        return {
          ...prev,
          [safeActiveDifficultyId]: Math.max(0, Math.round(resolved)),
        }
      })
    },
    [safeActiveDifficultyId],
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
          if (
            typeof data.activeDifficultyId === 'string' &&
            DIFFICULTY_IDS.includes(data.activeDifficultyId as DifficultyId)
          ) {
            setActiveDifficultyId(data.activeDifficultyId as DifficultyId)
          }

          if (data.categoryDifficultyProgress) {
            const mappedByDifficulty = DEFAULT_CATEGORY_DIFFICULTY_PROGRESS()

            DIFFICULTY_IDS.forEach((difficultyId) => {
              const sourceList = data.categoryDifficultyProgress?.[difficultyId] ?? []
              mappedByDifficulty[difficultyId] = TRAINING_CATEGORIES.map((_, idx) =>
                normalizeProgressEntry(sourceList[idx]),
              )
            })

            setCategoryDifficultyProgress(mappedByDifficulty)
          } else if (Array.isArray(data.categoryProgress) && data.categoryProgress.length > 0) {
            const mappedEasy = TRAINING_CATEGORIES.map((_, idx) =>
              normalizeProgressEntry(data.categoryProgress?.[idx]),
            )
            setCategoryDifficultyProgress({
              easy: mappedEasy,
              medium: DEFAULT_CATEGORY_PROGRESS(),
              hard: DEFAULT_CATEGORY_PROGRESS(),
            })
          } else {
            const legacyLevel = clampLevel(data.levelIdx ?? 0)
            const legacySection = clampSection(data.sectionIdx ?? 0)
            const legacyUnlocked = clampLevel(
              Math.max(data.unlockedLevelIdx ?? legacyLevel, legacyLevel),
            )
            setCategoryDifficultyProgress((prev) => {
              const next = { ...prev }
              next.easy = [...next.easy]
              next.easy[0] = {
                levelIdx: legacyLevel,
                sectionIdx: legacySection,
                unlockedLevelIdx: legacyUnlocked,
              }
              return next
            })
          }

          if (
            data.bestStreakByDifficulty &&
            typeof data.bestStreakByDifficulty === 'object'
          ) {
            setBestStreakByDifficulty({
              easy: Math.max(0, Math.round(data.bestStreakByDifficulty.easy ?? 0)),
              medium: Math.max(0, Math.round(data.bestStreakByDifficulty.medium ?? 0)),
              hard: Math.max(0, Math.round(data.bestStreakByDifficulty.hard ?? 0)),
            })
          } else if (typeof data.bestStreak === 'number') {
            setBestStreakByDifficulty((prev) => ({
              ...prev,
              easy: Math.max(0, Math.round(data.bestStreak ?? 0)),
            }))
          }

          if (
            typeof data.selectedInstrumentId === 'string' &&
            INSTRUMENT_IDS.includes(data.selectedInstrumentId as InstrumentId)
          ) {
            setSelectedInstrumentId(data.selectedInstrumentId as InstrumentId)
          } else if (typeof data.toneStyleMode === 'string') {
            const migrated = data.toneStyleMode.startsWith('synth')
              ? 'piano'
              : data.toneStyleMode
            if (INSTRUMENT_IDS.includes(migrated as InstrumentId)) {
              setSelectedInstrumentId(migrated as InstrumentId)
            }
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

  const saveProgress = useCallback(async () => {
    try {
      const activeList = categoryDifficultyProgress[safeActiveDifficultyId] ??
        DEFAULT_CATEGORY_PROGRESS()
      const active = activeList[safeActiveCategoryIdx] ?? DEFAULT_CATEGORY_PROGRESS()[0]
      await writeProgress(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({
          activeCategoryIdx: safeActiveCategoryIdx,
          activeDifficultyId: safeActiveDifficultyId,
          categoryDifficultyProgress,
          categoryProgress: categoryDifficultyProgress.easy,
          levelIdx: active.levelIdx,
          sectionIdx: active.sectionIdx,
          bestStreak: bestStreakByDifficulty.easy,
          bestStreakByDifficulty,
          unlockedLevelIdx: active.unlockedLevelIdx,
          selectedInstrumentId,
          playbackVolume,
        }),
      )
    } catch (error) {
      console.error('Speichern fehlgeschlagen', error)
    }
  }, [
    bestStreakByDifficulty,
    categoryDifficultyProgress,
    playbackVolume,
    safeActiveCategoryIdx,
    safeActiveDifficultyId,
    selectedInstrumentId,
  ])

  useEffect(() => {
    if (!loaded) return
    void saveProgress()
  }, [loaded, playbackVolume, saveProgress, selectedInstrumentId])

  return {
    loaded,
    activeCategoryIdx: safeActiveCategoryIdx,
    activeDifficultyId: safeActiveDifficultyId,
    difficultyConfig: TRAINING_DIFFICULTIES,
    difficultyIds: DIFFICULTY_IDS,
    setActiveCategoryIdx,
    setActiveDifficultyId,
    categoryDifficultyProgress,
    categoryProgress,
    levelIdx,
    sectionIdx,
    bestStreak,
    selectedInstrumentId,
    playbackVolume,
    unlockedLevelIdx,
    setLevelIdx,
    setSectionIdx,
    setBestStreak,
    setSelectedInstrumentId,
    setPlaybackVolume,
    setUnlockedLevelIdx,
    setCategoryLevelIdx,
    setCategorySectionIdx,
    setCategoryUnlockedLevelIdx,
  }
}
