import type { NestedTreeNode } from "../bundle/github-tools";
import { FileListWidget } from "./widget";
import Tree from './tree.js';
import type { GlobalToolbarsWindow } from "../bundle/menu.d";
import type { GithubWindow } from "../bundle/github.d";
import type { BuildWindow } from "../bundle/make.d";

const menuSelf: GlobalToolbarsWindow & GithubWindow & BuildWindow = self as unknown as any;

export class AssetListWidget extends FileListWidget
{
	protected override async initializeFiletrees(): Promise<void>
	{
		await this.showGitRoot();
		this.bindMutationObserver();
	}


	public override get defaultRepository()
	{
		return menuSelf.settingsManager?.get('github', 'assetRepository');
	}


	/**
	 * Lazy load folders and render structural updates
	 */
	protected override async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void>
	{
		if(this.treeLoading) return;
		if(folderId.endsWith('[Recursive]')) return;

		const activeTree = menuSelf.trees?.[this.selector];
		if(!activeTree || !activeTree.nodesById[folderId]) return;

		const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
		const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
		const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;
		const parts = folderId.split('/');
		const database = `${parts[0]}/${parts[1]}`;
		const baseDir = parts.slice(2).join('/');
		const basePath = this.loadedDatabases[database + '/' + baseDir].path;
		const dirPath = basePath.substring(0, basePath.lastIndexOf('/'));
		const parentDir = database + (dirPath.trim().length > 0 ? `/${dirPath}` : '');

		try
		{
			this.treeLoading = true;

			let resultSet: Record<string, any> = {};
			let resultKeys: string[] = [];

			// TODO: load the next level from loadGitHubTree(path = baseDir)

			if(menuSelf.filesRepo && !menuSelf.filesRepo?.[database])
			{
				menuSelf.filesRepo[database] = {};
			}

			// TODO: put github call here:
			const result = await menuSelf.loadGitHubTree?.(owner, repo, branch, baseDir);
			const nodes = menuSelf.convertFlatToNested?.(Object.values(result ?? {}));
			for(const r of nodes ?? [])
			{
				r.path = basePath + '/' + r.path;
				if(menuSelf.filesRepo?.[database] && menuSelf.FS)
				{
					menuSelf.filesRepo[database][r.path] = menuSelf.FS.virtual[r.path] = Object.assign(r, {
						mode: r.mode ?? menuSelf.FS_FILE ?? (0o100000 | 0o666),
					});
				}
			}


			resultSet = Object.values(menuSelf.filesRepo?.[database] ?? {}).reduce((acc: any, r: any) =>
			{
				acc[r.path] = r;
				return acc;
			}, {});
			resultKeys = Object.keys(resultSet);


			// Isolate immediate children
			const childrenKeys = resultKeys.filter(path =>
			{
				const firstMatch = basePath === '/' || basePath === '' || path.startsWith(`${basePath}/`)
					|| path.startsWith(`/${basePath}/`);
				if(!firstMatch) return false;

				const relativePath = path.replace(/^[\/\\]|[\/\\]$/gi, '').substring(basePath.length + 1);
				const slashIndex = relativePath.indexOf('/');
				return slashIndex === -1 || slashIndex === relativePath.length - 1;
			});

			// Construct lazy nodes
			const newChildren = childrenKeys.map(path =>
			{
				const node = resultSet[path];
				const isDir = (node.mode >> 12) & (menuSelf.ST_DIR ?? 4); // FS_DIR mock or standard directory mode mask
				const name = path.split('/').pop() || path;

				const newNode: NestedTreeNode = {
					id: database + '/' + node.id,
					text: name,
					path: path,
					parent: activeTree.nodesById[folderId],
					status: 0,
					state: { open: false, expanded: false },
					children: isDir ? [{ text: 'Loading...', id: `${path}/loading`, path: `${path}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode] : null
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

			menuSelf.sortNodes?.(newChildren);
			this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = newChildren;

		} catch(err: any)
		{
			console.error(`Failed to load tree node: ${err.message}\n${err.stack ?? err.stacktrace}`);
			this.loadedDatabases[folderId] = { text: 'Error loading files', id: 'err', path: 'err', status: 0, state: { open: false, expanded: false } } as NestedTreeNode;
		}

		await this.showGitRoot(folderId);

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
	 * Re-evaluates metadata and patches the TreeJS instance
	 */
	private async showGitRoot(folderId?: string): Promise<void>
	{
		const owner = (this.node.querySelector('.filelist-owner') as HTMLSelectElement).value;
		const repo = (this.node.querySelector('.filelist-repository') as HTMLSelectElement).value;
		const branch = (this.node.querySelector('.filelist-branch') as HTMLSelectElement).value;
		const database = `${owner}/${repo}`;

		if(!this.loadedDatabases[database] && menuSelf.filesRepo)
		{
			// TODO: replace with call to loadGitHubTree(path = '/')
			menuSelf.filesRepo[this.selector] = await menuSelf.loadGitHubTree?.(owner, repo, branch, '/');
			if(!menuSelf.filesRepo[database])
			{
				menuSelf.filesRepo[database] = {};
			}
			const nodes = menuSelf.convertFlatToNested?.(Object.values(menuSelf.filesRepo[this.selector] ?? {}));
			for(let n of nodes ?? [])
			{
				n.id = database + '/' + n.id;
				const isDir = n.mode ? (n.mode >> 12) & (menuSelf.ST_DIR ?? 4) : false;
				n.children = isDir ? [{ text: 'Loading...', id: `${n.path}/loading`, path: `${n.path}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode] : null;
				menuSelf.filesRepo[database][n.path] = menuSelf.FS.virtual[n.path] = this.loadedDatabases[n.id] = Object.assign(n, {
					mode: n.mode ?? menuSelf.FS_FILE ?? (0o100000 | 0o666),
				});;
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

		const activeTree = menuSelf.trees?.[this.selector];
		if(!activeTree && menuSelf.trees)
		{
			menuSelf.trees[this.selector] = menuSelf.trees[database] = new Tree(this.selector, {
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

}


