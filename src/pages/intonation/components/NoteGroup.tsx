import { blackKeys, noteLabels, noteNames } from '../config'
import { getNoteConfig } from '../helpers/pitchUtils'
import type { ListeningPitchState, PitchResult } from '../types'
import { LiveTuner } from './LiveTuner'
import { MicrophoneButton } from './MicrophoneButton'

type NoteGroupProps = {
  noteId: string
  isActive: boolean
  isListening: boolean
  listeningPitchState?: ListeningPitchState | null
  microphoneEnabled: boolean
  pitchResult: PitchResult | null
  onPlayNote: (noteId: string) => void
  onStartListening: (noteId: string) => void
  onStopListening: () => void
}

export function NoteGroup({
  noteId,
  isActive,
  isListening,
  listeningPitchState,
  microphoneEnabled,
  pitchResult,
  onPlayNote,
  onStartListening,
  onStopListening,
}: NoteGroupProps) {
  const noteConfig = getNoteConfig(noteId)
  const noteIndex = noteNames.indexOf(noteConfig.note)

  const holdProgress = listeningPitchState?.holdProgress ?? 0

  return (
    <div className="intonation-note-group">
      <button
        className={`intonation-note ${blackKeys[noteIndex] ? 'is-black' : ''} ${isActive ? 'is-active' : ''}`}
        disabled={noteConfig.disabled}
        onClick={() => onPlayNote(noteId)}
      >
        {noteLabels[noteIndex]}{noteConfig.octave}
      </button>

      {microphoneEnabled && !noteConfig.disabled && (
        <MicrophoneButton
          isListening={isListening}
          holdProgress={holdProgress}
          noteLabel={noteLabels[noteIndex]}
          octave={noteConfig.octave}
          onStartListening={() => onStartListening(noteId)}
          onStopListening={onStopListening}
        />
      )}

      {isListening && <LiveTuner listeningPitchState={listeningPitchState} />}

      {microphoneEnabled && !isListening && pitchResult && (
        <p className={`intonation-pitch-result ${pitchResult.isInTune ? 'is-in-tune' : 'is-out-of-tune'}`} role="status">
          {pitchResult.isInTune
            ? `Richtig (${pitchResult.cents > 0 ? '+' : ''}${pitchResult.cents} Cent)`
            : pitchResult.detectedNote && pitchResult.detectedNote !== '---'
              ? `Daneben. Das war ${pitchResult.detectedNote}.`
              : 'Kein Ton erkannt.'}
        </p>
      )}
    </div>
  )
}
