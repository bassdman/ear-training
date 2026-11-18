import { useState } from 'react'

import recordButton from '../../assets/record_button.svg'
import recordButtonActive from '../../assets/record_button-active.svg'
import recordButtonDisabled from '../../assets/record_button-active-disabled.svg'

export function AufnahmeButton({ disabled, recording = false, label, onClick }: {
  disabled: boolean
  recording?: boolean
  label?: string
  onClick: () => void
}) {
  const [highlighted, setHighlighted] = useState(false)
  const image = disabled
    ? recordButtonDisabled
    : recording || highlighted
      ? recordButtonActive
      : recordButton
  const accessibleLabel = label ?? (recording ? 'Aufnahme stoppen' : 'Aufnehmen')

  return (
    <button
      type="button"
      className="audiobook-record-button"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHighlighted(true)}
      onMouseLeave={() => setHighlighted(false)}
      onFocus={() => setHighlighted(true)}
      onBlur={() => setHighlighted(false)}
    >
      <img src={image} alt="" aria-hidden="true" />
    </button>
  )
}
