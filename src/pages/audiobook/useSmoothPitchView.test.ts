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

  it('initialisiert bei der ersten Tonhöhe und führt danach Mitte und Ausschnitt sanft nach', () => {
    const { result, rerender, unmount } = renderHook(
      ({ center, span, paused }) => useSmoothPitchView(center, span, paused),
      { initialProps: { center: null as number | null, span: 24, paused: false } },
    )
    expect(result.current.center).toBe(60)
    rerender({ center: 69, span: 24, paused: false })
    expect(result.current.center).toBe(69)
    rerender({ center: 81, span: 40, paused: false })
    expect(result.current).toEqual({ center: 69, span: 24 })
    advance(100)
    expect(result.current.center).toBeGreaterThan(69)
    expect(result.current.center).toBeLessThan(81)
    expect(result.current.span).toBeGreaterThan(24)
    expect(result.current.span).toBeLessThan(40)
    for (let i = 0; i < 50; i++) advance(100)
    expect(result.current).toEqual({ center: 81, span: 40 })
    expect(frames.size).toBe(0)
    rerender({ center: 72, span: 24, paused: false })
    expect(frames.size).toBe(1)
    unmount()
    expect(frames.size).toBe(0)
  })

  it('hält die gesamte Ansicht beim Ziehen fest und folgt nach dem Loslassen dem neuesten Ziel', () => {
    const { result, rerender } = renderHook(
      ({ center, span, paused }) => useSmoothPitchView(center, span, paused),
      { initialProps: { center: 60, span: 24, paused: false } },
    )
    rerender({ center: 72, span: 30, paused: false })
    advance(100)
    const beforeDrag = result.current
    rerender({ center: 72, span: 30, paused: true })
    expect(frames.size).toBe(0)
    rerender({ center: 84, span: 36, paused: true })
    advance(1000)
    expect(result.current).toEqual(beforeDrag)
    rerender({ center: 84, span: 36, paused: false })
    advance(100)
    expect(result.current.center).toBeGreaterThan(beforeDrag.center)
    expect(result.current.center).toBeLessThan(84)
    expect(result.current.span).toBeGreaterThan(beforeDrag.span)
  })

  it('hält die Ansicht ohne Messwert und aktualisiert das Ziel während einer Animation', () => {
    const { result, rerender } = renderHook(
      ({ center }) => useSmoothPitchView(center, 24, false),
      { initialProps: { center: 60 as number | null } },
    )
    rerender({ center: 72 })
    advance(100)
    const before = result.current.center
    rerender({ center: 48 })
    advance(100)
    expect(result.current.center).toBeLessThan(before)
    rerender({ center: null })
    const held = result.current
    advance(1000)
    expect(result.current).toEqual(held)
    expect(frames.size).toBe(0)
  })

  it('führt auch beim ersten Ton nach einem Drag die gehaltene Höhe sanft nach', () => {
    const { result, rerender } = renderHook(
      ({ center, paused }) => useSmoothPitchView(center, 24, paused),
      { initialProps: { center: null as number | null, paused: false } },
    )
    rerender({ center: null, paused: true })
    rerender({ center: 84, paused: true })
    expect(result.current.center).toBe(60)
    rerender({ center: 84, paused: false })
    expect(result.current.center).toBe(60)
    advance(100)
    expect(result.current.center).toBeGreaterThan(60)
    expect(result.current.center).toBeLessThan(84)
  })
})
