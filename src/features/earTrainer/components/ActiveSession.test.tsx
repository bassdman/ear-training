import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActiveSession } from './ActiveSession'

describe('ActiveSession', () => {
  it('rendert einen klickbaren Ton-Button', () => {
    const onPlayTone = vi.fn()
    render(<ActiveSession isPlaying={false} onPlayTone={onPlayTone} />)

    const playButton = screen.getByRole('button', { name: 'Ton abspielen' })
    fireEvent.click(playButton)
    expect(onPlayTone).toHaveBeenCalledTimes(1)
  })

  it('zeigt den Spielzustand im Button-Text', () => {
    render(<ActiveSession isPlaying onPlayTone={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Spielt...' })).toBeInTheDocument()
  })
})
