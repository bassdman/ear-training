type ChillSectionProps = {
  onPlayChillTrack: () => void
}

export function ChillSection({ onPlayChillTrack }: ChillSectionProps) {
  return (
    <section className="intonation-chill" aria-label="Pausenmusik">
      <button className="intonation-chill-button" onClick={onPlayChillTrack}>
        Chillen
      </button>
    </section>
  )
}
