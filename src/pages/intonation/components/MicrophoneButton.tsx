import { HoldProgressRing } from './HoldProgressRing'
import { MicrophoneIcon } from './icons/MicrophoneIcon'
import { StopIcon } from './icons/StopIcon'

type MicrophoneButtonProps = {
  isListening: boolean
  holdProgress: number
  noteLabel: string
  octave: number
  onStartListening: () => void
  onStopListening: () => void
}

export function MicrophoneButton({
  isListening,
  holdProgress,
  noteLabel,
  octave,
  onStartListening,
  onStopListening,
}: MicrophoneButtonProps) {
  return (
    <button
      className={`intonation-microphone ${isListening ? 'is-listening' : ''}`}
      onClick={() => (isListening ? onStopListening() : onStartListening())}
      aria-label={`${isListening ? 'Mikrofon stoppen für' : 'Mikrofon starten für'} ${noteLabel}${octave}`}
    >
      {isListening ? (
        <span className="intonation-mic-btn-content is-listening">
          <span className="intonation-ring-wrapper">
            <HoldProgressRing holdProgress={holdProgress} />
            <StopIcon />
          </span>
          <span>Stopp</span>
        </span>
      ) : (
        <span className="intonation-mic-btn-content">
          <MicrophoneIcon />
          <span>Mikrofon</span>
        </span>
      )}
    </button>
  )
}
