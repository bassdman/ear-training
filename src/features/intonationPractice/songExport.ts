import type { Song } from './types'

export function serializeSong(song: Song): string {
  return JSON.stringify(song, null, 2)
}

export function songExportFilename(song: Song): string {
  const slug = song.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${slug || song.id}.json`
}

export function downloadSong(song: Song): void {
  const blob = new Blob([serializeSong(song)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = songExportFilename(song)
  document.body.append(link)

  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
