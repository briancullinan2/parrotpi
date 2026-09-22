import type { Terminal, IDecoration } from '@xterm/xterm';
import type { IPooledTerminal } from './widget-types';

// --- Structural Interfaces ---
export interface SearchResult
{
	line: number;
	x: number;
}

export interface TerminalSearchState
{
	searchIndex: number;
	searchResults: SearchResult[];
	searchAddonMarkers: IDecoration[];
	fileUnderlineMarkers: IDecoration[];
	debounceTimeout: ReturnType<typeof setTimeout> | null;
}

export interface ThemeColors
{
	foreground: string;
	background: string;
}

// Global window fallbacks / environment detection helpers


// Simulating x-mode (verbose regex) by joining an array of strings with comments
export const FILE_NAME_REGEX = new RegExp([
	'(?:',
	// Group 1: Captures full URLs or relative/absolute file paths
	'([a-z]+://[^\\s:]+|[\\w\\d._\\-/]+\\.[\\w\\d._\\-]+)',
	')',
	'(?:',
	// Line capture variations
	'(?:,\\s*Line:\\s*(\\d+))', // Handles "File: path, Line: 324"
	'|',
	'(?::(\\d+))',              // Handles "path:324"
	')?',
	'(?::(\\d+))?'                  // Handles secondary column offsets if present "path:324:10"
].join(''), 'gi');


export class TerminalSearchManager
{
	private static instance: TerminalSearchManager;
	private states = new Map<Terminal, TerminalSearchState>();

	private constructor()
	{

	}

	public static getInstance(): TerminalSearchManager
	{
		if(!TerminalSearchManager.instance)
		{
			TerminalSearchManager.instance = new TerminalSearchManager();
		}
		return TerminalSearchManager.instance;
	}

	/**
	 * Context safe state initialization hook.
	 */
	private getState(term: Terminal): TerminalSearchState
	{
		let state = this.states.get(term);
		if(!state)
		{
			state = {
				searchIndex: -1,
				searchResults: [],
				searchAddonMarkers: [],
				fileUnderlineMarkers: [],
				debounceTimeout: null
			};
			this.states.set(term, state);
		}
		return state;
	}

	/**
	 * Drops terminal instance lookup references when split panes collapse or widgets are disposed.
	 */
	public unregister(term: Terminal): void
	{
		this.clearSearch(term);
		this.states.delete(term);
	}

	/**
	 * Wipes visual decorations and empties result metrics for a targeted instance.
	 */
	public clearSearch(term: Terminal): void
	{
		const state = this.getState(term);
		state.searchIndex = -1;
		state.searchResults = [];

		state.searchAddonMarkers.forEach(decoration => decoration.dispose());
		state.fileUnderlineMarkers.forEach(decoration => decoration.dispose());

		state.searchAddonMarkers = [];
		state.fileUnderlineMarkers = [];
	}

	/**
	 * Scans rows within the target terminal's visible viewport space, registering decorators.
	 */
	public scanVisibleViewport(pooledCtx: IPooledTerminal, termToSearch: string, caseSensitive = false): void
	{
		const state = this.getState(pooledCtx.term);

		// Clear layout markers safely before pass
		state.searchAddonMarkers.forEach(m => m.dispose());
		state.fileUnderlineMarkers.forEach(m => m.dispose());
		state.searchAddonMarkers = [];
		state.fileUnderlineMarkers = [];
		state.searchResults = [];

		const buffer = pooledCtx.term.buffer.active;
		const activeRowMarkerOffset = buffer.baseY + buffer.cursorY;

		let startRow = buffer.viewportY;

		// Split-pane alignment parsing layout logic
		if(pooledCtx.activeOwner?.filterId === 'soft')
		{
			startRow = buffer.viewportY + (pooledCtx.term.rows / 2);
		}
		const endRow = startRow + pooledCtx.term.rows;

		let searchRegex: RegExp | null = null;
		if(termToSearch && termToSearch.trim().length > 0)
		{
			const flags = caseSensitive ? 'g' : 'gi';
			searchRegex = new RegExp(termToSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
		}

		for(let i = startRow; i < endRow; i++)
		{
			const line = buffer.getLine(i);
			if(!line) continue;

			const lineText = line.translateToString(true);
			const relativeMarkerDistance = i - activeRowMarkerOffset;

			// ==========================================
			// PASS A: Extract & Underline Valid File Paths
			// ==========================================
			let fileMatch: RegExpExecArray | null;
			if(typeof FILE_NAME_REGEX !== 'undefined')
			{
				FILE_NAME_REGEX.lastIndex = 0;
				while((fileMatch = FILE_NAME_REGEX.exec(lineText)) !== null)
				{
					const x = fileMatch.index;
					const length = fileMatch[0].length;

					const marker = pooledCtx.term.registerMarker(relativeMarkerDistance);
					if(marker)
					{
						const decoration = pooledCtx.term.registerDecoration({
							marker,
							x,
							width: length,
							layer: 'top'
						});

						if(decoration)
						{
							decoration.onRender(element =>
							{
								element.style.pointerEvents = 'none';
								element.classList.add('terminal-file-underline');
							});
							state.fileUnderlineMarkers.push(decoration);
						}
					}
				}
			}

			// ==========================================
			// PASS B: Text Highlight Splicer
			// ==========================================
			if(searchRegex)
			{
				let searchMatch: RegExpExecArray | null;
				searchRegex.lastIndex = 0;

				while((searchMatch = searchRegex.exec(lineText)) !== null)
				{
					const x = searchMatch.index;
					const length = searchMatch[0].length;

					const marker = pooledCtx.term.registerMarker(relativeMarkerDistance);
					if(marker)
					{
						const decoration = pooledCtx.term.registerDecoration({
							marker,
							x,
							width: length,
							layer: 'top',
							backgroundColor: '#ffffff',
							foregroundColor: '#000000',
						});

						if(decoration)
						{
							decoration.onRender(element =>
							{
								element.style.pointerEvents = 'none';
								element.classList.add('terminal-search-highlight');
							});
							state.searchAddonMarkers.push(decoration);
						}
					}
					state.searchResults.push({ line: i, x: x + 1 });
				}
			}
		}
	}

	/**
	 * Mutates input parent node placeholder metrics using specific state values.
	 */
	private updateSearchTerminalPlaceholder(searchTerminal?: HTMLInputElement, state?: TerminalSearchState): void
	{

		const container = searchTerminal?.parentElement;
		if(!container || !state) return;
		const queryLength = searchTerminal.value.length;

		if(queryLength <= 2)
		{
			container.setAttribute('placeholder', 'Search...');
		} else if(state.searchResults.length === 0)
		{
			container.setAttribute('placeholder', 'Search (0 results)...');
		} else
		{
			container.setAttribute('placeholder', `Search (${state.searchIndex + 1}/${state.searchResults.length})...`);
		}
	}



	/**
	 * Primary algorithmic execution method running search tasks against an explicit terminal.
	 */
	public executeFindQuery(pooledCtx: IPooledTerminal, event?: KeyboardEvent | null): void
	{
		const state = this.getState(pooledCtx.term);
		if(!pooledCtx.searchInput) return;

		if(state.debounceTimeout) clearTimeout(state.debounceTimeout);

		state.debounceTimeout = setTimeout(() =>
		{
			const queryValue = pooledCtx.searchInput?.value ?? '';

			if(queryValue.length > 2)
			{
				this.scanVisibleViewport(pooledCtx, queryValue);

				if(state.searchResults.length > 0)
				{
					if(event && event.key === 'Enter' && event.shiftKey)
					{
						state.searchIndex = (state.searchIndex <= 0) ? state.searchResults.length - 1 : state.searchIndex - 1;
					} else if(event && event.key === 'Enter')
					{
						state.searchIndex = (state.searchIndex >= state.searchResults.length - 1) ? 0 : state.searchIndex + 1;
					} else
					{
						const currentScroll = state.searchIndex > -1 && state.searchResults[state.searchIndex]
							? state.searchResults[state.searchIndex].line
							: pooledCtx.term.buffer.active.baseY;

						let nearest = state.searchResults.findIndex(res => res.line >= currentScroll);
						state.searchIndex = (nearest !== -1) ? nearest : 0;
					}

					pooledCtx.term.scrollToLine(state.searchResults[state.searchIndex].line);
				}
			} else
			{
				this.clearSearch(pooledCtx.term);
			}

			this.updateSearchTerminalPlaceholder(pooledCtx.searchInput, state);
			state.debounceTimeout = null;
		}, 250);
	}

}

export const SearchTerminal = TerminalSearchManager.getInstance();
