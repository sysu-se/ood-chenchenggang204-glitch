import { derived, get, writable } from 'svelte/store';
import { createGame, createGameFromJSON, createSudoku } from './domain/index.js';

const EMPTY_GRID = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function createGameFromPuzzle(initialGrid) {
  const puzzleGrid = cloneGrid(initialGrid);
  return createGame({
    sudoku: createSudoku(puzzleGrid),
    initialGrid: puzzleGrid,
  });
}

function snapshotGame(game) {
  return {
    initialGrid: game.getInitialGrid(),
    currentGrid: game.getGrid(),
    invalidCells: game.getInvalidCells(),
    won: game.isWon(),
    canUndo: game.canUndo(),
    canRedo: game.canRedo(),
    exploreState: game.getExploreState(),
    debugText: game.toString(),
  };
}

function createState(game) {
  return {
    game,
    snapshot: snapshotGame(game),
  };
}

export function createGameStore(initialGrid = EMPTY_GRID) {
  const state = writable(createState(createGameFromPuzzle(initialGrid)));

  const publicStateStore = derived(state, ($state) => $state.snapshot);
  const gameStore = publicStateStore;
  const currentGridStore = derived(state, ($state) => $state.snapshot.currentGrid);
  const initialGridStore = derived(state, ($state) => $state.snapshot.initialGrid);
  const invalidCellsStore = derived(state, ($state) => $state.snapshot.invalidCells);
  const wonStore = derived(state, ($state) => $state.snapshot.won);
  const canUndoStore = derived(state, ($state) => $state.snapshot.canUndo);
  const canRedoStore = derived(state, ($state) => $state.snapshot.canRedo);
  const exploreStateStore = derived(state, ($state) => $state.snapshot.exploreState);

  function setGame(game) {
    state.set(createState(game));
    return game;
  }

  function mutateGame(mutator) {
    let result;

    state.update(($state) => {
      result = mutator($state.game);
      return createState($state.game);
    });

    return result;
  }

  return {
    subscribe: publicStateStore.subscribe,
    gameStore,
    currentGridStore,
    initialGridStore,
    invalidCellsStore,
    wonStore,
    canUndoStore,
    canRedoStore,
    exploreStateStore,

    start(nextPuzzle) {
      return setGame(createGameFromPuzzle(nextPuzzle));
    },

    load(json) {
      return setGame(createGameFromJSON(json));
    },

    guess(move) {
      return mutateGame((game) => game.guess(move));
    },

    undo() {
      return mutateGame((game) => game.undo());
    },

    redo() {
      return mutateGame((game) => game.redo());
    },

    getCandidateHint(row, col) {
      return get(state).game.getCandidateHint(row, col);
    },

    getNextHint() {
      return get(state).game.getNextHint();
    },

    applyNextHint() {
      return mutateGame((game) => {
        const hint = game.getNextHint();
        if (!hint) {
          return null;
        }

        game.guess({
          row: hint.row,
          col: hint.col,
          value: hint.value,
        });

        return hint;
      });
    },

    startExplore() {
      return mutateGame((game) => game.startExplore());
    },

    commitExplore() {
      return mutateGame((game) => game.commitExplore());
    },

    discardExplore() {
      return mutateGame((game) => game.discardExplore());
    },

    getExploreState() {
      return { ...get(state).snapshot.exploreState };
    },

    canUndo() {
      return get(state).snapshot.canUndo;
    },

    canRedo() {
      return get(state).snapshot.canRedo;
    },

    exportJSON() {
      return get(state).game.toJSON();
    },

    getCurrentGrid() {
      return cloneGrid(get(state).snapshot.currentGrid);
    },

    getInitialGrid() {
      return cloneGrid(get(state).snapshot.initialGrid);
    },

    getInvalidCells() {
      return [...get(state).snapshot.invalidCells];
    },

    isWon() {
      return get(state).snapshot.won;
    },

    toString() {
      return get(state).snapshot.debugText;
    },
  };
}
