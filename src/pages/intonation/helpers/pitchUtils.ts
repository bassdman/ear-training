import { noteLabels, noteNames, PITCH_TOLERANCE_CENTS } from '../config'
import type { NoteConfig, PitchResult } from '../types'

export function getNoteConfig(noteId: string): NoteConfig {
  const normalizedNoteId = noteId.replace(/-disabled$/, '')
  const match = normalizedNoteId.match(/^(c(?:is)?|d(?:is)?|e|f(?:is)?|g(?:is)?|a(?:is)?|h)(\d+)$/)
  if (!match) return { note: '', octave: 0, disabled: false }

  return {
    note: match[1],
    octave: Number(match[2]),
    disabled: noteId.endsWith('-disabled'),
  }
}

export function getPitchResult(frequency: number, targetNoteId: string): PitchResult | null {
  const target = getNoteConfig(targetNoteId)
  const targetNoteIndex = noteNames.indexOf(target.note)
  if (!Number.isFinite(frequency) || frequency <= 0 || targetNoteIndex === -1) return null

  const detectedMidi = Math.round(69 + 12 * Math.log2(frequency / 440))
  const targetMidi = (target.octave + 1) * 12 + targetNoteIndex
  const detectedFrequency = 440 * 2 ** ((detectedMidi - 69) / 12)
  const cents = Math.round(1200 * Math.log2(frequency / detectedFrequency)) || 0
  const detectedNoteIndex = ((detectedMidi % 12) + 12) % 12
  const detectedOctave = Math.floor(detectedMidi / 12) - 1

  return {
    detectedNote: `${noteLabels[detectedNoteIndex]}${detectedOctave}`,
    cents,
    isInTune: Math.abs(1200 * Math.log2(frequency / (440 * 2 ** ((targetMidi - 69) / 12)))) <= PITCH_TOLERANCE_CENTS,
  }
}

export function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Der Mikrofonzugriff wurde blockiert. Erlaube Safari den Zugriff auf das Mikrofon für diese Website.'
  }

  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'Es wurde kein Mikrofon gefunden.'
  }

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return 'Das Mikrofon benötigt eine sichere HTTPS-Verbindung. Öffne die Seite nicht über http://.'
  }

  return 'Das Mikrofon konnte nicht verwendet werden. Versuche es erneut.'
}

export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  let rms = 0
  for (const sample of samples) rms += sample * sample
  if (Math.sqrt(rms / samples.length) < 0.015) return null

  const minimumLag = Math.floor(sampleRate / 1000)
  const maximumLag = Math.floor(sampleRate / 70)
  let bestLag = -1
  let bestCorrelation = 0

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let correlation = 0
    let firstEnergy = 0
    let delayedEnergy = 0
    for (let index = 0; index < samples.length - lag; index += 1) {
      correlation += samples[index] * samples[index + lag]
      firstEnergy += samples[index] * samples[index]
      delayedEnergy += samples[index + lag] * samples[index + lag]
    }
    const normalizedCorrelation = correlation / Math.sqrt(firstEnergy * delayedEnergy)
    if (normalizedCorrelation > bestCorrelation) {
      bestCorrelation = normalizedCorrelation
      bestLag = lag
    }
  }

  return bestLag === -1 || bestCorrelation < 0.75 ? null : sampleRate / bestLag
}
