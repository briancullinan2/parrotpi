import { Message } from '@lumino/messaging';
import { FileListWidget } from './widget';
import Tree from './tree.js';
import type { GithubService, StagingStatusPayload } from '../bundle/github-worker';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';
import type { FilelistWindow } from './widget.d';

const filelistSelf: LuminoLayoutWindow & GlobalToolbarsWindow & FilelistWindow = self as unknown as any;

export interface StagingDetails
{
	modified: string[];
	added: string[];
	staged?: string[];
	deleted?: string[];
}

export class GithubListWidget extends FileListWidget
{
	private githubTreeLoading: boolean = false;
	private refreshGithubTreeTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(titleStr: string = 'GitHub Workspace')
	{
		super(titleStr);
		this.id = `github-list-panel-${filelistSelf.nextTemp?.()}`;
		this.addClass('ide-github-tree-widget');

		// Bind shared staging and commit worker state manager
	}

	/**
	 * Minimal Layout Override: Search Box + Results Render Container
	 */
	protected override async renderLayout(): Promise<void>
	{
		if(this.node.innerHTML === '')
		{
			this.node.innerHTML = `
            <div class="filelist-wrapper search-widget-wrapper">
                <ul class="toolbar">
                    <li><a alt="Add File" href="#add-file" class="bx bx-file-plus"></a></li>
                    <li><a alt="Add All" href="#new-folder" class="bx bx-list-plus"></a></li>
					<li><a alt="Remove File" href="#new-folder" class="bx bx-file-minus"></a></li>
					<li><a alt="Remove All" href="#new-folder" class="bx bx-list-minus"></a></li>
                    <li><a alt="Hidden Files" href="#hidden" class="bx bx-eye-slash"></a></li>
                    <li><a alt="Refresh List" href="#refresh" class="bx bx-refresh-cw"></a></li>
                </ul>
                <div class="search-box">
                    <input type="text" id="search-${this.id}" class="search-input-field" name="search" placeholder="Search files or contents..." />
                </div>
                <div id="${this.treeContainerId}" class="treejs-render-target"></div>
            </div>
            `;
		}
	}

	protected override async initializeFiletrees(): Promise<void>
	{
		await this.showGithubTree();
		this.bindMutationObserver();
	}

	/**
	 * Renders top-level repository nodes into loadedDatabases and initializes TreeJS
	 */
	private async showGithubTree(folderId?: string): Promise<void>
	{
		const repoCollection = new Set(
			[
				filelistSelf.settingsManager?.get('github', 'engineRepository'),
				filelistSelf.settingsManager?.get('github', 'gameRepository'),
				filelistSelf.settingsManager?.get('github', 'assetRepository')
			].filter(Boolean)
		);

		const topRepositories: NestedTreeNode[] = [];

		for(const repoKey of repoCollection)
		{
			if(!this.loadedDatabases[repoKey])
			{
				this.loadedDatabases[repoKey] = {
					id: repoKey,
					text: repoKey,
					status: 0,
					state: { open: false, expanded: false },
					path: repoKey,
					children: [
						{
							id: `${repoKey}/loading`,
							text: 'Loading...',
							status: 0,
							state: { open: false, expanded: false },
							path: `${repoKey}/loading`
						} as NestedTreeNode
					]
				};
			}
			topRepositories.push(this.loadedDatabases[repoKey]);
		}

		const activeTree = filelistSelf.trees?.[this.selector];
		if(!activeTree && filelistSelf.trees)
		{
			filelistSelf.trees[this.selector] = new Tree(this.selector, {
				data: topRepositories,
				autoOpen: false,
				closeDepth: null
			});
		} else if(folderId)
		{
			activeTree.options.data = topRepositories;
			activeTree.renderPartial(folderId);
		}
	}

	/**
	 * Intercepts tree folder expansion events and dispatches staging queries
	 */
	public override async expandDatabaseTree(target: HTMLElement, folderId: string): Promise<void>
	{
		if(!target.classList.contains('treejs-node__open')) return;

		const activeTree = filelistSelf.trees?.[this.selector];
		if(!activeTree || !activeTree.nodesById[folderId]) return;

		const parts = folderId.split('/');
		const database = `${parts[0]}/${parts[1]}`;

		try
		{
			if(this.githubTreeLoading) return;
			this.githubTreeLoading = true;

			// Ensure remote baseline structure exists in memory
			if(!filelistSelf.filesRepo?.[database])
			{
				const branch = await filelistSelf.getDefaultBranch?.(parts[0], parts[1]);
				if(branch)
				{
					await filelistSelf.loadGitHubTree?.(parts[0], parts[1], branch);
				}
			}

			// LAYER A: Repository Root Node Expansion
			if(parts.length === 2)
			{
				const newChildren: NestedTreeNode[] = [
					{
						id: `${database}/Modified`,
						text: 'Modified',
						status: 0,
						state: { open: false, expanded: false },
						path: `${database}/Modified`,
						children: [{ text: 'Loading...', id: `${database}/Modified/loading`, path: `${database}/Modified/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
					},
					{
						id: `${database}/Added`,
						text: 'Added',
						status: 0,
						state: { open: false, expanded: false },
						path: `${database}/Added`,
						children: [{ text: 'Loading...', id: `${database}/Added/loading`, path: `${database}/Added/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
					},
					{
						id: `${database}/Staged`,
						text: 'Staged',
						status: 0,
						state: { open: false, expanded: false },
						path: `${database}/Staged`,
						children: [{ text: 'Loading...', id: `${database}/Staged/loading`, path: `${database}/Staged/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
					}
				];

				this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = newChildren;
				await this.showGithubTree(folderId);
				this.finalizeGithubTreeExpansion(folderId);
			}

			// LAYER B: Execute state check through service with piecewise progress support
			const branch = await filelistSelf.getDefaultBranch?.(parts[0], parts[1]);

			await filelistSelf.GithubService?.getInstance().executeCommand(
				{
					type: 'COMMIT_STATUS_CHECK',
					owner: parts[0],
					repo: parts[1],
					branch: branch,
					gitHubToken: localStorage.getItem('github_token') || (window as any).api?.github_token
				},
				{ target, folderId },
				(partialResult: StagingStatusPayload) =>
				{
					this.buildGithubTreeFromStaging(target, folderId, {
						modified: partialResult.modified || [],
						added: partialResult.added || [],
						staged: partialResult.staged || []
					});
				}
			);

		} catch(err: any)
		{
			console.error("Failed handling async root branch dependencies:", err);
			if(this.loadedDatabases[folderId])
			{
				this.loadedDatabases[folderId].children = [
					{ text: 'Error connecting to worker', id: `${folderId}/err`, path: `${folderId}/err`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode
				];
			}
			this.finalizeGithubTreeExpansion(folderId);
		}
	}

	/**
	 * Constructs nested node objects out of worker staging diffs
	 */
	private buildGithubTreeFromStaging(target: HTMLElement, folderId: string, stagingDetails: StagingDetails): void
	{
		const activeTree = filelistSelf.trees?.[this.selector];
		if(!activeTree) return;

		const parts = folderId.split('/');
		const database = `${parts[0]}/${parts[1]}`;

		// MODE A: Repository Root Category Expansion
		if(parts.length === 2)
		{
			const modifiedChildren = this.compileStagingLevelChildren(`${folderId}/Modified`, '', stagingDetails.modified || []);
			const addedChildren = this.compileStagingLevelChildren(`${folderId}/Added`, '', stagingDetails.added || []);
			const stagedChildren: NestedTreeNode[] = [];

			const rootCategories: NestedTreeNode[] = [
				{
					id: `${database}/Modified`,
					text: `Modified (${stagingDetails.modified.length})`,
					path: `${database}/Modified`,
					status: 0,
					state: { open: false, expanded: false },
					children: modifiedChildren.length > 0 ? modifiedChildren : [{ text: 'Empty...', id: `${database}/Modified/empty`, path: `${database}/Modified/empty`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
				},
				{
					id: `${database}/Added`,
					text: `Added (${stagingDetails.added.length})`,
					path: `${database}/Added`,
					status: 0,
					state: { open: false, expanded: false },
					children: addedChildren.length > 0 ? addedChildren : [{ text: 'Empty...', id: `${database}/Added/empty`, path: `${database}/Added/empty`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
				},
				{
					id: `${database}/Staged`,
					text: 'Staged (0)',
					path: `${database}/Staged`,
					status: 0,
					state: { open: false, expanded: false },
					children: stagedChildren.length > 0 ? stagedChildren : [{ text: 'Empty...', id: `${database}/Staged/empty`, path: `${database}/Staged/empty`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
				}
			];

			rootCategories.forEach(catNode =>
			{
				this.loadedDatabases[catNode.id] = activeTree.nodesById[catNode.id] = catNode;
			});

			if(this.loadedDatabases[folderId])
			{
				this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = rootCategories;
			}

			this.showGithubTree(folderId);
			this.finalizeGithubTreeExpansion(folderId);
			return;
		}

		// MODE B: Nested Category / Deep Directory Expansion
		const statusCategory = parts[2]; // 'Modified', 'Added', or 'Staged'
		const baseDir = parts.slice(3).join('/');

		let matchingPaths: string[] = [];
		if(statusCategory === 'Modified')
		{
			matchingPaths = stagingDetails.modified || [];
		} else if(statusCategory === 'Added')
		{
			matchingPaths = stagingDetails.added || [];
		}

		const dynamicChildren = this.compileStagingLevelChildren(folderId, baseDir, matchingPaths);
		if(this.loadedDatabases[folderId])
		{
			this.loadedDatabases[folderId].children = activeTree.nodesById[folderId].children = dynamicChildren;
		}

		this.showGithubTree(folderId);
		this.finalizeGithubTreeExpansion(folderId);
	}

	/**
	 * Pure parsing helper to structure matching paths into nested directory/file nodes
	 */
	private compileStagingLevelChildren(folderId: string, baseDir: string, matchingPaths: string[]): NestedTreeNode[]
	{
		const activeTree = filelistSelf.trees?.[this.selector];
		const newChildren: NestedTreeNode[] = [];
		const directoriesFound = new Set<string>();
		const absoluteFilesFound: string[] = [];

		matchingPaths.forEach(path =>
		{
			const matchesDirPrefix = baseDir === '' ? true : path.startsWith(baseDir + '/');
			if(!matchesDirPrefix) return;

			const relativePart = baseDir === '' ? path : path.substring(baseDir.length + 1);
			const nextSlashIdx = relativePart.indexOf('/');

			if(nextSlashIdx === -1)
			{
				absoluteFilesFound.push(path);
			} else
			{
				directoriesFound.add(relativePart.substring(0, nextSlashIdx));
			}
		});

		// Compile Directories
		directoriesFound.forEach(dirName =>
		{
			const computedPath = baseDir === '' ? dirName : `${baseDir}/${dirName}`;
			const nodeId = `${folderId}/${dirName}`;

			const dirNode: NestedTreeNode = {
				id: nodeId,
				text: dirName,
				path: computedPath,
				status: 0,
				state: { open: false, expanded: false },
				children: [{ text: 'Loading...', id: `${nodeId}/loading`, path: `${nodeId}/loading`, status: 0, state: { open: false, expanded: false } } as NestedTreeNode]
			};

			this.loadedDatabases[nodeId] = activeTree ? (activeTree.nodesById[nodeId] = dirNode) : dirNode;
			newChildren.push(dirNode);
		});

		// Compile Files
		absoluteFilesFound.forEach(path =>
		{
			const name = path.split('/').pop() || path;
			const nodeId = `${folderId}/${name}`;

			const fileNode: NestedTreeNode = {
				id: nodeId,
				text: name,
				path: path,
				status: 0,
				state: { open: false, expanded: false },
				children: null
			};

			this.loadedDatabases[nodeId] = activeTree ? (activeTree.nodesById[nodeId] = fileNode) : fileNode;
			newChildren.push(fileNode);
		});

		if(newChildren.length > 0 && typeof filelistSelf.sortNodes === 'function')
		{
			filelistSelf.sortNodes(newChildren);
		}

		return newChildren;
	}

	private finalizeGithubTreeExpansion(folderId: string): void
	{
		if(this.refreshGithubTreeTimer) clearTimeout(this.refreshGithubTreeTimer);

		this.refreshGithubTreeTimer = setTimeout(() =>
		{
			const activeTree = filelistSelf.trees?.[this.selector];
			if(activeTree)
			{
				activeTree.values = [];
				const node = activeTree.nodesById[folderId];
				if(node)
				{
					activeTree.open(node);
				}
			}
			setTimeout(() =>
			{
				this.githubTreeLoading = false;
			}, 300);
		}, 200);
	}

	protected override onBeforeDetach(msg: Message): void
	{
		if(this.refreshGithubTreeTimer) clearTimeout(this.refreshGithubTreeTimer);
		super.onBeforeDetach(msg);
	}
}

