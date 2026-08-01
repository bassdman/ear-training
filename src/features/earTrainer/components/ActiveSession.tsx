type ActiveSessionProps = {
  buttons: Array<{
    id: string
    label: string
    isPlaying: boolean
    isReady: boolean
  }>
  onPlayTone: (buttonId: string) => void
  toneSplashEnabled?: boolean
  toneSplashColor?: string | null
}

export function ActiveSession({
  buttons,
  onPlayTone,
  toneSplashEnabled = false,
  toneSplashColor,
}: ActiveSessionProps) {
  return (
    <div className="ear-player">
      {toneSplashEnabled && (
        <div className="ear-ring-wrap" aria-live="polite">
          <div
            className={`ear-dot ${toneSplashColor ? '' : 'is-hidden'}`}
            style={toneSplashColor ? { background: toneSplashColor } : undefined}
            aria-hidden={!toneSplashColor}
            aria-label={toneSplashColor ? 'Tonfarbe' : undefined}
          />
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