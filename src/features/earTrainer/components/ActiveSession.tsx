type ActiveSessionProps = {
  buttons: Array<{
    id: string
    label: string
    isPlaying: boolean
    isReady: boolean
  }>
  onPlayTone: (buttonId: string) => void
}

export function ActiveSession({ buttons, onPlayTone }: ActiveSessionProps) {
  return (
    <div className="ear-player">
      <div className="ear-actions">
        {buttons.map((button) => (
          <button
            key={button.id}
            className="ear-button ear-button-primary"
            disabled={!button.isReady}
            onClick={() => onPlayTone(button.id)}
          >
            {button.isPlaying ? 'Spielt...' : button.label}
          </button>
        ))}
      </div>
    </div>
  )
}