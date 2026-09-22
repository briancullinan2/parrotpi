import { Message } from '@lumino/messaging';
import { FileListWidget } from './widget';
import type { GroupedSearchResult } from '../bundle/lumino-search';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow, LuminoMenuWindow } from '../bundle/menu.d';
import type { GithubWindow } from '../bundle/github.d';

const filelistSelf: LuminoLayoutWindow & GlobalToolbarsWindow & GithubWindow & LuminoMenuWindow = self as unknown as any;

export interface HistorySnapshot
{
	query: string;
	resultsSnapshot: GroupedSearchResult[];
}

export class SearchListWidget extends FileListWidget
{
	private currentCallbackId: string | null = null;
	private searchHistoryStack: HistorySnapshot[] = [];
	private federatedSearchTimer: ReturnType<typeof setTimeout> | null = null;
	private latestQueryVal: string | null = null;
	private lastExecutedQueryVal: string | null = null;
	private debounceSearchClickTimer: ReturnType<typeof setTimeout> | null = null;

	private cachedEl: HTMLElement | null = null;

	constructor(titleStr: string = 'Search Workspace')
	{
		super(titleStr);
		this.id = `search-list-panel-${filelistSelf.nextTemp?.()}`;
		this.addClass('ide-search-list-widget');
	}

	protected override async renderLayout(): Promise<void>
	{
		if(this.node.innerHTML === '')
		{
			this.node.innerHTML = `
            <div class="filelist-wrapper search-widget-wrapper">
                <div class="search-box">
                    <input type="text" id="search-${this.id}" class="search-input-field" name="search" placeholder="Search files or contents..." />
                </div>
                <div id="${this.treeContainerId}" class="search-results-target"></div>
            </div>
            `;
		}
	}

	protected override onAfterAttach(msg: Message): void
	{
		requestAnimationFrame(() =>
		{
			this.renderLayout().then(() =>
			{
				this.bindSearchEvents();
			});
		});
	}

	private bindSearchEvents(): void
	{
		const input = this.node.querySelector<HTMLInputElement>(`.search-input-field`);
		const resultsContainer = this.node.querySelector<HTMLDivElement>(`#${this.treeContainerId}`);

		if(input)
		{
			input.addEventListener('keydown', (e: KeyboardEvent) => this.handleSearchKeyDown(e, input));
		}

		if(resultsContainer)
		{
			resultsContainer.addEventListener('click', (e: MouseEvent) => this.handleSearchResultsClick(e));
		}
	}

	private handleSearchKeyDown(e: KeyboardEvent, input: HTMLInputElement): void
	{
		if(e.key === 'Enter')
		{
			e.preventDefault();
			const currentQuery = input.value.trim();
			if(currentQuery.length >= 2)
			{
				if(this.federatedSearchTimer)
				{
					clearTimeout(this.federatedSearchTimer);
					this.federatedSearchTimer = null;
				}
				this.executeSearch(currentQuery);
			}
			return;
		}

		setTimeout(() =>
		{
			const currentQuery = input.value.trim();
			const lastHistoryState = this.searchHistoryStack[this.searchHistoryStack.length - 1];
			const activeResultCount = lastHistoryState?.resultsSnapshot?.length || 0;

			if(activeResultCount === 0 || currentQuery.length < 2)
			{
				this.triggerFederatedSearch(currentQuery);
			}
		}, 0);
	}

	private triggerFederatedSearch(queryVal: string): void
	{
		this.latestQueryVal = queryVal;
		if(this.federatedSearchTimer) return;
		this.runLockingCycle();
	}

	private runLockingCycle(): void
	{
		this.federatedSearchTimer = setTimeout(() =>
		{
			if(!this.latestQueryVal || this.latestQueryVal.trim().length < 2)
			{
				this.federatedSearchTimer = null;
				return;
			}

			if(this.latestQueryVal === this.lastExecutedQueryVal)
			{
				this.federatedSearchTimer = null;
				return;
			}

			this.lastExecutedQueryVal = this.latestQueryVal;
			this.executeSearch(this.latestQueryVal);
			this.federatedSearchTimer = null;

			if(this.latestQueryVal !== this.lastExecutedQueryVal)
			{
				this.runLockingCycle();
			}
		}, 300);
	}

	private executeSearch(query: string): void
	{
		if(this.currentCallbackId)
		{
			filelistSelf.searchService?.cancelSearch(this.currentCallbackId);
			this.currentCallbackId = null;
		}

		const { callbackId, promise } = filelistSelf.searchService?.search(
			{ query, caseSensitive: false },
			(partialResults) => this.handleSearchWorkerResponse(partialResults, query),
			`search-widget-${this.id}`
		) ?? { callbackId: '', promise: Promise.resolve([]) };

		this.currentCallbackId = callbackId;

		promise.then((finalResults) =>
		{
			if(this.currentCallbackId === callbackId)
			{
				this.handleSearchWorkerResponse(finalResults, query);
			}
		});
	}

	private handleSearchWorkerResponse(incomingGroupedResults: GroupedSearchResult[], rawQueryUsed: string): void
	{
		const input = this.node.querySelector<HTMLInputElement>('.search-input-field');

		if(incomingGroupedResults.length > 0)
		{
			this.searchHistoryStack = this.searchHistoryStack.filter(h => h.query !== rawQueryUsed);
			this.searchHistoryStack.push({
				query: rawQueryUsed,
				resultsSnapshot: incomingGroupedResults
			});

			if(this.searchHistoryStack.length > 10)
			{
				this.searchHistoryStack.shift();
			}

			if(input) input.placeholder = `${incomingGroupedResults.length} matches for: "${rawQueryUsed}"`;
			this.renderSearchResults(incomingGroupedResults);
			this.buildTreeNodesFromSearch(incomingGroupedResults);
			return;
		}

		const lastValidState = this.searchHistoryStack[this.searchHistoryStack.length - 1];
		if(lastValidState)
		{
			if(input) input.placeholder = `❌ 0 results found for "${rawQueryUsed}"`;
			this.renderSearchResults(lastValidState.resultsSnapshot, lastValidState.query);
		} else
		{
			if(input) input.placeholder = `❌ 0 search results found for "${rawQueryUsed}"`;
			const container = this.node.querySelector(`#${this.treeContainerId}`);
			if(container)
			{
				container.innerHTML = `<div class="empty-placeholder">No assets matching workspace parameters.</div>`;
			}
		}
	}

	private renderSearchResults(groupedItems: GroupedSearchResult[], lastValidQuery?: string): void
	{
		const container = this.node.querySelector(`#${this.treeContainerId}`);
		if(!container) return;

		container.innerHTML = '';

		if(lastValidQuery)
		{
			const breadcrumb = document.createElement('div');
			breadcrumb.className = 'search-history-fallback-breadcrumb';
			breadcrumb.innerHTML = `Showing last valid state for: <strong>"${this.escapeHtml(lastValidQuery)}"</strong>`;
			container.appendChild(breadcrumb);
		}

		groupedItems.forEach(group =>
		{
			const card = document.createElement('div');
			card.className = 'search-card';

			const filename = group.path.split('/').pop() || '';
			const [owner, repoName = ''] = group.repo.split('/');
			const firstSha = group.localMatches[0]?.sha || '';

			const header = document.createElement('div');
			header.className = 'search-card-header';
			header.innerHTML = `
                <span class="search-file-path"
                      data-owner="${this.escapeHtml(owner)}"
                      data-repo-name="${this.escapeHtml(repoName)}"
                      data-path="${this.escapeHtml(group.path)}"
                      data-sha="${this.escapeHtml(firstSha)}">${this.escapeHtml(group.path)}</span>
                <span class="search-repo-badge">${this.escapeHtml(group.repo)}</span>
            `;
			card.appendChild(header);

			const body = document.createElement('div');
			body.className = 'search-card-body';

			const allMatches = [...group.localMatches, ...group.remoteMatches];
			allMatches.forEach(match =>
			{
				const row = document.createElement('div');
				row.className = 'search-match-row';
				row.dataset.owner = owner;
				row.dataset.repoName = repoName;
				row.dataset.path = group.path;
				row.dataset.sha = match.sha || '';
				row.dataset.line = String(match.line || 0);

				const isFilenameHit = match.matchText.startsWith('[Filename Match]');
				row.dataset.isFilenameHit = String(isFilenameHit);

				let displayCode = '';
				if(isFilenameHit)
				{
					displayCode = `<span class="filename-match-tag">📄 Filename match: "${this.escapeHtml(filename)}"</span>`;
				} else if(match.matchIndex !== undefined)
				{
					let startText = match.matchText.substring(0, match.matchIndex);
					const highlightedToken = match.matchText.substring(match.matchIndex, match.matchIndex + (match.matchLength || 0));
					const endText = match.matchText.substring(match.matchIndex + (match.matchLength || 0));

					if(startText.length > 25)
					{
						startText = '…' + startText.substring(startText.length - 25);
					}

					displayCode = `${this.escapeHtml(startText)}<mark class="search-highlight">${this.escapeHtml(highlightedToken)}</mark>${this.escapeHtml(endText)}`;
				} else
				{
					displayCode = this.escapeHtml(match.matchText);
				}

				row.innerHTML = `
                    <div class="search-line-number">${isFilenameHit ? '—' : match.line}</div>
                    <div class="search-match-text">${displayCode}</div>
                `;

				body.appendChild(row);
			});

			card.appendChild(body);
			container.appendChild(card);
		});
	}

	private async handleSearchResultsClick(event: MouseEvent, noBounce: boolean = false): Promise<void>
	{
		const target = event.target as HTMLElement;
		this.cachedEl ??= target.closest('.search-match-row') ?? target.closest('.search-file-path');

		if(!this.cachedEl) return;
		if(!noBounce && this.debounceSearchClickTimer) return;

		if(!this.debounceSearchClickTimer)
		{
			this.debounceSearchClickTimer = setTimeout(() =>
			{
				this.handleSearchResultsClick(event, true);
				this.debounceSearchClickTimer = null;
				this.cachedEl = null;
			}, 400);
			return;
		}

		const filePath = this.cachedEl.dataset.path;
		if(filePath)
		{
			await filelistSelf.FileManager?.navigateFile(
				filePath,
				this.cachedEl.dataset.owner,
				this.cachedEl.dataset.repoName,
				this.cachedEl.dataset.sha,
				parseInt(this.cachedEl.dataset.line || '0', 10)
			);
		}
	}

	private buildTreeNodesFromSearch(groupedItems: GroupedSearchResult[]): void
	{
		const searchDbKey = `search-db-${this.id}`;
		const flatItems = groupedItems.map(g => ({
			id: g.path,
			path: g.path,
			text: g.path.split('/').pop() || g.path,
			mode: (window as any).FS_FILE || 33188
		}));

		const nodes = (window as any).convertFlatToNested?.(flatItems) || [];

		this.loadedDatabases[searchDbKey] = {
			id: searchDbKey,
			text: 'Search Results',
			status: 0,
			state: { open: true, expanded: true },
			path: searchDbKey,
			children: nodes
		} as any;
	}

	private escapeHtml(str: string): string
	{
		if(typeof str !== 'string') return '';
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	protected override onBeforeDetach(msg: Message): void
	{
		if(this.currentCallbackId)
		{
			filelistSelf.searchService?.cancelSearch(this.currentCallbackId);
			this.currentCallbackId = null;
		}
		if(this.federatedSearchTimer) clearTimeout(this.federatedSearchTimer);
		super.onBeforeDetach(msg);
	}
}
