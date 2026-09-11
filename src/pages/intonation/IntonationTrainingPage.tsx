import { useEffect } from 'react'

import { ChillSection } from './components/ChillSection'
import { IntonationHeader } from './components/IntonationHeader'
import { OctaveSection } from './components/OctaveSection'
import { possibleNotes } from './config'
import { getMicrophoneErrorMessage, getNoteConfig, getPitchResult } from './helpers/pitchUtils'
import { readIntonationSettings } from './helpers/storage'
import { useIntonationAudio } from './hooks/useIntonationAudio'
import { useIntonationSettings } from './hooks/useIntonationSettings'
import { usePitchDetection } from './hooks/usePitchDetection'

import './intonationTrainingPage.css'

export { getMicrophoneErrorMessage, getPitchResult, readIntonationSettings }

export function IntonationTrainingPage() {
  const { settings, toggleMicrophone, selectInstrument } = useIntonationSettings()
  const { microphoneEnabled, selectedInstrumentId } = settings

  const {
    listeningNote,
    pitchResult,
    pitchError,
    setPitchError,
    startListening,
    stopListening,
  } = usePitchDetection()

  const {
    activeNote,
    audioError,
    setAudioError,
    playNote,
    playChillTrack,
  } = useIntonationAudio(selectedInstrumentId, microphoneEnabled, startListening)

  useEffect(() => {
    if (pitchError) {
      setAudioError(pitchError)
      setPitchError(null)
    }
  }, [pitchError, setAudioError, setPitchError])

  const octaves = [...new Set(possibleNotes.map((noteId) => getNoteConfig(noteId).octave))].sort((a, b) => a - b)

  const handleToggleMicrophone = () => {
    toggleMicrophone(stopListening)
  }

  return (
    <main className="intonation-page">
      <div className="intonation-shell">
        <IntonationHeader
          selectedInstrumentId={selectedInstrumentId}
          microphoneEnabled={microphoneEnabled}
          audioError={audioError}
          onSelectInstrument={selectInstrument}
          onToggleMicrophone={handleToggleMicrophone}
        />

        <section className="intonation-octaves" aria-label="Noten nach Oktave">
          {octaves.map((octave) => (
            <OctaveSection
              key={octave}
              octave={octave}
              activeNote={activeNote}
              listeningNote={listeningNote}
              microphoneEnabled={microphoneEnabled}
              pitchResult={pitchResult}
              onPlayNote={(noteId) => void playNote(noteId)}
              onStartListening={(noteId) => void startListening(noteId)}
              onStopListening={stopListening}
            />
          ))}
        </section>

        <ChillSection onPlayChillTrack={playChillTrack} />
      </div>
    </main>
  )
}