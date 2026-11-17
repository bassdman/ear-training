import { describe, expect, it } from 'vitest'

import { createUndoRedoHistory } from './history'

describe('undo/redo history', () => {
  it('moves between committed values and discards the redo branch after a new commit', () => {
    const history = createUndoRedoHistory('first')
    history.commit('second')
    history.commit('third')

    expect(history.undo()).toBe('second')
    expect(history.undo()).toBe('first')
    expect(history.canUndo()).toBe(false)
    expect(history.redo()).toBe('second')
    history.commit('replacement')
    expect(history.canRedo()).toBe(false)
    expect(history.undo()).toBe('second')
  })

  it('retains only the configured number of undo steps', () => {
    const history = createUndoRedoHistory(0, 2)
    history.commit(1)
    history.commit(2)
    history.commit(3)

    expect(history.undo()).toBe(2)
    expect(history.undo()).toBe(1)
    expect(history.canUndo()).toBe(false)
  })
})
