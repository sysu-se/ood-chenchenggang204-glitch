import { createSudoku, createSudokuFromJSON } from './sudoku.js';

function cloneMove(move) {
  return { ...move };
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function validateMove(move) {
  if (!move || typeof move !== 'object') {
    throw new Error('Game move must be an object');
  }

  const { row, col, oldValue, newValue } = move;

  for (const [name, value, max] of [
    ['row', row, 8],
    ['col', col, 8],
    ['oldValue', oldValue, 9],
    ['newValue', newValue, 9],
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > max) {
      throw new Error(`Game move ${name} must be an integer between 0 and ${max}`);
    }
  }
}

function applyMoveToSudoku(sudoku, move, valueKey) {
  sudoku.guess({
    row: move.row,
    col: move.col,
    value: move[valueKey],
  });
}

function gridSignature(grid) {
  return grid.map((row) => row.join('')).join('/');
}

function assertSamePuzzle(sudoku, initialGrid) {
  createSudoku(initialGrid);

  const currentGrid = sudoku.getGrid();

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const fixedValue = initialGrid[row][col];
      if (fixedValue !== 0 && currentGrid[row][col] !== fixedValue) {
        throw new Error('Game initial grid and current Sudoku describe different puzzles');
      }
    }
  }
}

function findDeadCell(sudoku) {
  const grid = sudoku.getGrid();

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (grid[row][col] === 0 && sudoku.getCandidates(row, col).length === 0) {
        return { row, col };
      }
    }
  }

  return null;
}

function cloneFailedBoards(failedBoards) {
  if (!Array.isArray(failedBoards)) {
    return [];
  }

  return failedBoards.filter((item) => typeof item === 'string');
}

export function createGame({
  sudoku,
  initialGrid = sudoku.getGrid(),
  undoStack = [],
  redoStack = [],
  failedExploreBoards = [],
  explore = null,
}) {
  if (!sudoku || typeof sudoku.clone !== 'function' || typeof sudoku.getGrid !== 'function') {
    throw new Error('Game requires a Sudoku domain object');
  }

  assertSamePuzzle(sudoku, initialGrid);

  let currentSudoku = sudoku.clone();
  let puzzleGrid = cloneGrid(initialGrid);
  let undos = undoStack.map((move) => {
    validateMove(move);
    return cloneMove(move);
  });
  let redos = redoStack.map((move) => {
    validateMove(move);
    return cloneMove(move);
  });
  let failedBoards = new Set(cloneFailedBoards(failedExploreBoards));
  let exploration = null;

  if (explore) {
    if (!explore.baseSudoku) {
      throw new Error('Invalid explore JSON');
    }

    const baseSudoku = createSudokuFromJSON(explore.baseSudoku);
    assertSamePuzzle(baseSudoku, puzzleGrid);

    exploration = {
      baseSudoku,
      undoStack: (explore.undoStack || []).map((move) => {
        validateMove(move);
        return cloneMove(move);
      }),
      redoStack: (explore.redoStack || []).map((move) => {
        validateMove(move);
        return cloneMove(move);
      }),
    };
  }

  function getActiveUndoStack() {
    return exploration ? exploration.undoStack : undos;
  }

  function getActiveRedoStack() {
    return exploration ? exploration.redoStack : redos;
  }

  function getExploreFailure() {
    const grid = currentSudoku.getGrid();
    const signature = gridSignature(grid);

    if (currentSudoku.hasConflicts()) {
      return {
        failed: true,
        reason: 'The board has duplicate values, so this exploration branch is inconsistent.',
        signature,
      };
    }

    const deadCell = findDeadCell(currentSudoku);
    if (deadCell) {
      return {
        failed: true,
        reason: `Cell (${deadCell.row + 1}, ${deadCell.col + 1}) has no legal candidates.`,
        signature,
      };
    }

    if (failedBoards.has(signature)) {
      return {
        failed: true,
        reason: 'This board was already reached through a failed exploration branch.',
        signature,
      };
    }

    return {
      failed: false,
      reason: '',
      signature,
    };
  }

  function rememberFailedExploreBoard() {
    if (!exploration) return;

    const failure = getExploreFailure();
    if (failure.failed) {
      failedBoards.add(failure.signature);
    }
  }

  return {
    getSudoku() {
      return currentSudoku.clone();
    },

    getGrid() {
      return currentSudoku.getGrid();
    },

    getInitialGrid() {
      return cloneGrid(puzzleGrid);
    },

    getInvalidCells() {
      return currentSudoku.getInvalidCells();
    },

    hasConflicts() {
      return currentSudoku.hasConflicts();
    },

    isFixedCell(row, col) {
      currentSudoku.getCell(row, col);
      return puzzleGrid[row][col] !== 0;
    },

    isWon() {
      return currentSudoku.isSolved();
    },

    getCandidates(row, col) {
      if (this.isFixedCell(row, col)) {
        return [];
      }

      return currentSudoku.getCandidates(row, col);
    },

    getCandidateHint(row, col) {
      if (this.isFixedCell(row, col)) {
        return {
          row,
          col,
          candidates: [],
          reason: `Cell (${row + 1}, ${col + 1}) is fixed by the puzzle.`,
        };
      }

      return currentSudoku.getCandidateHint(row, col);
    },

    getNextHint() {
      return currentSudoku.getNextHint();
    },

    guess({ row, col, value }) {
      const oldValue = currentSudoku.getCell(row, col);

      if (this.isFixedCell(row, col)) {
        throw new Error('Cannot change a fixed Sudoku cell');
      }

      if (oldValue === value) {
        return false;
      }

      const move = {
        row,
        col,
        oldValue,
        newValue: value,
      };

      currentSudoku.guess({ row, col, value });
      getActiveUndoStack().push(move);

      if (exploration) {
        exploration.redoStack = [];
      } else {
        redos = [];
      }

      rememberFailedExploreBoard();
      return true;
    },

    undo() {
      const activeUndos = getActiveUndoStack();
      const activeRedos = getActiveRedoStack();

      if (activeUndos.length === 0) return false;

      const move = activeUndos.pop();
      applyMoveToSudoku(currentSudoku, move, 'oldValue');
      activeRedos.push(cloneMove(move));
      return true;
    },

    redo() {
      const activeUndos = getActiveUndoStack();
      const activeRedos = getActiveRedoStack();

      if (activeRedos.length === 0) return false;

      const move = activeRedos.pop();
      applyMoveToSudoku(currentSudoku, move, 'newValue');
      activeUndos.push(cloneMove(move));
      rememberFailedExploreBoard();
      return true;
    },

    canUndo() {
      return getActiveUndoStack().length > 0;
    },

    canRedo() {
      return getActiveRedoStack().length > 0;
    },

    startExplore() {
      if (exploration) {
        return false;
      }

      exploration = {
        baseSudoku: currentSudoku.clone(),
        undoStack: [],
        redoStack: [],
      };

      rememberFailedExploreBoard();
      return true;
    },

    commitExplore() {
      if (!exploration) {
        return false;
      }

      const failure = getExploreFailure();
      if (failure.failed) {
        failedBoards.add(failure.signature);
        throw new Error(failure.reason);
      }

      undos.push(...exploration.undoStack.map(cloneMove));
      redos = [];
      exploration = null;
      return true;
    },

    discardExplore() {
      if (!exploration) {
        return false;
      }

      currentSudoku = exploration.baseSudoku.clone();
      exploration = null;
      return true;
    },

    isExploring() {
      return Boolean(exploration);
    },

    getExploreState() {
      const failure = getExploreFailure();

      return {
        active: Boolean(exploration),
        failed: Boolean(exploration && failure.failed),
        reason: exploration ? failure.reason : '',
        canCommit: Boolean(exploration && !failure.failed && exploration.undoStack.length > 0),
        canDiscard: Boolean(exploration),
        failedBoardsCount: failedBoards.size,
      };
    },

    toJSON() {
      return {
        type: 'Game',
        initialGrid: cloneGrid(puzzleGrid),
        sudoku: currentSudoku.toJSON(),
        undoStack: undos.map(cloneMove),
        redoStack: redos.map(cloneMove),
        failedExploreBoards: [...failedBoards],
        explore: exploration
          ? {
            baseSudoku: exploration.baseSudoku.toJSON(),
            undoStack: exploration.undoStack.map(cloneMove),
            redoStack: exploration.redoStack.map(cloneMove),
          }
          : null,
      };
    },

    toString() {
      return [
        'Game State',
        exploration ? 'mode=explore' : 'mode=normal',
        currentSudoku.toString(),
        `undoStack=${undos.length}`,
        `redoStack=${redos.length}`,
        `exploreUndoStack=${exploration ? exploration.undoStack.length : 0}`,
        `failedExploreBoards=${failedBoards.size}`,
      ].join('\n');
    },
  };
}

export function createGameFromJSON(json) {
  if (!json || !json.sudoku || !json.initialGrid) {
    throw new Error('Invalid Game JSON');
  }

  return createGame({
    sudoku: createSudokuFromJSON(json.sudoku),
    initialGrid: json.initialGrid,
    undoStack: json.undoStack || [],
    redoStack: json.redoStack || [],
    failedExploreBoards: json.failedExploreBoards || [],
    explore: json.explore || null,
  });
}
