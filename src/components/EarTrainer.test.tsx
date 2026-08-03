import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EarTrainer from './EarTrainer'
import { createExerciseSessionConfig } from '../features/earTrainer/config'

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

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

describe('EarTrainer', () => {
  it('zeigt Loading-Zustand', () => {
    renderWithQuery(
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
        sessionConfig={createExerciseSessionConfig(0, [1], 1)}
        toneSplashMode="persistent"
        selectedInstrumentId="piano"
        playbackVolume={100}
        setPlaybackVolume={vi.fn()}
        onBackToCourse={vi.fn()}
      />,
    )

    expect(screen.getByText('Lade Fortschritt ...')).toBeInTheDocument()
  })

  it('rendert die Trial- und Replay-Buttons und zeigt Audio-Einstellungen im Menü', () => {
    renderWithQuery(
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
        sessionConfig={createExerciseSessionConfig(0, [1], 1)}
        toneSplashMode="persistent"
        selectedInstrumentId="piano"
        playbackVolume={100}
        setPlaybackVolume={() => {}}
        onBackToCourse={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))

    expect(screen.getByRole('dialog', { name: 'Einstellungen' })).toBeInTheDocument()
    expect(screen.getByText('Klavier')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weiter|Spielt.../ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'nochmals anhören' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'd4' })).toBeInTheDocument()

    return waitFor(() => {
      expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled()
    })
  })

  it('laesst nach einem Guess weitere Toene als Referenz abspielbar', async () => {
    renderWithQuery(
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
        sessionConfig={createExerciseSessionConfig(0, [1], 1)}
        toneSplashMode="persistent"
        selectedInstrumentId="piano"
        playbackVolume={100}
        setPlaybackVolume={() => {}}
        onBackToCourse={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'd4' }))

    await waitFor(() => {
      expect(screen.getByText(/Richtig|Gehört war/)).toBeInTheDocument()
    })

    const referenceToneButton = screen.getByRole('button', { name: 'f4' })
    expect(referenceToneButton).toBeEnabled()
    fireEvent.click(referenceToneButton)
    expect(startMock).toHaveBeenCalled()
  })

})
