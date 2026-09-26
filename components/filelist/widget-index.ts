import type { NestedTreeNode } from "../bundle/github-tools";
import { FileListWidget } from "./widget";
import Tree from './tree.js';
import type { GlobalToolbarsWindow } from "../bundle/menu.d";
import type { GithubWindow } from "../bundle/github.d";
import type { BuildWindow } from "../bundle/make.d";
import type { SettingConfig, Settings } from "../bundle/settings.js";
import type { WidgetErrorEventArgs } from "./widget.d";
import { Signal, ISignal } from '@lumino/signaling';

const filelistSelf: GlobalToolbarsWindow & GithubWindow & BuildWindow & {
	settingsManager: Settings;
	HttpIndexWidget: typeof HttpIndexWidget;
} = self as unknown as any;

export class HttpIndexWidget extends FileListWidget
{
	private rootFolderName: string | null = null;
	private _errorOccurred = new Signal<this, WidgetErrorEventArgs>(this);

	get errorOccurred(): ISignal<this, WidgetErrorEventArgs>
	{
		return this._errorOccurred;
	}

	/**
	 * Sanitizes base URL and returns normal absolute or relative endpoint path
	 */
	private cleanUrl(rawSource: string): string
	{
		if(!rawSource) return '';
		let url = rawSource.replace(/^HttpIndex\//i, '').trim();
		return url.endsWith('/') ? url : `${url}/`;
	}

	/**
	 * Parses directory index HTML (Apache, Nginx, Express serve-index, IIS)
	 * and constructs standard NestedTreeNode objects.
	 */
	private static parseIndexHtml(htmlText: string, currentFetchUrl: string, baseNodePath: string, database: string): NestedTreeNode[]
	{
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlText, 'text/html');
		const nodes: NestedTreeNode[] = [];

		// Extract links: targets <a> inside #files, table rows, or standard index lists
		const links = Array.from(doc.querySelectorAll('ul#files li a, table tr td a, a'));
		const seenNames = new Set<string>();

		for(const link of links)
		{
			const href = link.getAttribute('href');
			if(!href || href === '#' || href.startsWith('javascript:')) continue;

			// Extract display name
			const nameSpan = link.querySelector('.name');
			let name = nameSpan ? nameSpan.textContent?.trim() : link.textContent?.trim();

			if(!name) continue;

			// Clean trailing slashes for visual normalization
			name = name.replace(/\/$/, '');

			// Ignore parent directory navigations, queries, or anchor targets
			if(name === '~' || name === '..' || name === '.' || href.startsWith('?') || href.startsWith('#') || seenNames.has(name))
			{
				continue;
			}

			// avoid breadcrumb
			// TODO: fix incase parent is the same name, use link comparison instead
			const parts = currentFetchUrl.split('/');
			if(parts.includes(name) && parts.map((p, i) => currentFetchUrl.includes(parts.slice(0, i).join('/'))))
			{
				continue;
			}

			if(this.isForbidden(name)) continue;

			seenNames.add(name);

			// Determine directory state via class attributes, standard HTML markup, or href structure
			const classAttr = (link.getAttribute('class') || '') + ' ' + (link.parentElement?.getAttribute('class') || '');
			const isDir = classAttr.includes('icon-directory') || href.endsWith('/') || !name.includes('.');

			const nodePath = `${baseNodePath.replace(/\/$/, '')}/${name.replace(/^\//, '')}`;
			const targetUrl = new URL(href, currentFetchUrl).href;

			const newNode: NestedTreeNode = {
				id: nodePath,
				text: name,
				path: nodePath,
				status: 0,
				state: { open: false, expanded: false },
				children: isDir
					? [{ text: 'Loading...', id: `${nodePath}/loading`, path: `${nodePath}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
					: null,
				mode: isDir ? (filelistSelf.FS_DIR ?? 0o040000) : (filelistSelf.FS_FILE ?? (0o100000 | 0o666)),
			};

			if(filelistSelf.filesRepo?.[database] && filelistSelf.FS)
			{
				filelistSelf.filesRepo[database][nodePath] = filelistSelf.FS.virtual[nodePath] = Object.assign(newNode, {
					mode: isDir ? (filelistSelf.FS_DIR ?? 0o040000) : (filelistSelf.FS_FILE ?? (0o100000 | 0o666)),
					remoteUrl: targetUrl
				});
			}

			nodes.push(newNode);
		}

		filelistSelf.sortNodes?.(nodes);
		return nodes;
	}

	/**
	 * Helper to fetch directory path from server and parse links into child nodes
	 */
	public static async fetchHttpIndexFolderNodes(fetchUrl: string, baseNodePath: string, database: string): Promise<NestedTreeNode[]>
	{
		const response = await fetch(fetchUrl, {
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml'
			}
		});

		if(!response.ok)
		{
			throw new Error(`HTTP Index error! status: ${response.status}`);
		}

		const htmlText = await response.text();

		if(filelistSelf.filesRepo && !filelistSelf.filesRepo[database])
		{
			filelistSelf.filesRepo[database] = {};
		}

		return this.parseIndexHtml(htmlText, fetchUrl, baseNodePath, database);
	}

	/**
	 * Extracts folder title from directory markup `<title>` or `<h1>` header
	 */
	private async fetchFolderName(baseUrl: string): Promise<string>
	{
		const httpIndexes = filelistSelf.settingsManager?.get('filelist', 'http_indexes') || DEFAULT_INDEXES;
		if(!baseUrl) return 'HttpIndex/Root';

		try
		{
			const response = await fetch(baseUrl, { method: 'GET' });
			if(response.ok)
			{
				const htmlText = await response.text();
				const parser = new DOMParser();
				const doc = parser.parseFromString(htmlText, 'text/html');

				const title = doc.querySelector('title')?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim();
				if(title)
				{
					return 'Drive: ' + title.replace(/^listing directory/i, '').replace(/[\/~]/g, '').trim() || baseUrl;
				}
			}

			return httpIndexes[baseUrl] ?? baseUrl;
		}
		catch(err)
		{
			console.error('Failed to resolve HTTP Index folder name:', err);
			return httpIndexes[baseUrl] ?? baseUrl;
		}
	}

	/**
	 * HTML Toolbar & Tree Mount Target Injection
	 */
	protected override async renderLayout(): Promise<void>
	{
		if(this.node.innerHTML !== '')
		{
			return;
		}

		this.node.innerHTML = `
            <div class="filelist-wrapper">
                <ul class="toolbar">
                    <li><a alt="New file" href="#new-file" class="bx bx-file-plus"></a></li>
                    <li><a alt="New folder" href="#new-folder" class="bx bx-folder-plus"></a></li>
                    <li><a alt="HTTP Server" href="#new-httpindex" class="bx bx-server"></a></li>
                    <li><a alt="Hidden Files" href="#hidden" class="bx bx-eye-slash"></a></li>
                    <li><a alt="Link" href="#link" class="bx bx-link"></a></li>
                    <li><a alt="Refresh List" href="#refresh" class="bx bx-refresh-cw"></a></li>

                    <li class="setting" data-placeholder="Index URL">
                        <select name="httpindexes" class="filelist-drive">
                        </select>
                    </li>
                </ul>
                <div class="search-box">
                    <input type="text" id="search" name="search" placeholder="Search files..." />
                </div>
                <div id="${this.treeContainerId}" class="treejs-render-target"></div>
            </div>
            `;

		const repo = (this.node.querySelector('.filelist-drive') as HTMLSelectElement);
		const repositories = filelistSelf.settingsManager?.get('filelist', 'httpIndexList');
		filelistSelf.updateSelectOptions?.(repo, repositories, this._source ? this.defaultRepository : undefined);
	}

	protected override async initializeFiletrees(): Promise<void>
	{
		await this.showGitRoot();
		this.bindMutationObserver();
	}

	public override get defaultRepository()
	{
		return this._source ?? (this.node.querySelector('.filelist-drive') as HTMLSelectElement)?.value;
	}

	private static isForbidden(name: string): boolean
	{
		const lower = name.toLowerCase();
		return lower.includes('urpm') || lower.includes('naked') || lower.includes('x-rated') || lower.includes('nsfw');
	}

	/**
	 * Lazily load subdirectories from server on demand when expanding tree nodes
	 */
	protected override async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void>
	{
		if(this.treeLoading) return;
		if(folderId.endsWith('[Recursive]')) return;

		const activeTree = filelistSelf.trees?.[this.selector];
		if(!activeTree || !activeTree.nodesById[folderId]) return;

		const parts = folderId.replace(/.*:\/\//, '').split('/');
		const database = parts[0];

		// Construct remote HTTP directory path sequentially
		const replaceCount = (this._source ?? DEFAULT_HTTP_INDEX_URL).replace(/.*?:\/\//, '').split('/').length;
		const relativePathSegments = parts.slice(replaceCount);
		const rootUrl = this.cleanUrl(this.defaultRepository);
		const fetchUrl = new URL(relativePathSegments.join('/'), rootUrl).href;

		try
		{
			this.treeLoading = true;

			const newChildren = await HttpIndexWidget.fetchHttpIndexFolderNodes(fetchUrl, folderId, database);

			if(newChildren.length === 0)
			{
				newChildren.push({
					text: 'Empty...',
					id: `${folderId}/empty`,
					path: `${folderId}/empty`,
					status: 0,
					state: { open: false, expanded: false }
				});
			}

			for(const child of newChildren)
			{
				this.loadedDatabases[child.id] = child;
				child.parent = activeTree.nodesById[folderId];
				activeTree.nodesById[child.id] = child;
			}

			this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = newChildren;

		}
		catch(err: any)
		{
			console.error(`Failed to load HTTP directory tree node: ${err.message}`);
			this.loadedDatabases[folderId] = {
				children: [{
					text: 'Error loading remote files',
					id: 'err',
					path: 'err',
					status: 0,
					state: { open: false, expanded: false }
				} as NestedTreeNode]
			} as NestedTreeNode;
		}

		await this.showGitRoot(folderId);

		if(this.refreshTreeTimer) clearTimeout(this.refreshTreeTimer);

		this.refreshTreeTimer = setTimeout(async () =>
		{
			activeTree.values = [];
			const node = activeTree.nodesById[folderId];
			if(node) activeTree.open(node);
			setTimeout(() => { this.treeLoading = false; }, 300);
		}, 200);
	}

	private async showGitRoot(folderId?: string): Promise<void>
	{
		const baseUrl = this.cleanUrl(this.defaultRepository);
		const database = this.defaultRepository;

		if(!this.rootFolderName)
		{
			this.rootFolderName = await this.fetchFolderName(baseUrl);

			const repoSelect = this.node.querySelector('.filelist-drive') as HTMLSelectElement;
			if(repoSelect)
			{
				const option = Array.from(repoSelect.options).find(opt => opt.value === database || opt.value === baseUrl);
				if(option)
				{
					option.textContent = this.rootFolderName;
				}
				else
				{
					const newOpt = document.createElement('option');
					newOpt.value = database;
					newOpt.textContent = this.rootFolderName;
					newOpt.selected = true;
					repoSelect.appendChild(newOpt);
				}
			}
		}

		const rootDisplayText = this.rootFolderName || database;

		if(!this.loadedDatabases[database])
		{
			let rootChildren: NestedTreeNode[] = [];
			try
			{
				rootChildren = await HttpIndexWidget.fetchHttpIndexFolderNodes(baseUrl, database, database);

				for(const child of rootChildren)
				{
					this.loadedDatabases[child.id] = child;
				}
			}
			catch(err)
			{
				console.error('Failed to initialize top-level HTTP index children:', err);
				return;
			}

			this.loadedDatabases[database] = {
				id: `${database}`,
				text: rootDisplayText,
				status: 0,
				state: { open: false, expanded: false },
				path: database,
				children: rootChildren
			};
		}
		else
		{
			this.loadedDatabases[database].text = rootDisplayText;
		}

		const activeTree = filelistSelf.trees?.[this.selector];
		if(!activeTree && filelistSelf.trees)
		{
			filelistSelf.trees[this.selector] = filelistSelf.trees[database] = new Tree(this.selector, {
				data: this.loadedDatabases[database].children,
				autoOpen: false,
				closeDepth: null
			});
		}
		else if(folderId && activeTree)
		{
			activeTree.options.data = this.loadedDatabases[database].children;
			activeTree.renderPartial(folderId);
		}
	}
}

filelistSelf.HttpIndexWidget = HttpIndexWidget;

export const DEFAULT_HTTP_INDEX_URL = window.location.origin + '/clipart';
export const DEFAULT_INDEXES: Record<string, string> = {};
DEFAULT_INDEXES[DEFAULT_HTTP_INDEX_URL] = 'clipart';

const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	filelist: {
		httpIndexList: {
			key: 'http_indexes',
			default: DEFAULT_INDEXES,
			type: 'json',
			description: 'json record of index URLs and display names.'
		}
	}
};

if(!filelistSelf.IMPORT_SETTINGS)
{
	filelistSelf.IMPORT_SETTINGS = {};
}

for(const [moduleKey, configs] of Object.entries(LOCAL_SETTINGS))
{
	filelistSelf.IMPORT_SETTINGS[moduleKey] = {
		...(filelistSelf.IMPORT_SETTINGS[moduleKey] || {}),
		...configs
	};
}

export const IMPORT_SETTINGS = filelistSelf.IMPORT_SETTINGS;
