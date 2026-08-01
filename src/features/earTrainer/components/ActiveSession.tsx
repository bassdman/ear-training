type ActiveSessionProps = {
  isPlaying: boolean
  onPlayTone: () => void
}

export function ActiveSession({ isPlaying, onPlayTone }: ActiveSessionProps) {
  return (
    <div className="ear-player">
      <button className="ear-button ear-button-primary" onClick={onPlayTone}>
        {isPlaying ? 'Spielt...' : 'Ton abspielen'}
      </button>
    </div>
  )
}