<script>
	import { candidates } from '@sudoku/stores/candidates';
	import { userGrid, exploreState } from '@sudoku/stores/grid';
	import { cursor } from '@sudoku/stores/cursor';
	import { hints } from '@sudoku/stores/hints';
	import { notes } from '@sudoku/stores/notes';
	import { settings } from '@sudoku/stores/settings';
	import { keyboardDisabled } from '@sudoku/stores/keyboard';
	import { gamePaused, canUndo, canRedo } from '@sudoku/stores/game';
	import {
		commitExplore,
		discardExplore,
		exportSavedGame,
		loadSavedGame,
		redo,
		startExplore,
		undo
	} from '@sudoku/game';

	$: hintsAvailable = $hints > 0;

	function handleHint() {
		if (hintsAvailable) {
			if ($candidates.hasOwnProperty($cursor.x + ',' + $cursor.y)) {
				candidates.clear($cursor);
			}

			const hint = userGrid.applyHint($cursor);
			if (!hint) {
				alert('Select an empty cell to inspect candidates.');
				return;
			}

			hint.candidates.forEach((candidate) => candidates.add($cursor, candidate));
			alert(hint.reason);
		}
	}

	function handleNextHint() {
		if (!hintsAvailable) return;

		const hint = userGrid.applyNextHint();
		if (!hint) {
			alert('No cell has a single forced candidate. Try Explore mode.');
			return;
		}

		candidates.clear({ x: hint.col, y: hint.row });
		alert(hint.reason);
	}

	async function handleExport() {
		await navigator.clipboard.writeText(exportSavedGame());
		alert('Saved game JSON copied to clipboard');
	}

	function handleImport() {
		const text = prompt('Paste saved game JSON');
		if (!text) return;

	try {
			loadSavedGame(text);
			alert('Game restored from JSON');
		} catch (err) {
			alert('Invalid saved game JSON');
		}
	}

	function handleCommitExplore() {
		try {
			commitExplore();
		} catch (err) {
			alert(err.message);
		}
	}
</script>

<div class="action-buttons space-x-3">

	<button class="btn btn-round" disabled={$gamePaused || !$canUndo} title="Undo" on:click={undo}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
		</svg>
	</button>

	<button class="btn btn-round" disabled={$gamePaused || !$canRedo} title="Redo" on:click={redo}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 90 00-8 8v2M21 10l-6 6m6-6l-6-6" />
		</svg>
	</button>

	<button class="btn btn-round btn-badge" disabled={$keyboardDisabled || !hintsAvailable || $userGrid[$cursor.y][$cursor.x] !== 0} on:click={handleHint} title="Hints ({$hints})">
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
		</svg>

		{#if $settings.hintsLimited}
			<span class="badge" class:badge-primary={hintsAvailable}>{$hints}</span>
		{/if}
	</button>

	<button class="btn btn-round" disabled={$keyboardDisabled || !hintsAvailable} on:click={handleNextHint} title="Fill next forced candidate">
		Next
	</button>

	<button class="btn btn-round btn-badge" on:click={notes.toggle} title="Notes ({$notes ? 'ON' : 'OFF'})">
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
		</svg>

		<span class="badge tracking-tighter" class:badge-primary={$notes}>{$notes ? 'ON' : 'OFF'}</span>
	</button>

	<button class="btn btn-round" title="Export JSON" on:click={handleExport}>
		Export
	</button>

	<button class="btn btn-round" title="Import JSON" on:click={handleImport}>
		Import
	</button>

	{#if !$exploreState.active}
		<button class="btn btn-round" disabled={$gamePaused} title="Start Explore" on:click={startExplore}>
			Explore
		</button>
	{:else}
		<button class="btn btn-round" disabled={$exploreState.failed || !$exploreState.canCommit} title="Commit Explore" on:click={handleCommitExplore}>
			Commit
		</button>

		<button class="btn btn-round" title="Discard Explore" on:click={discardExplore}>
			Discard
		</button>
	{/if}

</div>

{#if $exploreState.active}
	<div class="explore-banner" class:explore-failed={$exploreState.failed}>
		{$exploreState.failed ? $exploreState.reason : 'Explore mode: try a branch, then commit or discard it.'}
	</div>
{/if}


<style>
	.action-buttons {
		@apply flex flex-wrap justify-evenly self-end;
	}

	.btn-badge {
		@apply relative;
	}

	.badge {
		min-height: 20px;
		min-width:  20px;
		@apply p-1 rounded-full leading-none text-center text-xs text-white bg-gray-600 inline-block absolute top-0 left-0;
	}

	.badge-primary {
		@apply bg-primary;
	}

	.explore-banner {
		@apply mt-3 px-3 py-2 rounded text-sm bg-blue-100 text-blue-900;
	}

	.explore-failed {
		@apply bg-red-100 text-red-700;
	}
</style>
