import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import {
  EXERCISES,
  formatPitchLabel,
  type GuessOption,
  LEVEL_PROGRESS_TOTAL,
  LEVEL_COUNT,
  SECTION_STEPS,
  TONE_STYLE_IDS,
  type Feedback,
  type NoteName,
  type ToneStyleId,
  type Trial,
} from '../config'

type ProgressSetters = {
  setLevelIdx: Dispatch<SetStateAction<number>>
  setSectionIdx: Dispatch<SetStateAction<number>>
  setBestStreak: Dispatch<SetStateAction<number>>
  setUnlockedLevelIdx: Dispatch<SetStateAction<number>>
}

type UseEarTrainerGameOptions = {
  levelIdx: number
  sectionIdx: number
  bestStreak: number
  progressSetters: ProgressSetters
  frequencyMultipliers: number[]
}

export function useEarTrainerGame({
  levelIdx,
  sectionIdx,
  bestStreak,
  progressSetters,
  frequencyMultipliers,
}: UseEarTrainerGameOptions) {
  const [sectionProgress, setSectionProgress] = useState(0)
  const [currentTrial, setCurrentTrial] = useState<Trial | null>(null)
  const [forcedTrial, setForcedTrial] = useState<Trial | null>(null)
  const [awaitingGuess, setAwaitingGuess] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [leveledUpToast, setLeveledUpToast] = useState<string | null>(null)
  const [sessionGuesses, setSessionGuesses] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)

  const toneSet = EXERCISES[levelIdx]
  const activeMultipliers = useMemo(
    () => [...new Set(frequencyMultipliers)].sort((a, b) => a - b),
    [frequencyMultipliers],
  )

  const guessOptions = useMemo(
    () =>
      toneSet.flatMap((note) =>
        activeMultipliers.map((frequencyMultiplier) => ({
          id: `${note}|${frequencyMultiplier}`,
          note,
          frequencyMultiplier,
          label: formatPitchLabel(note as NoteName, frequencyMultiplier),
        })),
      ) as GuessOption[],
    [activeMultipliers, toneSet],
  )

  const unlockedToneStyles = useMemo(
    () => TONE_STYLE_IDS.slice(0, sectionIdx + 1),
    [sectionIdx],
  )

  useEffect(() => {
    setSectionProgress(0)
  }, [levelIdx, sectionIdx])

  const sectionStart = useMemo(
    () => SECTION_STEPS.slice(0, sectionIdx).reduce((sum, steps) => sum + steps, 0),
    [sectionIdx],
  )
  const sectionTarget = SECTION_STEPS[sectionIdx] ?? SECTION_STEPS[SECTION_STEPS.length - 1]
  const levelProgress = Math.min(LEVEL_PROGRESS_TOTAL, sectionStart + sectionProgress)

  const startTrial = () => {
    const nextTrial =
      forcedTrial ??
      ({
        note: toneSet[Math.floor(Math.random() * toneSet.length)] as NoteName,
        toneStyle:
          unlockedToneStyles[
            Math.floor(Math.random() * unlockedToneStyles.length)
          ] as ToneStyleId,
        frequencyMultiplier:
          activeMultipliers[Math.floor(Math.random() * activeMultipliers.length)] ?? 1,
      } as Trial)

    setCurrentTrial(nextTrial)
    setFeedback(null)
    setAwaitingGuess(true)

    return nextTrial
  }

  const getCurrentTrial = () => {
    return currentTrial
  }

  const handleGuess = (guessOptionId: string) => {
    if (!awaitingGuess || !currentTrial) return
    const guessedOption = guessOptions.find((option) => option.id === guessOptionId)
    if (!guessedOption) return
    setAwaitingGuess(false)

    const isCorrect =
      guessedOption.note === currentTrial.note &&
      guessedOption.frequencyMultiplier === currentTrial.frequencyMultiplier
    const newGuesses = sessionGuesses + 1
    const newCorrect = sessionCorrect + (isCorrect ? 1 : 0)
    setSessionGuesses(newGuesses)
    setSessionCorrect(newCorrect)
    setFeedback({
      correct: isCorrect,
      guessed: guessedOption.note,
      actual: currentTrial.note,
      guessedFrequencyMultiplier: guessedOption.frequencyMultiplier,
      actualFrequencyMultiplier: currentTrial.frequencyMultiplier,
      guessedLabel: guessedOption.label,
      actualLabel: formatPitchLabel(
        currentTrial.note,
        currentTrial.frequencyMultiplier,
      ),
      toneStyle: currentTrial.toneStyle,
    })

    if (!isCorrect) {
      setForcedTrial(currentTrial)
      setSectionProgress(0)
    } else {
      setForcedTrial(null)
      const newSectionProgress = sectionProgress + 1
      const reachedSectionTarget = newSectionProgress >= sectionTarget

      if (reachedSectionTarget) {
        if (sectionIdx < SECTION_STEPS.length - 1) {
          const newSection = sectionIdx + 1
          setSectionProgress(0)
          progressSetters.setSectionIdx(newSection)
          setLeveledUpToast(
            `Abschnitt ${newSection + 1}/${SECTION_STEPS.length} freigeschaltet`,
          )
        } else if (levelIdx < LEVEL_COUNT - 1) {
          const newLevel = levelIdx + 1
          setSectionProgress(0)
          progressSetters.setLevelIdx(newLevel)
          progressSetters.setUnlockedLevelIdx((prev) => Math.max(prev, newLevel))
          progressSetters.setSectionIdx(0)
          setLeveledUpToast(
            `Übung ${newLevel + 1}/${LEVEL_COUNT} freigeschaltet`,
          )
        } else {
          setSectionProgress(sectionTarget)
          setLeveledUpToast('Höchste Übung gehalten')
        }

        setTimeout(() => setLeveledUpToast(null), 2600)
      } else {
        setSectionProgress(newSectionProgress)
      }

      const newBest = Math.max(bestStreak, sectionStart + newSectionProgress)
      if (newBest !== bestStreak) {
        progressSetters.setBestStreak(newBest)
      }
    }

  }

  const accuracy =
    sessionGuesses > 0
      ? Math.round((sessionCorrect / sessionGuesses) * 100)
      : null

  return {
    toneSet,
    guessOptions,
    unlockedToneStyles,
    levelProgress,
    levelProgressTotal: LEVEL_PROGRESS_TOTAL,
    forcedTrial,
    awaitingGuess,
    feedback,
    leveledUpToast,
    sessionGuesses,
    accuracy,
    startTrial,
    getCurrentTrial,
    handleGuess,
  }
}
