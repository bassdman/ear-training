import type { SyllableMode } from './types'

// Wert für das Select: "off", "random" oder "fixed:<silbe>"
export function encodeSyllableMode(mode: SyllableMode): string {
  return mode.mode === 'fixed' ? `fixed:${mode.syllable}` : mode.mode
}

export function decodeSyllableMode(value: string): SyllableMode {
  if (value === 'random') return { mode: 'random' }
  if (value.startsWith('fixed:')) return { mode: 'fixed', syllable: value.slice('fixed:'.length) }
  return { mode: 'off' }
}
