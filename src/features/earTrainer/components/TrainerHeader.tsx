type TrainerHeaderProps = {
  rangeLabel: string
  rangeSubtitle: string
}

export function TrainerHeader({ rangeLabel, rangeSubtitle }: TrainerHeaderProps) {
  return (
    <div className="ear-title">
      <div className="ear-title-main">Gehörtraining</div>
      <div className="ear-title-sub">{rangeLabel} · {rangeSubtitle}</div>
    </div>
  )
}
