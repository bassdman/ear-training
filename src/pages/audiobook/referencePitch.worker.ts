import { analyzeReferencePitch, type ReferencePitchJob } from './referencePitch'

self.onmessage = (event: MessageEvent<ReferencePitchJob>) => {
  try {
    self.postMessage({ id: event.data.id, points: analyzeReferencePitch(event.data) })
  } catch (error) {
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Unbekannter Analysefehler' })
  }
}
