import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import {
  EXERCISES,
  LEVEL_COUNT,
  SECTION_COUNT,
  SESSION_MAX_GUESSES,
  STREAK_TARGET,
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
}

type UseEarTrainerGameOptions = {
  levelIdx: number
  sectionIdx: number
  bestStreak: number
  progressSetters: ProgressSetters
}

export function useEarTrainerGame({
  levelIdx,
  sectionIdx,
  bestStreak,
  progressSetters,
}: UseEarTrainerGameOptions) {
  const [streak, setStreak] = useState(0)
  const [currentNote, setCurrentNote] = useState<NoteName | null>(null)
  const [currentToneStyle, setCurrentToneStyle] = useState<ToneStyleId | null>(null)
  const [forcedTrial, setForcedTrial] = useState<Trial | null>(null)
  const [awaitingGuess, setAwaitingGuess] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [leveledUpToast, setLeveledUpToast] = useState<string | null>(null)
  const [sessionGuesses, setSessionGuesses] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionEnded, setSessionEnded] = useState(false)

  const toneSet = EXERCISES[levelIdx]
  const unlockedToneStyles = useMemo(
    () => TONE_STYLE_IDS.slice(0, sectionIdx + 1),
    [sectionIdx],
  )

  const startTrial = () => {
    if (sessionEnded) return null

    const note =
      forcedTrial?.note ?? toneSet[Math.floor(Math.random() * toneSet.length)]
    const toneStyle =
      forcedTrial?.toneStyle ??
      unlockedToneStyles[Math.floor(Math.random() * unlockedToneStyles.length)]

    setCurrentNote(note)
    setCurrentToneStyle(toneStyle)
    setFeedback(null)
    setAwaitingGuess(true)

    return { note, toneStyle } as Trial
  }

  const getCurrentTrial = () => {
    if (!currentNote || !currentToneStyle) return null
    return { note: currentNote, toneStyle: currentToneStyle } as Trial
  }

  const handleGuess = (guessedNote: NoteName) => {
    if (!awaitingGuess || !currentNote || !currentToneStyle) return
    setAwaitingGuess(false)

    const isCorrect = guessedNote === currentNote
    const newGuesses = sessionGuesses + 1
    const newCorrect = sessionCorrect + (isCorrect ? 1 : 0)
    setSessionGuesses(newGuesses)
    setSessionCorrect(newCorrect)
    setFeedback({
      correct: isCorrect,
      guessed: guessedNote,
      actual: currentNote,
      toneStyle: currentToneStyle,
    })

    if (!isCorrect) {
      setForcedTrial({ note: currentNote, toneStyle: currentToneStyle })
      setStreak(0)
    } else {
      setForcedTrial(null)
      const newStreak = streak + 1

      if (newStreak >= STREAK_TARGET) {
        let newLevel = levelIdx
        let newSection = sectionIdx

        if (sectionIdx < SECTION_COUNT - 1) {
          newSection = sectionIdx + 1
          progressSetters.setSectionIdx(newSection)
          setLeveledUpToast(
            `Abschnitt ${newSection + 1}/${SECTION_COUNT} freigeschaltet`,
          )
        } else if (levelIdx < LEVEL_COUNT - 1) {
          newLevel = levelIdx + 1
          newSection = 0
          progressSetters.setLevelIdx(newLevel)
          progressSetters.setSectionIdx(0)
          setLeveledUpToast(
            `Übung ${newLevel + 1}/${LEVEL_COUNT} freigeschaltet`,
          )
        } else {
          setLeveledUpToast('Höchste Übung gehalten')
        }

        setStreak(0)
        setTimeout(() => setLeveledUpToast(null), 2600)
      } else {
        setStreak(newStreak)
      }

      const newBest = Math.max(bestStreak, newStreak)
      if (newBest !== bestStreak) {
        progressSetters.setBestStreak(newBest)
      }
    }

    if (newGuesses >= SESSION_MAX_GUESSES) {
      setTimeout(() => setSessionEnded(true), 900)
    }
  }

  const newSession = () => {
    setSessionGuesses(0)
    setSessionCorrect(0)
    setSessionEnded(false)
    setFeedback(null)
    setAwaitingGuess(false)
    setCurrentNote(null)
    setCurrentToneStyle(null)
    setForcedTrial(null)
  }

  const accuracy =
    sessionGuesses > 0
      ? Math.round((sessionCorrect / sessionGuesses) * 100)
      : null
  const streakProgress = Math.min(100, (streak / STREAK_TARGET) * 100)

  return {
    toneSet,
    unlockedToneStyles,
    streak,
    streakProgress,
    forcedTrial,
    awaitingGuess,
    feedback,
    leveledUpToast,
    sessionGuesses,
    sessionCorrect,
    sessionEnded,
    accuracy,
    startTrial,
    getCurrentTrial,
    handleGuess,
    newSession,
  }
}
