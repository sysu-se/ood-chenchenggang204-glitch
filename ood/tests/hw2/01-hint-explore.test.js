import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

describe('HW2 hint support', () => {
  it('provides candidates through Sudoku and Game domain interfaces', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())
    const game = createGame({ sudoku })

    expect(sudoku.getCandidates(4, 4)).toEqual([5])
    expect(game.getCandidateHint(4, 4)).toMatchObject({
      row: 4,
      col: 4,
      candidates: [5],
    })
  })

  it('finds the next forced candidate without using UI-only logic', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    const hint = game.getNextHint()

    expect(hint).toMatchObject({
      row: 4,
      col: 4,
      value: 5,
      candidates: [5],
    })
  })
})

describe('HW2 explore mode', () => {
  it('keeps explore undo/redo separate until commit', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    expect(game.startExplore()).toBe(true)
    game.guess({ row: 0, col: 3, value: 2 })

    game.undo()
    expect(game.getGrid()[0][3]).toBe(0)

    game.redo()
    expect(game.getGrid()[0][3]).toBe(2)

    expect(game.commitExplore()).toBe(true)
    game.undo()
    expect(game.getGrid()[0][3]).toBe(0)
    game.undo()
    expect(game.getGrid()[0][2]).toBe(0)
  })

  it('discards an exploration branch by restoring the entry snapshot', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 4 })
    game.startExplore()
    game.guess({ row: 0, col: 3, value: 2 })

    expect(game.discardExplore()).toBe(true)
    expect(game.getGrid()[0][2]).toBe(4)
    expect(game.getGrid()[0][3]).toBe(0)
    expect(game.canUndo()).toBe(true)
  })

  it('marks conflict boards as failed exploration paths', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.startExplore()
    game.guess({ row: 0, col: 2, value: 5 })

    const state = game.getExploreState()
    expect(state.failed).toBe(true)
    expect(state.reason).toContain('duplicate')
    expect(() => game.commitExplore()).toThrow(/duplicate/)
  })
})

describe('HW2 game consistency', () => {
  it('rejects a current Sudoku that disagrees with fixed puzzle cells', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const puzzle = makePuzzle()
    const current = makePuzzle()
    current[0][0] = 9

    expect(() => createGame({
      sudoku: createSudoku(current),
      initialGrid: puzzle,
    })).toThrow(/different puzzles/)
  })
})
