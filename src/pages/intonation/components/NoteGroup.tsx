import { blackKeys, noteLabels, noteNames } from '../config'
import { getNoteConfig } from '../helpers/pitchUtils'
import type { PitchResult } from '../types'

type NoteGroupProps = {
  noteId: string
  isActive: boolean
  isListening: boolean
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
  microphoneEnabled,
  pitchResult,
  onPlayNote,
  onStartListening,
  onStopListening,
}: NoteGroupProps) {
  const noteConfig = getNoteConfig(noteId)
  const noteIndex = noteNames.indexOf(noteConfig.note)

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
        <button
          className={`intonation-microphone ${isListening ? 'is-listening' : ''}`}
          onClick={() => isListening ? onStopListening() : onStartListening(noteId)}
          aria-label={`${isListening ? 'Mikrofon stoppen für' : 'Mikrofon starten für'} ${noteLabels[noteIndex]}${noteConfig.octave}`}
        >
          {isListening ? 'Stopp' : 'Mikrofon'}
        </button>
      )}
      {isListening && <p className="intonation-listening">Höre zu ...</p>}
      {microphoneEnabled && pitchResult && (
        <p className={`intonation-pitch-result ${pitchResult.isInTune ? 'is-in-tune' : 'is-out-of-tune'}`} role="status">
          {pitchResult.isInTune
            ? `Richtig (${pitchResult.cents > 0 ? '+' : ''}${pitchResult.cents} Cent)`
            : `Daneben. Das war ${pitchResult.detectedNote}.`}
        </p>
      )}
    </div>
  )
}
