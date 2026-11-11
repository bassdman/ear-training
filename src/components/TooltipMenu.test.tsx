import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TooltipMenu, TooltipMenuButton, TooltipMenuFile, TooltipMenuNumber, TooltipMenuRange } from './TooltipMenu'

describe('TooltipMenu', () => {
  it('schließt bei Escape oder einem Klick außerhalb, aber nicht innerhalb', () => {
    const onClose = vi.fn()
    render(<><TooltipMenu onClose={onClose}><TooltipMenuButton onClick={vi.fn()}>Im Menü</TooltipMenuButton></TooltipMenu><button type="button">Außerhalb</button></>)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Im Menü' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Außerhalb' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('rendert Unterelemente und ruft ihre Aktionen auf', () => {
    const onClick = vi.fn()
    const onChange = vi.fn()
    const disabledClick = vi.fn()
    const { rerender } = render(<TooltipMenu onClose={vi.fn()}>
      <span>Hinweis</span>
      <div>
        <TooltipMenuButton onClick={onClick}>Aktion</TooltipMenuButton>
        <TooltipMenuButton disabled onClick={disabledClick}>Gesperrt</TooltipMenuButton>
      </div>
      <TooltipMenuRange label="Lautstärke: 50 %" aria-label="Lautstärke" min={0} max={100} value={50} onChange={(event) => onChange(Number(event.currentTarget.value))} />
    </TooltipMenu>)

    expect(screen.getByText('Hinweis')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aktion' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gesperrt' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(disabledClick).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Aktion' })).toHaveAttribute('type', 'button')
    const slider = screen.getByRole('slider', { name: 'Lautstärke' })
    fireEvent.change(slider, { target: { value: '75' } })
    expect(onChange).toHaveBeenCalledWith(75)

    rerender(<TooltipMenu onClose={vi.fn()}>
      <span>Hinweis</span>
      <div>
        <TooltipMenuButton onClick={onClick}>Aktion</TooltipMenuButton>
        <TooltipMenuButton disabled onClick={disabledClick}>Gesperrt</TooltipMenuButton>
      </div>
      <TooltipMenuRange label="Lautstärke: 75 %" aria-label="Lautstärke" min={0} max={100} value={75} onChange={(event) => onChange(Number(event.currentTarget.value))} />
    </TooltipMenu>)
    expect(screen.getByRole('slider', { name: 'Lautstärke' })).toBe(slider)
  })

  it('übergibt ausgewählte Dateien und setzt die Auswahl für erneuten Import zurück', () => {
    const onChange = vi.fn()
    render(<TooltipMenu onClose={vi.fn()}>
      <TooltipMenuFile label="Importieren" onChange={onChange} />
      <TooltipMenuFile label="Gesperrt" disabled onChange={onChange} />
    </TooltipMenu>)
    const input = screen.getByLabelText('Importieren') as HTMLInputElement
    const file = new File(['audio'], 'aufnahme.wav', { type: 'audio/wav' })
    expect(input).not.toHaveAttribute('accept')
    expect(screen.getByLabelText('Gesperrt')).toBeDisabled()
    fireEvent.change(input, { target: { files: [file] } })
    expect(onChange).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { files: [file] } })
    expect(onChange).toHaveBeenCalledTimes(2)
    fireEvent.change(input, { target: { files: [] } })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('unterstützt Zahleneingaben einschließlich eines leeren Werts', () => {
    const onChange = vi.fn()
    render(<TooltipMenu onClose={vi.fn()}>
      <TooltipMenuNumber label="Anzahl" min={0} max={10} step={1} defaultValue={2} onChange={(event) => onChange(event.currentTarget.value)} />
    </TooltipMenu>)
    const input = screen.getByRole('spinbutton', { name: 'Anzahl' })
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '10')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange.mock.calls).toEqual([['5'], ['']])
  })
})
