import { useEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react'

import './tooltipMenu.css'

export function TooltipMenuButton(props: Omit<ComponentPropsWithoutRef<'button'>, 'type'>) {
  return <button {...props} type="button" />
}

type LabeledInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'> & {
  label: ReactNode
  className?: string
}

function TooltipMenuInput({ label, className, type, ...props }: LabeledInputProps & { type: 'range' | 'number' }) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input {...props} type={type} />
    </label>
  )
}

export function TooltipMenuRange(props: LabeledInputProps) {
  return <TooltipMenuInput {...props} type="range" />
}

export function TooltipMenuNumber(props: LabeledInputProps) {
  return <TooltipMenuInput {...props} type="number" />
}

export function TooltipMenuFile({ label, className, onChange, ...props }: {
  label: ReactNode
  className?: string
  disabled?: boolean
  accept?: string
  onChange: (file: File) => void
}) {
  return (
    <label className={className}>
      {label}
      <input {...props} type="file" onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file) onChange(file)
      }} />
    </label>
  )
}

export function TooltipMenu({ children, className = '', style, onClose }: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) closeRef.current()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div ref={ref} className={`tooltip-menu ${className}`} style={style} onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  )
}
