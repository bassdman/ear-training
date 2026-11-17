export type UndoRedoHistory<T> = {
  canUndo: () => boolean
  canRedo: () => boolean
  commit: (value: T) => void
  undo: () => T | undefined
  redo: () => T | undefined
  reset: (value: T) => void
}

export function createUndoRedoHistory<T>(initial: T, limit = 50): UndoRedoHistory<T> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('History limit must be a positive integer')
  let entries = [initial]
  let cursor = 0

  return {
    canUndo: () => cursor > 0,
    canRedo: () => cursor < entries.length - 1,
    commit(value) {
      entries = [...entries.slice(0, cursor + 1), value]
      if (entries.length > limit + 1) entries = entries.slice(entries.length - limit - 1)
      cursor = entries.length - 1
    },
    undo() {
      if (cursor === 0) return undefined
      cursor -= 1
      return entries[cursor]
    },
    redo() {
      if (cursor >= entries.length - 1) return undefined
      cursor += 1
      return entries[cursor]
    },
    reset(value) {
      entries = [value]
      cursor = 0
    },
  }
}
