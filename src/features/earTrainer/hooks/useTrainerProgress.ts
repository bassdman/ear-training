import { useCallback, useEffect, useState } from 'react'

import { PROGRESS_STORAGE_KEY, type ProgressState } from '../config'
import { readProgress, writeProgress } from '../storage'

export function useTrainerProgress() {
  const [loaded, setLoaded] = useState(false)
  const [levelIdx, setLevelIdx] = useState(0)
  const [sectionIdx, setSectionIdx] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [unlockedLevelIdx, setUnlockedLevelIdx] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        const rawProgress = await readProgress(PROGRESS_STORAGE_KEY)
        if (rawProgress) {
          const data = JSON.parse(rawProgress) as ProgressState
          if (typeof data.levelIdx === 'number') setLevelIdx(data.levelIdx)
          if (typeof data.sectionIdx === 'number') setSectionIdx(data.sectionIdx)
          if (typeof data.bestStreak === 'number') setBestStreak(data.bestStreak)
          if (typeof data.unlockedLevelIdx === 'number') {
            setUnlockedLevelIdx(data.unlockedLevelIdx)
          } else if (typeof data.levelIdx === 'number') {
            setUnlockedLevelIdx(data.levelIdx)
          }
        }
      } catch {
        // noch kein gespeicherter Fortschritt
      }
      setLoaded(true)
    })()
  }, [])

  const saveProgress = useCallback(async (lvl: number, sec: number, best: number) => {
    try {
      await writeProgress(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({
          levelIdx: lvl,
          sectionIdx: sec,
          bestStreak: best,
          unlockedLevelIdx,
        }),
      )
    } catch (error) {
      console.error('Speichern fehlgeschlagen', error)
    }
  }, [unlockedLevelIdx])

  useEffect(() => {
    setUnlockedLevelIdx((prev) => Math.max(prev, levelIdx))
  }, [levelIdx])

  useEffect(() => {
    if (!loaded) return
    void saveProgress(levelIdx, sectionIdx, bestStreak)
  }, [bestStreak, levelIdx, loaded, saveProgress, sectionIdx, unlockedLevelIdx])

  return {
    loaded,
    levelIdx,
    sectionIdx,
    bestStreak,
    unlockedLevelIdx,
    setLevelIdx,
    setSectionIdx,
    setBestStreak,
    setUnlockedLevelIdx,
  }
}
