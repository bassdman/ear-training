type ActiveSessionProps = {
  buttons: Array<{
    id: string
    label: string
    isPlaying: boolean
    isReady: boolean
  }>
  onPlayTone: (buttonId: string) => void
  toneSplashColor?: string | null
}

export function ActiveSession({
  buttons,
  onPlayTone,
  toneSplashColor,
}: ActiveSessionProps) {
  return (
    <div className="ear-player">
      {toneSplashColor && (
        <div className="ear-ring-wrap" aria-live="polite">
          <div className="ear-dot" style={{ background: toneSplashColor }} aria-label="Tonfarbe" />
        </div>
      )}

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