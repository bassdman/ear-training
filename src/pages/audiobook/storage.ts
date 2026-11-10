import { readProgress, writeProgress } from '../../features/earTrainer/storage'

export const AUDIOBOOK_STORAGE_KEY = 'ear-training-audiobook-v1'

export type AudiobookProject = {
  id: string
  name: string
}

function isProject(value: unknown): value is AudiobookProject {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'string' && value.id.length > 0
    && 'name' in value && typeof value.name === 'string' && value.name.trim().length > 0
}

export async function readProjects(): Promise<AudiobookProject[]> {
  const saved = await readProgress(AUDIOBOOK_STORAGE_KEY)
  if (saved === null) return []

  const parsed: unknown = JSON.parse(saved)
  if (!Array.isArray(parsed) || !parsed.every(isProject)
    || new Set(parsed.map((project) => project.id)).size !== parsed.length) {
    throw new Error('Ungültige Projektdaten')
  }
  return parsed
}

export async function writeProjects(projects: AudiobookProject[]) {
  await writeProgress(AUDIOBOOK_STORAGE_KEY, JSON.stringify(projects))
}

export function createProjectId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
