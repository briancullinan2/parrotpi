

import { SettingsManager } from "../bundle/settings";
import { getDefaultBranch, githubRequest, loadGitHubTree } from "./github-api";
import { filesRepo, trees } from "./github-types";
import { config, dirs, FS, path } from "./global";
import
{
	DB_STORE_NAME, debounceRecords
	, FS_DIR, FS_FILE, getRecord, putRecord,
	ST_FILE
} from "./local";
import { GithubWindow } from "./github.d";

const githubSelf: GithubWindow = self as unknown as any;

export async function getGitShaBrowser(content: string | Uint8Array | ArrayBuffer): Promise<string>
{
	const encoder = new TextEncoder();
	let contentBytes: Uint8Array;

	if(content instanceof Uint8Array)
	{
		contentBytes = content;
	} else if(content instanceof ArrayBuffer)
	{
		contentBytes = new Uint8Array(content);
	} else
	{
		contentBytes = encoder.encode(content);
	}

	const header = `blob ${contentBytes.byteLength}\0`;
	const headerBytes = encoder.encode(header);

	const finalBytes = new Uint8Array(headerBytes.byteLength + contentBytes.byteLength);
	finalBytes.set(headerBytes);
	finalBytes.set(contentBytes, headerBytes.byteLength);

	const hashBuffer = await crypto.subtle.digest('SHA-1', finalBytes);

	return Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}


githubSelf.getGitShaBrowser = getGitShaBrowser;


export async function cacheFile(storeName: string, repoOwner: string, repoName: string, filePath: string, sha?: string | null, forceReload = false): Promise<ArrayBuffer | Uint8Array | FileSystemDirectoryHandle | FileSystemFileHandle | null | undefined>
{
	return await debounceRecords(storeName ?? DB_STORE_NAME, 'path', filePath, sha, forceReload, `${repoOwner}/${repoName}`, 'cache');
}

githubSelf.cacheFile = cacheFile;


export async function cacheFileInternal(storeName: string, repoOwner: string, repoName: string, localPath: string, sha?: string | null, forceReload = false): Promise<ArrayBuffer | Uint8Array | FileSystemDirectoryHandle | FileSystemFileHandle | null | undefined>
{
	const selected = `${repoOwner}/${repoName}`;
	const filePath = selected + '/' + localPath;
	localPath = localPath.replace(selected, '');

	try
	{
		if(!filesRepo[selected])
		{
			const branch = await getDefaultBranch(repoOwner, repoName);
			await loadGitHubTree(repoOwner, repoName, branch);
		}

		if(!FS.virtual[filePath]
			|| !FS.virtual[filePath].contents
			|| (FS.virtual[filePath].contents instanceof ArrayBuffer && FS.virtual[filePath].contents.byteLength === 0)
			|| (FS.virtual[filePath].contents instanceof Uint8Array && FS.virtual[filePath].contents.length === 0)
		)
		{
			FS.virtual[filePath] = await getRecord(storeName ?? DB_STORE_NAME, localPath, selected);
		}

		if(filesRepo[selected] && filesRepo[selected][localPath] && FS.virtual[filePath]
			&& FS.virtual[filePath].timestamp && filesRepo[selected][localPath].timestamp
		)
		{
			if(FS.virtual[filePath].timestamp > filesRepo[selected][localPath].timestamp!)
			{
				console.info(`Skipping changed (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return FS.virtual[filePath].contents;
			}
		}

		try
		{
			if(typeof githubSelf.api !== 'undefined' && githubSelf.api.memfs && FS.virtual[filePath] && !githubSelf.api.memfs.exists(filePath))
			{
				githubSelf.api.memfs.addFile(filePath, FS.virtual[filePath].contents);
			}
		} catch(e: any)
		{
			console.error(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		if(filePath.includes('tmp/')
			|| filePath.includes(dirs.ENGINE_RELEASE)
			|| filePath.includes(dirs.ENGINE_DEBUG))
		{
			if(FS.virtual[filePath])
			{
				console.info(`Already compiled (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return FS.virtual[filePath].contents;
			} else
			{
				console.info(`Skipping output (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return null;
			}
		}

		const shouldDownload = filesRepo[selected] && filesRepo[selected][localPath];

		if(!shouldDownload && FS.virtual[filePath])
		{
			if(filePath.includes('.syms'))
			{
				debugger;
				console.error('No you fucking dont: ' + filePath);
			}
			console.info(`Already have cached (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return FS.virtual[filePath].contents;
		}

		if(!shouldDownload)
		{
			console.info(`Skipping unimportant (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return null;
		}

		if(!forceReload && FS.virtual[filePath])
		{
			console.info(`Skipping important (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return FS.virtual[filePath].contents;
		} else
		{
			console.info(`Downloading important (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
		}

		const jsonResponse = await githubRequest(repoOwner, repoName, `contents/${localPath}`);

		let bytes: Uint8Array;
		if(jsonResponse.encoding === 'base64')
		{
			const binString = atob(jsonResponse.content.replace(/\s/g, ''));
			bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
		} else
		{
			bytes = new TextEncoder().encode(jsonResponse.content || "");
		}
		if(bytes.length === 0 && jsonResponse.size > 0)
		{
			const response = await fetch(jsonResponse.download_url);
			bytes = new Uint8Array(await response.arrayBuffer());
		}

		FS.virtual[filePath] = {
			timestamp: filesRepo[selected] ? filesRepo[selected][localPath].timestamp : undefined,
			mode: FS_FILE,
			contents: bytes,
			path: localPath,
			sha: jsonResponse.sha,
			parent: localPath.substring(0, localPath.lastIndexOf('/'))
		};

		await putRecord(DB_STORE_NAME, FS.virtual[filePath], selected);

		try
		{
			if(typeof githubSelf.api !== 'undefined' && githubSelf.api.memfs && !githubSelf.api.memfs.exists(filePath))
			{
				githubSelf.api.memfs.addFile(filePath, bytes);
			}
		} catch(e: any)
		{
			console.warn(`Memfs Error: ${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		console.info(`Downloaded fresh (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
		return bytes;
	} catch(e: any)
	{
		console.error(`Cache file error in ${filePath}`);
		if(!e.message.includes('HTTP_ERROR:'))
		{
			console.error(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}

		if(filesRepo[selected] && filesRepo[selected][localPath])
		{
			return filesRepo[selected][localPath].contents;
		}
		throw e;
	}
}


githubSelf.cacheFileInternal = cacheFileInternal;



export async function getAuthenticatedUser(): Promise<any>
{
	const token = SettingsManager.get('github', 'githubToken');
	if(!token) return null;

	try
	{
		const response = await fetch('https://api.github.com/user', {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		if(response.status === 401)
		{
			console.error("Token is invalid or expired.");
			return null;
		}

		const userData = await response.json();
		console.info(`Authenticated as: ${userData.login}`);
		return userData;
	} catch(err)
	{
		console.error("Failed to fetch user data: " + err);
		return null;
	}
}


githubSelf.getAuthenticatedUser = getAuthenticatedUser;


export interface FlatFileNode
{
	path: string;
	sha?: string | null;
	type?: 'blob' | 'tree' | string;
	mode?: number | string;
	[key: string]: any;
}

export interface NestedTreeNode
{
	id: string;
	text: string;
	status: number;
	state: {
		open: boolean;
		expanded: boolean;
	};
	path: string;
	mode?: number;
	parent?: string;
	sha?: string | null;
	children?: NestedTreeNode[] | null | undefined;
}

export function convertFlatToNested(data: FlatFileNode[]): NestedTreeNode[]
{
	return data.reduce((acc: NestedTreeNode[], item: FlatFileNode) =>
	{
		const parts = item.path.split('/');
		let currentLevel = acc;

		parts.forEach((part, i) =>
		{
			let existingPath = currentLevel.find(node => node.text === part);

			if(!existingPath)
			{
				existingPath = {
					id: `${item.sha ?? item.path}`,
					text: part,
					status: 0,
					state: {
						open: false,
						expanded: false
					},
					path: item.path,
					sha: item.sha,
					mode: ((typeof item.mode === 'string'
						? parseInt('' + item.mode, 8) : item.mode ?? 8) >> 12) & ST_FILE
						? FS_FILE : FS_DIR
				};

				if(i < parts.length - 1 || item.type === 'tree')
				{
					existingPath.children = [];
				}

				currentLevel.push(existingPath);
			}

			if(!existingPath.children)
			{
				return;
			}

			currentLevel = existingPath.children;
		});

		return sortNodes(acc);
	}, []);
};

githubSelf.convertFlatToNested = convertFlatToNested;


export function sortNodes(nodes: NestedTreeNode[], recursion: NestedTreeNode[] = []): NestedTreeNode[]
{
	nodes.sort((a, b) =>
	{
		const isDirectory = (node: NestedTreeNode): boolean =>
		{
			// 1. Bitmask check if mode is present
			if(typeof node.mode === 'number')
			{
				if(typeof githubSelf.ST_FILE === 'number' && ((node.mode >> 12) & githubSelf.ST_FILE))
				{
					return false;
				}
				if(typeof githubSelf.ST_DIR === 'number' && ((node.mode >> 12) & githubSelf.ST_DIR))
				{
					return true;
				}
			}

			// 2. Check if children array or lazy-loading placeholder exists
			if(node.children !== null && node.children !== undefined)
			{
				return true;
			}
			return false;
		};

		const aIsDir = isDirectory(a);
		const bIsDir = isDirectory(b);

		// 1. Directories up top, files below
		if(aIsDir && !bIsDir) return -1;
		if(!aIsDir && bIsDir) return 1;

		// 2. Natural case-insensitive alphabetical sort
		return a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: 'base' });
	});

	// 3. Recurse into valid child arrays
	nodes.forEach(node =>
	{
		if(recursion.includes(node))
		{
			return;
		}
		if(Array.isArray(node.children) && node.children.length > 0)
		{
			recursion[recursion.length] = node;
			sortNodes(node.children, recursion);
		}
	});

	return nodes;
}


githubSelf.sortNodes = sortNodes;
