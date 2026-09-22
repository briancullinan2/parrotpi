
import { SettingsManager } from "../bundle/settings";
import { GithubWindow } from "./github.d";
import { updateSelectOptions } from "./github-settings";
import
{
	defaultBranches, filesRepo, GitHubBranch
	, GitHubFileEntry, mapFiles
} from "./github-types";
import
{
	DB_SCHEME, deleteOldDatabase
	, FS_DIR, FS_FILE, getDatabaseMetadata, needsInstall
	, setupDatabase
} from "./local";


const githubSelf: GithubWindow = self as unknown as any;


// --- Overloaded Function Signatures for Request Layer ---
export async function githubRequest(ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: false): Promise<any>;
export async function githubRequest(ownerName: string, repoName: string, url: string, authorize: boolean, buffer?: true): Promise<ArrayBuffer>;
export async function githubRequest(ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean): Promise<any | ArrayBuffer>;
export async function githubRequest(ownerName: string, repoName: string, url: string, authorize: boolean = true, buffer?: boolean): Promise<any>
{
	if(typeof SettingsManager !== 'undefined' && typeof githubSelf.api != 'undefined')
	{
		githubSelf.api.github_token = SettingsManager.get('github', 'githubToken');
	}

	const fullUrl = `https://api.github.com/repos/${ownerName}/${repoName}`
		+ (url.startsWith('/') || url.trim().length === 0 ? '' : '/') + url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;

	try
	{
		const headers: Record<string, string> = {
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		};

		const token = typeof githubSelf.api !== 'undefined'
			? githubSelf.api.github_token
			: localStorage.getItem('github_token');

		if(authorize && token)
		{
			headers['Authorization'] = `Bearer  ${token}`;
		}

		const response = await fetch(fullUrl, {
			method: 'GET',
			headers: headers
		});

		if(!response.ok)
		{
			if(response.status === 401 || response.status === 403)
			{
				throw new Error('UNAUTHORIZED_ACCESS');
			}
			throw new Error(`HTTP_ERROR: ${response.status}`);
		}

		if(buffer)
		{
			return await response.arrayBuffer();
		}
		return await response.json();
	} catch(up: any)
	{
		if(authorize && up.message === 'UNAUTHORIZED_ACCESS')
		{
			return await githubRequest(ownerName, repoName, url, false, buffer);
		}
		console.error("Failed to github: " + fullUrl, up);
		throw up;
	}
}


githubSelf.githubRequest = githubRequest;

export async function getDefaultBranch(ownerName: string, repo: string): Promise<string>
{
	const cacheKey = `${ownerName}/${repo}`;
	if(defaultBranches[cacheKey]) return defaultBranches[cacheKey];

	const data = await githubRequest(ownerName, repo, '');
	defaultBranches[cacheKey] = data.default_branch;
	return data.default_branch;
}

githubSelf.getDefaultBranch = getDefaultBranch;

export async function getBranchVersion(ownerName: string, repo: string, branch?: string): Promise<Date>
{
	const branchTarget = branch || await getDefaultBranch(ownerName, repo);
	const branchData = await githubRequest(ownerName, repo, `/branches/${branchTarget}`);
	const dateString = branchData.commit.commit.author.date;
	return new Date(dateString);
}

githubSelf.getBranchVersion = getBranchVersion;

export async function getBranches(repoOwner: string | undefined, repoName: string | undefined): Promise<GitHubBranch[]>
{
	if(repoOwner === undefined)
	{
		return [];
	}
	if(repoName === undefined)
	{
		return [];
	}


	try
	{
		const branches = await githubRequest(repoOwner, repoName, 'branches');
		const defaultName = await getDefaultBranch(repoOwner, repoName);

		branches.sort((a: any, b: any) =>
		{
			if(a.name === defaultName) return -1;
			if(b.name === defaultName) return 1;
			return a.name.localeCompare(b.name);
		});

		return branches;
	} catch(error)
	{
		console.error("Failed to fetch branches:", error);
		return [];
	}
}


githubSelf.getBranches = getBranches;


export async function githubGraphQL(query: string, variables: Record<string, any> = {}): Promise<any>
{
	const token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: SettingsManager.get('github', 'githubToken');

	const response = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer  ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables })
	});

	const result = await response.json();
	if(result.errors) throw new Error(result.errors[0].message);
	return result.data;
}

export async function loadGitHubTree(repoOwner: string, repoName: string, branch: string, path?: string): Promise<Record<string, GitHubFileEntry> | undefined>
{
	try
	{
		const database = `${repoOwner}/${repoName}`;
		const treeData: { tree: GitHubFileEntry[]; } = (path?.replace(/^[\/\\]|[\/\\]$/ig, '') ?? '').length > 0
			? await githubRequest(repoOwner, repoName, `git/trees/${path}`)
			: path ? await githubRequest(repoOwner, repoName, `git/trees/${branch}`)
				: await githubRequest(repoOwner, repoName, `git/trees/${branch}?recursive=1`);
		const commitData = await githubRequest(repoOwner, repoName, `commits/${branch}`);
		const buildDate = new Date(commitData.commit.author.date);

		filesRepo[database] = treeData.tree.reduce((obj: any, a: any) =>
		{
			if(a.path.toLowerCase().includes('.map') || a.path.toLowerCase().includes('.bsp'))
			{
				if(!mapFiles[a.path])
				{
					mapFiles[a.path] = a.path.split('/').pop() || '';
				}
			}
			a.timestamp = buildDate;
			obj[a.path] = a;
			return obj;
		}, {});

		const databases = await getDatabaseMetadata();
		if(databases.filter(d => d.key === database).length === 0
			|| (await needsInstall(database, DB_SCHEME)).item3)
		{
			await deleteOldDatabase(database);
			await setupDatabase(database, DB_SCHEME);
		}

		if(Object.keys(mapFiles).length > 1 && typeof updateSelectOptions !== 'undefined')
		{
			updateSelectOptions('map', mapFiles);
		}

		return filesRepo[database];
	} catch(error)
	{
		console.error('Failed to load GitHub tree:', error);
	}
}


githubSelf.loadGitHubTree = loadGitHubTree;


export async function loadGitHubTreeNew(repoOwner: string, repoName: string, branch?: string, initialPath = ''): Promise<any>
{
	const database = `${repoOwner}/${repoName}`;
	const branchName = branch ?? 'main';

	const treeQuery = `
	query GetFolderEntries($owner: String!, $name: String!, $expression: String!) {
	  repository(owner: $owner, name: $name) {
		object(expression: $expression) {
		  ... on Tree {
			entries {
			  path
			  type
			  oid
			  object {
				... on Blob { byteSize }
			  }
			}
		  }
		}
	  }
	}`;

	try
	{
		if(typeof filesRepo[database] === 'undefined')
		{
			filesRepo[database] = {} as Record<string, GitHubFileEntry>;
		}

		const filesToHydrate: string[] = [];
		const directoryQueue: string[] = [initialPath];

		while(directoryQueue.length > 0)
		{
			const currentSubPath = directoryQueue.shift()!;
			const expressionString = currentSubPath === ''
				? `${branchName}:`
				: `${branchName}:${currentSubPath}`;

			const treeData = await githubGraphQL(treeQuery, {
				owner: repoOwner,
				name: repoName,
				expression: expressionString
			});

			const entries = treeData?.repository?.object?.entries;
			if(!entries)
			{
				console.warn(`Could not resolve repository sub-tree entries at expression: ${expressionString}`);
				continue;
			}

			for(const entry of entries)
			{
				const isFile = entry.type === 'blob';

				filesRepo[database][entry.path] = {
					path: entry.path,
					sha: entry.oid,
					type: isFile ? 'file' : 'dir',
					mode: isFile ? FS_FILE : FS_DIR,
					size: entry.object?.byteSize ?? 0,
					timestamp: null,
					parent: entry.path.includes('/') ? entry.path.substring(0, entry.path.lastIndexOf('/')) : ''
				};

				if(isFile)
				{
					filesToHydrate.push(entry.path);
				} else
				{
					filesRepo[database][entry.path].timestamp = new Date();
					directoryQueue.push(entry.path);
				}
			}
		}

		const BATCH_SIZE = 50;
		const batchPromises: Promise<void>[] = [];

		for(let i = 0; i < filesToHydrate.length; i += BATCH_SIZE)
		{
			const chunk = filesToHydrate.slice(i, i + BATCH_SIZE);
			batchPromises.push(hydrateFileMTimes(repoOwner, repoName, branchName, chunk, filesRepo[database]));
		}

		await Promise.all(batchPromises);
		return filesRepo[database];
	} catch(error)
	{
		console.error('Robust GraphQL recursive tree load failed:', error);
		throw error;
	}
}

export async function hydrateFileMTimes(ownerName: string, repo: string, branch: string, filePaths: string[], targetCache: Record<string, any>): Promise<void>
{
	if(filePaths.length === 0) return;

	let aliasLines = '';
	filePaths.forEach((path, index) =>
	{
		const safeAlias = `file_${index}`;
		aliasLines += `
		${safeAlias}: ref(qualifiedName: $qualifiedBranch) {
		  target {
			... on Commit {
			  history(first: 1, path: "${path}") {
				nodes {
				  committedDate
				}
			  }
			}
		  }
		}\n`;
	});

	const dynamicQuery = `
	query GetBatchedMTimes($owner: String!, $repo: String!, $qualifiedBranch: String!) {
	  repository(owner: $owner, name: $repo) {
		${aliasLines}
	  }
	}`;

	const qualifiedBranch = branch.includes('refs/') ? branch : `refs/heads/${branch}`;

	try
	{
		const result = await githubGraphQL(dynamicQuery, {
			owner: ownerName,
			repo,
			qualifiedBranch
		});

		const repoData = result?.repository;
		if(!repoData) return;

		filePaths.forEach((path, index) =>
		{
			const safeAlias = `file_${index}`;
			const historyNodes = repoData[safeAlias]?.target?.history?.nodes;

			if(historyNodes && historyNodes.length > 0)
			{
				targetCache[path].timestamp = new Date(historyNodes[0].committedDate);
			} else
			{
				targetCache[path].timestamp = new Date();
			}
		});
	} catch(err)
	{
		console.warn('Failed resolving batch historical mtimes, processing paths:', filePaths, err);
		filePaths.forEach(path =>
		{
			if(!targetCache[path].timestamp) targetCache[path].timestamp = new Date();
		});
	}
}


export async function searchGitHubRepositories(query: string, ownerName?: string, repoName?: string): Promise<any[]>
{
	let queryString = query;

	if(ownerName && repoName)
	{
		queryString += ` repo:${ownerName}/${repoName}`;
	} else if(ownerName)
	{
		queryString += ` user:${ownerName}`;
	}

	const fullUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(queryString)}`;

	const token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: localStorage.getItem('github_token');

	const headers: Record<string, string> = {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};

	if(token)
	{
		headers['Authorization'] = `Bearer  ${token}`;
	}

	const response = await fetch(fullUrl, {
		headers
	});
	if(!response.ok) throw new Error(`Search failed: ${response.status}`);

	const data = await response.json();
	return data.items;
}

export async function searchGitHubCode(query: string, activeRepositories: string[], token: string | null): Promise<any[]>
{
	if(activeRepositories.length === 0) return [];

	const primaryRepo = activeRepositories[0];
	const queryString = `${query} repo:${primaryRepo}`;
	const fullUrl = `https://api.github.com/search/code?q=${encodeURIComponent(queryString)}`;

	const headers: Record<string, string> = {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};
	if(token)
	{
		headers['Authorization'] = `Bearer  ${token}`;
	}

	try
	{
		const response = await fetch(fullUrl, {
			headers
		});
		if(!response.ok) return [];

		const data: { items: GitHubFileEntry[]; } = await response.json();

		return (data.items ?? []).map((item: GitHubFileEntry) => ({
			path: item.path,
			sha: item.sha,
			repoSource: primaryRepo,
			matchText: `Remote Instance (Index Pointer: ${item.sha?.substring(0, 7)})`,
			isRemote: true
		}));
	} catch(err)
	{
		console.error("Worker remote GitHub fetch aborted:", err);
		return [];
	}
}

githubSelf.searchGitHubCode = searchGitHubCode;
