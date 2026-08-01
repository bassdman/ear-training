import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EarTrainer from './EarTrainer'

const { soundfontMock, startMock, disposeMock } = vi.hoisted(() => {
  const start = vi.fn(() => vi.fn())
  const dispose = vi.fn()
  const soundfont = vi.fn(() => ({
    ready: Promise.resolve(),
    start,
    dispose,
    output: { volume: 100 },
  }))

  return {
    soundfontMock: soundfont,
    startMock: start,
    disposeMock: dispose,
  }
})

vi.mock('smplr', () => ({
  Soundfont: soundfontMock,
}))

class FakeAudioContext {
  state: AudioContextState = 'suspended'
  destination = {}

  async resume() {
    this.state = 'running'
  }

  async close() {
    this.state = 'closed'
  }
}

beforeEach(() => {
  soundfontMock.mockClear()
  startMock.mockClear()
  disposeMock.mockClear()
  vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext)
})

describe('EarTrainer', () => {
  it('zeigt Loading-Zustand', () => {
    render(
      <EarTrainer
        loaded={false}
        levelIdx={0}
        sectionIdx={0}
        bestStreak={0}
        setLevelIdx={vi.fn()}
        setSectionIdx={vi.fn()}
        setBestStreak={vi.fn()}
        setUnlockedLevelIdx={vi.fn()}
        rangeLabel="Mittlere Lage"
        rangeSubtitle="C4 bis H4"
        rangeFrequencyMultipliers={[1]}
        selectedInstrumentId="piano"
        playbackVolume={100}
        setPlaybackVolume={vi.fn()}
        onBackToCourse={vi.fn()}
      />,
    )

    expect(screen.getByText('Lade Fortschritt ...')).toBeInTheDocument()
  })

  it('rendert die Trial- und Replay-Buttons und das Audio-Panel', () => {
    render(
      <EarTrainer
        loaded
        levelIdx={0}
        sectionIdx={0}
        bestStreak={0}
        setLevelIdx={vi.fn()}
        setSectionIdx={vi.fn()}
        setBestStreak={vi.fn()}
        setUnlockedLevelIdx={vi.fn()}
        rangeLabel="Mittlere Lage"
        rangeSubtitle="C4 bis H4"
        rangeFrequencyMultipliers={[1]}
        selectedInstrumentId="piano"
        playbackVolume={100}
        setPlaybackVolume={() => {}}
        onBackToCourse={() => {}}
      />,
    )

    expect(screen.getByText('Klavier')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'nochmals anhören' })).toBeInTheDocument()
  })
})
