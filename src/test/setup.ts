import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

if (typeof window !== 'undefined') {
  window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve())
  window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(() => {})
  window.HTMLMediaElement.prototype.load = vi.fn().mockImplementation(() => {})
}

afterEach(() => {
	cleanup()
})
