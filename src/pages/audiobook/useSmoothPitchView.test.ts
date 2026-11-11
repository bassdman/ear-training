import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSmoothPitchView } from './useSmoothPitchView'

describe('sanfte Tonhöhenansicht', () => {
  let time: number
  let nextId: number
  let frames: Map<number, FrameRequestCallback>

  const advance = (ms: number) => {
    time += ms
    const callbacks = [...frames.values()]
    frames.clear()
    act(() => callbacks.forEach((callback) => callback(time)))
  }

  beforeEach(() => {
    time = 0
    nextId = 0
    frames = new Map()
    vi.spyOn(performance, 'now').mockImplementation(() => time)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++nextId
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('initialisiert mit drei Oktaven und bleibt für Töne innerhalb des sicheren Bereichs stehen', () => {
    const { result, rerender } = renderHook(
      ({ low, high }) => useSmoothPitchView(low, high, false),
      { initialProps: { low: null as number | null, high: null as number | null } },
    )
    expect(result.current).toEqual({ center: 60, span: 36 })
    rerender({ low: 69, high: 69 })
    expect(result.current).toEqual({ center: 69, span: 36 })
    rerender({ low: 57, high: 81 })
    advance(100)
    expect(result.current).toEqual({ center: 69, span: 36 })
    expect(frames.size).toBe(0)
    rerender({ low: 69, high: 84 })
    expect(frames.size).toBe(0)
  })

  it('führt bei Platzmangel sanft und nur so weit wie nötig nach', () => {
    const { result, rerender, unmount } = renderHook(
      ({ low, high }) => useSmoothPitchView(low, high, false),
      { initialProps: { low: 60, high: 60 } },
    )
    rerender({ low: 80, high: 80 })
    expect(result.current.center).toBe(60)
    advance(100)
    expect(result.current.center).toBeGreaterThan(60)
    expect(result.current.center).toBeLessThan(65)
    for (let i = 0; i < 50; i++) advance(100)
    expect(result.current).toEqual({ center: 65, span: 36 })
    expect(frames.size).toBe(0)
    rerender({ low: 40, high: 40 })
    expect(frames.size).toBe(1)
    unmount()
    expect(frames.size).toBe(0)
  })

  it('vergrößert den Tonumfang bei weit auseinanderliegenden Referenz- und Mikrofontönen', () => {
    const { result, rerender } = renderHook(
      ({ low, high }) => useSmoothPitchView(low, high, false),
      { initialProps: { low: 60, high: 60 } },
    )
    rerender({ low: 50, high: 90 })
    for (let i = 0; i < 50; i++) advance(100)
    expect(result.current).toEqual({ center: 70, span: 46 })
    rerender({ low: 65, high: 75 })
    for (let i = 0; i < 50; i++) advance(100)
    expect(result.current).toEqual({ center: 70, span: 36 })
  })

  it('hält die gesamte Ansicht beim Ziehen fest und folgt nach dem Loslassen bei Platzmangel', () => {
    const { result, rerender } = renderHook(
      ({ low, high, paused }) => useSmoothPitchView(low, high, paused),
      { initialProps: { low: 60, high: 60, paused: false } },
    )
    rerender({ low: 80, high: 80, paused: false })
    advance(100)
    const beforeDrag = result.current
    rerender({ low: 80, high: 80, paused: true })
    rerender({ low: 90, high: 90, paused: true })
    advance(1000)
    expect(result.current).toEqual(beforeDrag)
    expect(frames.size).toBe(0)
    rerender({ low: 90, high: 90, paused: false })
    advance(100)
    expect(result.current.center).toBeGreaterThan(beforeDrag.center)
    expect(result.current.center).toBeLessThan(75)
  })

  it('stoppt die Bewegung ohne Messwert oder wenn der Ton wieder im sicheren Bereich liegt', () => {
    const { result, rerender } = renderHook(
      ({ low, high }) => useSmoothPitchView(low, high, false),
      { initialProps: { low: 60 as number | null, high: 60 as number | null } },
    )
    rerender({ low: 85, high: 85 })
    advance(100)
    const before = result.current
    rerender({ low: 62, high: 62 })
    expect(frames.size).toBe(0)
    advance(100)
    expect(result.current).toEqual(before)
    rerender({ low: 90, high: 90 })
    rerender({ low: null, high: null })
    expect(frames.size).toBe(0)
    advance(1000)
    expect(result.current).toEqual(before)
  })

  it('führt auch beim ersten Ton nach einem Drag die gehaltene Höhe sanft nach', () => {
    const { result, rerender } = renderHook(
      ({ pitch, paused }) => useSmoothPitchView(pitch, pitch, paused),
      { initialProps: { pitch: null as number | null, paused: false } },
    )
    rerender({ pitch: null, paused: true })
    rerender({ pitch: 90, paused: true })
    expect(result.current.center).toBe(60)
    rerender({ pitch: 90, paused: false })
    advance(100)
    expect(result.current.center).toBeGreaterThan(60)
    expect(result.current.center).toBeLessThan(75)
  })
})
