import { possibleNotes } from '../config'
import { getNoteConfig } from '../helpers/pitchUtils'
import type { PitchResult } from '../types'
import { NoteGroup } from './NoteGroup'

type OctaveSectionProps = {
  octave: number
  activeNote: string | null
  listeningNote: string | null
  microphoneEnabled: boolean
  pitchResult: { noteId: string, result: PitchResult } | null
  onPlayNote: (noteId: string) => void
  onStartListening: (noteId: string) => void
  onStopListening: () => void
}

export function OctaveSection({
  octave,
  activeNote,
  listeningNote,
  microphoneEnabled,
  pitchResult,
  onPlayNote,
  onStartListening,
  onStopListening,
}: OctaveSectionProps) {
  const octaveNotes = possibleNotes.filter((noteId) => getNoteConfig(noteId).octave === octave)

  return (
    <section className="intonation-octave">
      <h2>Oktave {octave}</h2>
      <div className="intonation-notes">
        {octaveNotes.map((noteId) => {
          const isActive = activeNote === noteId
          const isListening = listeningNote === noteId
          const result = pitchResult?.noteId === noteId ? pitchResult.result : null

          return (
            <NoteGroup
              key={noteId}
              noteId={noteId}
              isActive={isActive}
              isListening={isListening}
              microphoneEnabled={microphoneEnabled}
              pitchResult={result}
              onPlayNote={onPlayNote}
              onStartListening={onStartListening}
              onStopListening={onStopListening}
            />
          )
        })}
      </div>
    </section>
  )
}
