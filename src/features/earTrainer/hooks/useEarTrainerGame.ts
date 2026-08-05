import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

import {
  formatPitchLabel,
  type GuessOption,
  type SessionPitch,
  TONE_STYLE_IDS,
  type EarTrainerSessionConfig,
  type Feedback,
  type ToneStyleId,
  type Trial,
} from '../config'

const logGame = (...parts: unknown[]) => {
  console.info('[ear-game]', ...parts)
}

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
  sessionConfig: EarTrainerSessionConfig
}

type CompletionNotice = {
  id: number
  title: string
  message: string
  nextExerciseLabel?: string
}

export function useEarTrainerGame({
  levelIdx,
  sectionIdx,
  bestStreak,
  progressSetters,
  sessionConfig,
}: UseEarTrainerGameOptions) {
  const [sectionProgress, setSectionProgress] = useState(0)
  const [currentTrial, setCurrentTrial] = useState<Trial | null>(null)
  const [forcedTrial, setForcedTrial] = useState<Trial | null>(null)
  const [awaitingGuess, setAwaitingGuess] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [leveledUpToast, setLeveledUpToast] = useState<string | null>(null)
  const [completionNotice, setCompletionNotice] = useState<CompletionNotice | null>(null)
  const [sessionGuesses, setSessionGuesses] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const lastRandomPitchRef = useRef<string | null>(null)
  const randomNoteStreakRef = useRef(0)

  const { toneSet, frequencyMultipliers, toneStyleCount, sectionSteps, levelCount } = sessionConfig
  const levelProgressTotal = useMemo(
    () => sectionSteps.reduce((sum, steps) => sum + steps, 0),
    [sectionSteps],
  )
  const activeMultipliers = useMemo(
    () => [...new Set(frequencyMultipliers)].sort((a, b) => a - b),
    [frequencyMultipliers],
  )

  const availablePitches = useMemo<SessionPitch[]>(() => {
    if (sessionConfig.pitchPool && sessionConfig.pitchPool.length > 0) {
      return [...sessionConfig.pitchPool]
    }

    return toneSet.flatMap((note) =>
      activeMultipliers.map((frequencyMultiplier) => ({
        note,
        frequencyMultiplier,
      })),
    ) as SessionPitch[]
  }, [activeMultipliers, sessionConfig.pitchPool, toneSet])

  const guessOptions = useMemo(
    () =>
      availablePitches.map((pitch) => ({
        id: `${pitch.note}|${pitch.frequencyMultiplier}`,
        note: pitch.note,
        frequencyMultiplier: pitch.frequencyMultiplier,
        label: formatPitchLabel(pitch.note, pitch.frequencyMultiplier),
      })) as GuessOption[],
    [availablePitches],
  )

  const unlockedToneStyles = useMemo(
    () => TONE_STYLE_IDS.slice(0, Math.max(1, Math.min(TONE_STYLE_IDS.length, toneStyleCount))),
    [toneStyleCount],
  )

  useEffect(() => {
    setSectionProgress(0)
  }, [levelIdx, sectionIdx])

  useEffect(() => {
    const availablePitchIds = new Set(
      availablePitches.map((pitch) => `${pitch.note}|${pitch.frequencyMultiplier}`),
    )
    if (!lastRandomPitchRef.current) return
    if (availablePitchIds.has(lastRandomPitchRef.current)) return

    lastRandomPitchRef.current = null
    randomNoteStreakRef.current = 0
  }, [availablePitches])

  const sectionStart = useMemo(
    () => sectionSteps.slice(0, sectionIdx).reduce((sum, steps) => sum + steps, 0),
    [sectionIdx, sectionSteps],
  )
  const sectionTarget = sectionSteps[sectionIdx] ?? sectionSteps[sectionSteps.length - 1]
  const levelProgress = Math.min(levelProgressTotal, sectionStart + sectionProgress)

  const startTrial = () => {
    const pickRandomPitch = (): SessionPitch => {
      const streakBlockedPitchId =
        randomNoteStreakRef.current >= 2 ? lastRandomPitchRef.current : null

      const pickablePitches =
        streakBlockedPitchId && availablePitches.length > 1
          ? availablePitches.filter(
              (pitch) => `${pitch.note}|${pitch.frequencyMultiplier}` !== streakBlockedPitchId,
            )
          : availablePitches

      const selectedPitch =
        pickablePitches[Math.floor(Math.random() * pickablePitches.length)] ??
        availablePitches[0] ?? { note: 'C', frequencyMultiplier: 1 }
      const selectedPitchId = `${selectedPitch.note}|${selectedPitch.frequencyMultiplier}`

      if (selectedPitchId === lastRandomPitchRef.current) {
        randomNoteStreakRef.current += 1
      } else {
        lastRandomPitchRef.current = selectedPitchId
        randomNoteStreakRef.current = 1
      }

      return selectedPitch
    }

    const nextPitch = pickRandomPitch()

    const nextTrial =
      forcedTrial ??
      ({
        note: nextPitch.note,
        toneStyle:
          unlockedToneStyles[
            Math.floor(Math.random() * unlockedToneStyles.length)
          ] as ToneStyleId,
        frequencyMultiplier: nextPitch.frequencyMultiplier,
      } as Trial)

    logGame('trial:start', {
      nextTrial,
      forcedTrial,
      levelIdx,
      sectionIdx,
    })
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

    logGame('guess:received', {
      guessOptionId,
      guessedOption,
      currentTrial,
      awaitingGuess,
    })
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
      logGame('guess:result', { correct: false, currentTrial, guessedOption })
    } else {
      setForcedTrial(null)
      const newSectionProgress = sectionProgress + 1
      const reachedSectionTarget = newSectionProgress >= sectionTarget

      logGame('guess:result', {
        correct: true,
        currentTrial,
        guessedOption,
        newSectionProgress,
        reachedSectionTarget,
      })

      if (reachedSectionTarget) {
        if (sectionIdx < sectionSteps.length - 1) {
          const newSection = sectionIdx + 1
          setSectionProgress(0)
          progressSetters.setSectionIdx(newSection)
          setLeveledUpToast(
            `Abschnitt ${newSection + 1}/${sectionSteps.length} freigeschaltet`,
          )
        } else if (levelIdx < levelCount - 1) {
          const newLevel = levelIdx + 1
          setSectionProgress(0)
          progressSetters.setLevelIdx(newLevel)
          progressSetters.setUnlockedLevelIdx((prev) => Math.max(prev, newLevel))
          progressSetters.setSectionIdx(0)
          setLeveledUpToast(
            `Übung ${newLevel + 1}/${levelCount} freigeschaltet`,
          )
          setCompletionNotice({
            id: Date.now(),
            title: 'Übung abgeschlossen',
            message: 'Glückwunsch! Du hast die gesamte Übung abgeschlossen.',
            nextExerciseLabel: `Übung ${newLevel + 1}`,
          })
        } else {
          setSectionProgress(sectionTarget)
          setLeveledUpToast('Höchste Übung gehalten')
          setCompletionNotice({
            id: Date.now(),
            title: 'Übung abgeschlossen',
            message: 'Glückwunsch! Du hast die letzte Übung abgeschlossen.',
          })
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
    sectionSteps,
    levelCount,
    guessOptions,
    unlockedToneStyles,
    levelProgress,
    levelProgressTotal,
    forcedTrial,
    awaitingGuess,
    feedback,
    leveledUpToast,
    completionNotice,
    sessionGuesses,
    accuracy,
    startTrial,
    getCurrentTrial,
    handleGuess,
    dismissCompletionNotice: () => setCompletionNotice(null),
  }
}
