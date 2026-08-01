import { getOctaveFromMultiplier, type NoteName } from './config'

const NOTE_SEQUENCE: NoteName[] = [
  'C',
  'Cis',
  'D',
  'Dis',
  'E',
  'F',
  'Fis',
  'G',
  'Gis',
  'A',
  'Ais',
  'H',
]

const NOTE_INDEX = NOTE_SEQUENCE.reduce<Record<NoteName, number>>((acc, note, index) => {
  acc[note] = index
  return acc
}, {} as Record<NoteName, number>)

const HUE_STEP = 360 / NOTE_SEQUENCE.length
const BASE_OCTAVE = 2
const BASE_LIGHTNESS = 14
const LIGHTNESS_PER_SEMITONE = 0.5
const SATURATION = 82

function toSemitoneIndex(note: NoteName, frequencyMultiplier: number) {
  const octave = getOctaveFromMultiplier(frequencyMultiplier)
  const noteIndex = NOTE_INDEX[note]
  return octave * 12 + noteIndex
}

export function getToneColor(note: NoteName, frequencyMultiplier: number) {
  const noteIndex = NOTE_INDEX[note]
  const hue = HUE_STEP * noteIndex
  const semitoneFromBase = toSemitoneIndex(note, frequencyMultiplier) - BASE_OCTAVE * 12
  const lightness = BASE_LIGHTNESS + semitoneFromBase * LIGHTNESS_PER_SEMITONE

  return {
    hue,
    saturation: SATURATION,
    lightness,
    hsl: `hsl(${hue.toFixed(1)} ${SATURATION}% ${lightness.toFixed(1)}%)`,
  }
}
