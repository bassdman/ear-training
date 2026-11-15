import { describe, expect, it } from 'vitest'
import { findSoundSegments } from './separation'

function buffer(channels: Float32Array[], rate = 1000): AudioBuffer {
  return {
    sampleRate: rate, numberOfChannels: channels.length, length: channels[0].length,
    duration: channels[0].length / rate, getChannelData: (index: number) => channels[index],
  } as AudioBuffer
}

describe('Pausenerkennung', () => {
  it('entfernt lange Pausen und behält Wortpositionen mit Sicherheitsabstand', async () => {
    const data = new Float32Array(1500)
    data.fill(0.1, 200, 500)
    data.fill(0.1, 800, 1200)
    const result = await findSoundSegments(buffer([data]), 0, 1.5)
    expect(result).toHaveLength(2)
    expect(result[0].start).toBeCloseTo(0.18)
    expect(result[0].end).toBeCloseTo(0.52)
    expect(result[1].start).toBeCloseTo(0.78)
    expect(result[1].end).toBeCloseTo(1.22)
  })

  it('erhält kurze Pausen und respektiert die gewählte Quellregion', async () => {
    const data = new Float32Array(2000).fill(0.1)
    data.fill(0, 600, 710)
    data.fill(0, 1000, 1120)
    const result = await findSoundSegments(buffer([data]), 0.5, 0.8)
    expect(result).toHaveLength(2)
    expect(result[0].start).toBe(0)
    expect(result[0].end).toBeCloseTo(0.52)
    expect(result[1].start).toBeCloseTo(0.6)
    expect(result[1].end).toBeCloseTo(0.8)
  })

  it('nutzt den lautesten Kanal und den festgelegten RMS-Schwellenwert', async () => {
    const left = new Float32Array(500).fill(0.001)
    const right = new Float32Array(500).fill(0.004)
    expect(await findSoundSegments(buffer([left, right]), 0, 0.5)).toEqual([{ start: 0, end: 0.5 }])
    expect(await findSoundSegments(buffer([left]), 0, 0.5)).toEqual([])
  })

  it('erkennt leere Aufnahmen und verweigert ungültige oder abgebrochene Analysen', async () => {
    const audio = buffer([new Float32Array(1000)])
    expect(await findSoundSegments(audio, 0, 1)).toEqual([])
    await expect(findSoundSegments(audio, 0.5, 1)).rejects.toThrow('Ungültiger Audiobereich')
    const controller = new AbortController()
    controller.abort()
    await expect(findSoundSegments(audio, 0, 1, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
