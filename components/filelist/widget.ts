// components/FileListWidget.ts
import { Widget } from '@lumino/widgets';
import type { NestedTreeNode } from '../bundle/github-tools';
import { Message, MessageLoop } from '@lumino/messaging';
import Tree from './tree.js';
import
{
	configureFileHandle, getRegistryIdFromWidget, getSettingFromRegistryId,
	listDirectory, LOCAL_SETTINGS, treeHandler, verifyPermission
} from './widget-local';
import type { FilelistWindow, FileSystemHandle } from './widget.d';
import type { FileSystemWindow, LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';
import type { BuildWindow } from '../bundle/make.d';


const filelistSelf: FilelistWindow & LuminoLayoutWindow & GlobalToolbarsWindow & FileSystemWindow & BuildWindow = self as unknown as any;


if(!filelistSelf.fileListWidgets)
{
	filelistSelf.fileListWidgets = new Array<FileListWidget>();
}


export class FileListWidget extends Widget
{
	protected treeContainerId: string;
	container?: HTMLDivElement;
	handle?: FileSystemDirectoryHandle;
	private observer!: MutationObserver;
	protected loadedDatabases: Record<string, NestedTreeNode> = {};
	handleKey?: string;
	protected treeLoading: boolean = false;
	protected refreshTreeTimer: ReturnType<typeof setTimeout> | undefined;

	protected get selector()
	{
		return '#' + this.treeContainerId;
	}

	constructor(titleStr: string)
	{
		super();
		this.id = `filelist-panel-${filelistSelf.nextTemp?.()}`;
		this.title.label = titleStr;
		if(filelistSelf.fileListWidgets)
		{
			filelistSelf.fileListWidgets[filelistSelf.fileListWidgets.length] = this;
		}
		this.title.closable = true;
		this.node.style.minWidth = '200px';
		this.addClass('ide-file-tree-widget');

		this.treeContainerId = `tree-${Date.now()}`;
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			console.log('Intercepted close request, hiding instead: ' + this.title.label);
			// Hijack the close! Instead of destroying, hide the panel
			this.hide();
			this.parent = null;

			// Notify the parent DockPanel to recalculate layout paths immediately
			if(this.parent)
			{
				// Forcing an internal update pass so layout sizes collapse seamlessly
				MessageLoop.sendMessage(this.parent, new Message('layout-request'));
			}
			return; // BAIL OUT: Avoid calling super.processMessage() to prevent disposal
		}

		super.processMessage(msg);
	}


	public get defaultRepository()
	{
		return filelistSelf.settingsManager?.get('github', 'engineRepository');
	}


	/**
	 * Safe HTML Structure Injection
	 */
	protected async renderLayout(): Promise<void>
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
					<li><a alt="Google Drive" href="#new-gdrive" class="bx bxl bx-google-cloud"></a></li>
					<li><a alt="Hidden Files" href="#hidden" class="bx bx-eye-slash"></a></li>
					<li><a alt="Github Link" href="#link" class="bx bx-link"></a></li>
					<li><a alt="Refresh List" href="#refresh" class="bx bx-refresh-cw"></a></li>
					<li class="setting" data-placeholder="Owner">
						<select name="owner" class="filelist-owner">
						</select>
					</li>
					<li class="setting" data-placeholder="Repository">
						<select name="repository" class="filelist-repository">
						</select>
					</li>
					<li class="setting" data-placeholder="Branch">
						<select name="branch" class="filelist-branch">
						</select>
					</li>
				</ul>
				<div class="search-box">
				<input type="text" id="search" name="search" placeholder="Search many..." />
				</div>
				<div id="${this.treeContainerId}" class="treejs-render-target"></div>
			</div>
			`;

		const parts = this.defaultRepository.split('/');
		const ownerName = parts.length === 2 ? parts[0] : filelistSelf.RepositoryToolbar?.owner?.value;
		const repoName = parts.length === 2 ? parts[1] : parts[0] || filelistSelf.RepositoryToolbar?.repository?.value;

		const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement);
		const owners = filelistSelf.settingsManager?.get('github', 'ownersList');
		filelistSelf.addOwnerIfNotExists?.(ownerName);
		filelistSelf.updateSelectOptions?.(owner, owners, ownerName);

		const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement);
		const repositories = filelistSelf.settingsManager?.get('github', 'repositoriesList');
		filelistSelf.addRepoIfNotExists?.(repoName);
		filelistSelf.updateSelectOptions?.(repo, repositories, repoName);

		const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement);
		const branches = await filelistSelf.getBranches?.(ownerName, repoName);
		if(branches)
		{
			filelistSelf.updateSelectOptions?.(branch, branches, branches[0].name);
		}
	}

	protected override onAfterAttach(msg: Message): void
	{
		requestAnimationFrame(() =>
		{
			this.renderLayout().then(async () =>
			{
				this.bindDOMEvents();
				const widgetHandle = getRegistryIdFromWidget(this);
				const settingKey: string = getSettingFromRegistryId(widgetHandle);
				const database = filelistSelf.settingsManager?.get('github', 'environmentRepository');
				const handle = (await filelistSelf.getRecord?.(filelistSelf.DB_STORE_NAME ?? '', '/' + settingKey, database))?.contents;
				if((handle instanceof FileSystemDirectoryHandle)
					&& await verifyPermission(handle as FileSystemHandle))
				{
					this.handle = handle;
					const settingsConfig = Object.values(LOCAL_SETTINGS.filelist).find(s => s.key === settingKey);
					this.handleKey = configureFileHandle(this.handle, settingsConfig);
				}

				this.initializeFiletrees();
			});
		});
	}

	private bindDOMEvents(): void
	{
		// Handle select mutations
		this.node.querySelector('.filelist-repository')?.addEventListener('change', () => this.initializeFiletrees());
		this.node.querySelector('.filelist-branch')?.addEventListener('change', () => this.initializeFiletrees());
		this.node.querySelector('[href="#link"]')?.addEventListener('click', (event) =>
		{
			event.preventDefault();
			const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
			const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
			const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;
			window.open('https://github.com/' + owner + '/' + repo + '/tree/' + branch, '_blank');
		});
		this.node.querySelector('[href="#new-folder"]')?.addEventListener('click', async (event) =>
		{
			event.preventDefault();
			let handle: FileSystemDirectoryHandle | undefined;
			try
			{
				handle = await filelistSelf.showDirectoryPicker?.({
					mode: 'readwrite'
				});
			}
			catch(e)
			{
				this.handle = undefined;
				console.error(e);
				return;
			}
			const widgetHandle = getRegistryIdFromWidget(this);
			const settingKey: string = getSettingFromRegistryId(widgetHandle);
			const database = filelistSelf.settingsManager?.get('github', 'environmentRepository');
			await filelistSelf.ensureDatabaseContainer?.(database);
			await filelistSelf.putRecord?.(filelistSelf.DB_STORE_NAME ?? '', {
				timestamp: new Date(),
				mode: filelistSelf.FS_FILE ?? (0o100000 | 0o666),
				contents: handle,
				path: '/' + settingKey,
				parent: '/'
			}, database);
		});
		this.container = this.node.querySelector(this.selector) as HTMLDivElement;
		this.container?.addEventListener('click', treeHandler.bind(this, this.selector));
	}

	protected async initializeFiletrees(): Promise<void>
	{
		if(this.constructor.name === 'SearchListWidget')
		{
			return;
		}

		if(this.container && this.container.innerHTML !== '')
		{
			return;
		}

		const repoSelect = this.node.querySelector('.filelist-repository') as HTMLSelectElement;
		const pathRepo = window.location.pathname?.trim().replace(/\/$|^\//, '');

		if(pathRepo && pathRepo.length > 0)
		{
			repoSelect.value = pathRepo;
		}


		if(!this.container) return;
		this.container.innerHTML = '';

		if(this.handle)
		{
			await this.showLocalFilesystem();
			this.bindMutationObserver();
		}
		else
		{
			const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
			const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
			const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;
			await loadFileTree(owner, repo, branch, this.selector);
		}
	}


	private async showLocalFilesystem(folderId?: string): Promise<void>
	{
		if(!this.handle || !this.handleKey)
		{
			return;
		}

		const database = this.handleKey;

		if(!this.loadedDatabases[database] && filelistSelf.filesRepo)
		{
			// Scan root level items from local directory handle
			const localEntries = await listDirectory(this.handle, '');

			filelistSelf.filesRepo[this.selector] = localEntries;
			if(!filelistSelf.filesRepo[database])
			{
				filelistSelf.filesRepo[database] = {};
			}

			const nodes = filelistSelf.convertFlatToNested?.(Object.values(filelistSelf.filesRepo[this.selector] ?? {})) ?? [];
			for(let n of nodes)
			{
				n.id = database + '/' + n.id;
				const isDir = n.mode ? (n.mode >> 12) & (filelistSelf.ST_DIR ?? 4) : false;
				n.children = isDir ? [{ text: 'Loading...', id: `${n.path}/loading`, path: `${n.path}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode] : null;

				filelistSelf.filesRepo[database][n.path] = filelistSelf.FS.virtual[n.path] = this.loadedDatabases[n.id] = Object.assign(n, {
					mode: n.mode ?? filelistSelf.FS_FILE ?? (0o100000 | 0o666),
				});
			}

			this.loadedDatabases[database] = {
				id: database,
				text: database,
				status: 0,
				state: { open: false, expanded: false },
				path: database,
				children: nodes
			};
		}

		const activeTree = filelistSelf.trees?.[this.selector];
		if(!activeTree && filelistSelf.trees)
		{
			filelistSelf.trees[this.selector] = filelistSelf.trees[database] = new Tree(this.selector, {
				data: this.loadedDatabases[database].children,
				autoOpen: false,
				closeDepth: null
			});
		} else if(folderId)
		{
			activeTree.options.data = this.loadedDatabases[database].children;
			activeTree.renderPartial(folderId);
		}
	}


	/**
	 * Lazy load local folders and render structural updates
	 */
	protected async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void>
	{
		if(this.treeLoading) return;
		if(folderId.endsWith('[Recursive]') || folderId.endsWith('/loading')) return;

		const activeTree = filelistSelf.trees?.[this.selector];
		if(!activeTree || !activeTree.nodesById[folderId]) return;

		if(!this.handle || !this.handleKey) return;

		const database = this.handleKey;
		const parts = folderId.split('/');

		// Strip the database handle prefix to isolate the relative folder path
		const relativeSegments = parts.slice(2);
		const baseDir = relativeSegments.join('/');

		const targetNode = this.loadedDatabases[folderId];
		const basePath = targetNode?.path ?? baseDir;
		const dirPath = basePath.substring(0, basePath.lastIndexOf('/'));
		const parentDir = database + (dirPath.trim().length > 0 ? `/${dirPath}` : '');

		try
		{
			this.treeLoading = true;

			if(filelistSelf.filesRepo && !filelistSelf.filesRepo?.[database])
			{
				filelistSelf.filesRepo[database] = {};
			}

			// Resolve sub-directory handle and list its children
			const targetDirHandle = await filelistSelf.resolveDirectoryHandle?.(this.handle, relativeSegments);
			const result = targetDirHandle ? await listDirectory(targetDirHandle, baseDir) : {};

			const nodes = filelistSelf.convertFlatToNested?.(Object.values(result ?? {}));
			for(const r of nodes ?? [])
			{
				r.path = basePath + '/' + r.path;
				if(filelistSelf.filesRepo?.[database])
				{
					filelistSelf.filesRepo[database][r.path] = filelistSelf.FS.virtual[r.path] = Object.assign(r, {
						mode: r.mode ?? filelistSelf.FS_FILE ?? (0o100000 | 0o666),
					});
				}
			}

			const resultSet = Object.values(filelistSelf.filesRepo?.[database] ?? {}).reduce((acc: Record<string, any>, r: any) =>
			{
				acc[r.path] = r;
				return acc;
			}, {});

			const resultKeys = Object.keys(resultSet);

			// Isolate immediate children belonging to baseDir
			const childrenKeys = resultKeys.filter(path =>
			{
				const firstMatch = basePath === '/' || basePath === '' || path.startsWith(`${basePath}/`)
					|| path.startsWith(`/${basePath}/`);
				if(!firstMatch) return false;

				const relativePath = path.replace(/^[\/\\]|[\/\\]$/gi, '').substring(basePath.length + 1);
				const slashIndex = relativePath.indexOf('/');
				return slashIndex === -1 || slashIndex === relativePath.length - 1;
			});

			// Construct lazy nodes for TreeJS
			const newChildren = childrenKeys.map(path =>
			{
				const node = resultSet[path];
				const isDir = (node.mode >> 12) & (filelistSelf.ST_DIR ?? 4);
				const name = path.split('/').pop() || path;

				const newNode: NestedTreeNode = {
					id: database + '/' + path,
					text: name,
					path: path,
					parent: activeTree.nodesById[folderId],
					status: 0,
					state: { open: false, expanded: false },
					children: isDir ? [{ text: 'Loading...', id: `${database}/${path}/loading`, path: `${path}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode] : null
				};

				this.loadedDatabases[newNode.id] = activeTree.nodesById[newNode.id] = newNode;

				const searchParent = this.loadedDatabases[parentDir]?.children;
				if(searchParent)
				{
					const parentIndex = searchParent.findIndex(n => n.id === newNode.id);
					if(parentIndex > -1)
					{
						searchParent[parentIndex] = newNode;
					}
				}

				return newNode;
			});

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

			filelistSelf.sortNodes?.(newChildren);
			this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = newChildren;

		} catch(err: any)
		{
			console.error(`Failed to load local filesystem node: ${err.message}\n${err.stack ?? err.stacktrace}`);
			this.loadedDatabases[folderId] = {
				text: 'Error loading files',
				id: 'err',
				path: 'err',
				status: 0,
				state: { open: false, expanded: false }
			} as NestedTreeNode;
		}

		await this.showLocalFilesystem(folderId);

		if(this.refreshTreeTimer)
		{
			clearTimeout(this.refreshTreeTimer);
		}

		this.refreshTreeTimer = setTimeout(async () =>
		{
			activeTree.values = [];
			const node = activeTree.nodesById[folderId];
			if(node)
			{
				activeTree.open(node);
			}
			setTimeout(() =>
			{
				this.treeLoading = false;
			}, 300);
		}, 200);
	}

	/**
	 * Sets up MutationObserver to intercept class toggles on folder expansion.
	 */
	protected bindMutationObserver(): void
	{
		this.observer = new MutationObserver((mutations) =>
		{
			mutations.forEach(async (mutation) =>
			{
				if(mutation.type === 'attributes' && mutation.attributeName === 'class')
				{
					const target = mutation.target as HTMLElement;
					const folderId = target.getAttribute('data-id');

					if(folderId && target.classList.contains('treejs-node__open'))
					{
						await this.expandDatabaseTree(target, folderId);
					}
				}
			});
		});

		this.observer.observe(this.node, {
			attributes: true,
			subtree: true,
			attributeFilter: ['class']
		});
	}


	protected onResize(msg: Widget.ResizeMessage): void
	{
		// Keeps internal lists and heights optimized inside Lumino constraints
		if(msg.height < 0 || msg.width < 0) return;
	}


	protected override onBeforeDetach(msg: Message): void
	{
		if(this.observer)
		{
			this.observer.disconnect();
		}
		super.onBeforeDetach(msg);
	}
}


filelistSelf.FileListWidget = FileListWidget;


export class GameListWidget extends FileListWidget
{
	public override get defaultRepository()
	{
		return filelistSelf.settingsManager?.get('github', 'gameRepository');
	}
}


export async function loadFileTree(repoOwner: string, repoName: string, branch: string, selector: string): Promise<void>
{
	try
	{
		const database = `${repoOwner}/${repoName}`;
		if(filelistSelf.filesRepo)
		{
			filelistSelf.filesRepo[selector] = await filelistSelf.loadGitHubTree?.(repoOwner, repoName, branch);
		}

		if(!filelistSelf.filesRepo?.[selector]) return;

		if(filelistSelf.trees)
		{
			filelistSelf.trees[selector] = filelistSelf.trees[database] = new Tree(selector, {
				data: filelistSelf.convertFlatToNested?.(Object.values(filelistSelf.filesRepo[selector])),
				autoOpen: false,
				closeDepth: 2,
			});
		}
	} catch(error)
	{
		console.error('Failed to load file list tree:', error);
	}
}

filelistSelf.loadFileTree = loadFileTree;


filelistSelf.GameListWidget = GameListWidget;
