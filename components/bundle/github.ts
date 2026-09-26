
import JSZip from "jszip";
import { githubRequest, getDefaultBranch, getBranchVersion } from "./github-api";
import { getGitShaBrowser } from "./github-tools";
import { filesRepo, GitHubFileEntry, trees } from "./github-types";
import { config, dirs, FS, path } from "./global";
import { DB_STORE_NAME, FS_FILE, putRecord } from "./local";
import type { GithubWindow, ProgressFunction } from "./github.d";
import type { GlobalToolbarsWindow } from "./menu.d";
import type { BuildWindow } from "../bundle/make.d";
import type { FileRecord } from "./local.d";
import type { ApiWindow } from "./worker.d";

const githubSelf: GithubWindow & GlobalToolbarsWindow & BuildWindow & ApiWindow = self as unknown as any;

export async function downloadRepoZip(ownerName: string, repo: string, branch = 'master', database: string | null = null, onProgress?: ProgressFunction): Promise<string | undefined | null>
{
	const targetDatabase = database ?? `${ownerName}/${repo}`;

	let token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: githubSelf.settingsManager?.get('github', 'githubToken');

	try
	{
		console.info(`Requesting archive from ${ownerName}/${repo}...`);

		const headers: HeadersInit = {
			'Accept': 'application/vnd.github+json'
		};

		if(token)
		{
			headers['Authorization'] = `Bearer ${token}`;
		}

		// 1. Fetch archive stream from GitHub API (follows redirects automatically)
		const response = await fetch(`https://api.github.com/repos/${ownerName}/${repo}/zipball/${branch}`, {
			headers
		});

		if(!response.ok)
		{
			throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
		}

		// 2. Extract total expected file size if present in response headers
		const contentLength = response.headers.get('Content-Length');
		const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

		// 3. Obtain stream reader from response body
		if(!response.body)
		{
			throw new Error('ReadableStream not supported on target response body.');
		}

		const reader = response.body.getReader();
		let receivedBytes = 0;

		const chunks: Uint8Array[] = [];

		// 4. Read data stream chunk-by-chunk
		while(true)
		{
			const { done, value } = await reader.read();

			if(done)
			{
				break;
			}

			chunks.push(value);
			receivedBytes += value.length;

			// Compute percentage if total size is supplied by host
			const percent = totalBytes > 0
				? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
				: 0;

			if(typeof onProgress === 'function')
			{
				onProgress({
					loaded: receivedBytes,
					total: totalBytes,
					percent
				});
			}
		}

		// 5. Concatenate binary chunks into unified Uint8Array buffer
		const buffer = new Uint8Array(receivedBytes);
		let position = 0;
		for(const chunk of chunks)
		{
			buffer.set(chunk, position);
			position += chunk.length;
		}

		const zipPath = path.join(config.MOUNT_DIR, `${branch}.zip`);
		const localPath = path.join(config.MOUNT_DIR, 'branch.zip');

		FS.virtual[zipPath] = {
			timestamp: new Date(),
			mode: FS_FILE,
			contents: buffer,
			path: localPath,
			sha: await getGitShaBrowser(buffer),
			parent: localPath.substring(0, localPath.lastIndexOf('/'))
		};

		putRecord(DB_STORE_NAME, FS.virtual[zipPath], targetDatabase);
		console.info(`Downloaded ${buffer.byteLength} bytes. Processing...`);

		const zip = new JSZip();
		const contents = await zip.loadAsync(buffer);
		const unzipPromises: Promise<void>[] = [];

		contents.forEach((relativePath: string, file: any) =>
		{
			if(file.dir) return;

			unzipPromises.push(file.async('uint8array').then(async (data: Uint8Array) =>
			{
				const cleanedPath = relativePath.substring(relativePath.indexOf('/') + 1);
				const fullPath = path.join(targetDatabase, config.MOUNT_DIR, cleanedPath);
				const localPath = path.join(config.MOUNT_DIR, cleanedPath);

				FS.virtual[fullPath] = {
					timestamp: new Date(),
					mode: FS_FILE,
					contents: data,
					path: localPath,
					sha: await getGitShaBrowser(data),
					parent: localPath.substring(0, localPath.lastIndexOf('/'))
				};

				return putRecord(DB_STORE_NAME, FS.virtual[fullPath], targetDatabase);
			}));
		});

		await Promise.all(unzipPromises);
		console.info("Repository successfully mounted to virtual FS.");

		return FS.virtual[zipPath].sha;
	} catch(err: any)
	{
		console.error(`Failed to download repo: ${err.message}`);
		throw err;
	}
}

githubSelf.downloadRepoZip = downloadRepoZip;


/**
 * Downloads a GitHub repository file-by-file using the Git Tree API and raw content streams,
 * updating progress piece-wise across all files without needing JSZip or CORS-blocked zipball endpoints.
 *
 * @param owner Repository owner
 * @param repo Repository name
 * @param branch Branch name (default: 'master')
 * @param database Database or mounting bucket identity
 * @param onProgress Callback invoked on streaming progress updates
 * @returns Total count of mounted files
 */
export async function downloadRepoNew(
	owner: string,
	repo: string,
	branch: string = 'master',
	database: string | null = null,
	onProgress?: ProgressFunction | null
): Promise<number>
{
	const targetDatabase = database || `${owner}/${repo}`;

	const token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: githubSelf.settingsManager?.get('github', 'githubToken');

	const headers: Record<string, string> = {
		'Accept': 'application/vnd.github+json'
	};

	if(token)
	{
		headers['Authorization'] = `Bearer ${token}`;
	}

	try
	{
		console.info(`[downloadRepoNew] Fetching Git tree manifest for ${owner}/${repo} [${branch}]...`);

		if(typeof onProgress === 'function')
		{
			onProgress({ loaded: 0, total: 0, percent: 0, stage: 'Fetching Tree' });
		}

		// 1. Fetch complete recursive tree structure from GitHub API
		const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
			headers
		});

		if(!treeResponse.ok)
		{
			throw new Error(`Failed to fetch git tree structure: HTTP ${treeResponse.status}`);
		}

		const treeData: { tree: GitHubFileEntry[]; } = await treeResponse.json();

		if(!treeData.tree || !Array.isArray(treeData.tree))
		{
			throw new Error('Invalid or empty Git tree object returned by API.');
		}

		// 2. Filter file blobs (type === 'blob') and calculate absolute size total upfront
		const blobItems = treeData.tree.filter((item: GitHubFileEntry) => item.type === 'blob');

		let totalBytes = 0;
		blobItems.forEach(item =>
		{
			totalBytes += item.size || 0;
		});

		console.info(`[downloadRepoNew] Found ${blobItems.length} files (${totalBytes} total bytes). Downloading...`);

		let cumulativeLoadedBytes = 0;

		const reportProgress = (stage: string = 'Downloading'): void =>
		{
			if(typeof onProgress === 'function')
			{
				const percent = totalBytes > 0
					? Math.min(100, Math.round((cumulativeLoadedBytes / totalBytes) * 100))
					: 0;

				onProgress({
					loaded: cumulativeLoadedBytes,
					total: totalBytes,
					percent,
					stage
				});
			}
		};

		reportProgress('Downloading');

		// 3. Download files piece-wise via stream and mount directly to virtual storage
		for(let i = 0; i < blobItems.length; i++)
		{
			const item = blobItems[i];
			const fullPath = githubSelf.path.join(githubSelf.config.MOUNT_DIR, item.path);
			const expectedFileSize = item.size || 0;

			const rawUrl = token
				? `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`
				: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`;

			const fileHeaders: Record<string, string> = token
				? { ...headers, 'Accept': 'application/vnd.github.v3.raw' }
				: {};

			const fileResponse = await fetch(rawUrl, { headers: fileHeaders });

			if(!fileResponse.ok)
			{
				console.warn(`[downloadRepoNew] Could not fetch file ${item.path} (HTTP ${fileResponse.status}). Skipping...`);
				cumulativeLoadedBytes += expectedFileSize;
				reportProgress('Downloading');
				continue;
			}

			if(!fileResponse.body)
			{
				throw new Error(`ReadableStream not available for file stream: ${item.path}`);
			}

			const reader = fileResponse.body.getReader();
			const chunks: Uint8Array[] = [];
			let fileDownloadedBytes = 0;

			while(true)
			{
				const { done, value } = await reader.read();

				if(done)
				{
					break;
				}

				if(value)
				{
					chunks.push(value);
					fileDownloadedBytes += value.length;
					cumulativeLoadedBytes += value.length;
				}

				reportProgress('Downloading');
			}

			// Concatenate binary chunks for this specific file
			const fileBuffer = new Uint8Array(fileDownloadedBytes);
			let offset = 0;
			for(const chunk of chunks)
			{
				fileBuffer.set(chunk, offset);
				offset += chunk.length;
			}

			// Construct node & mount directly into virtual file system & IndexedDB
			const fileNode: FileRecord = {
				timestamp: new Date(),
				mode: githubSelf.FS_FILE ?? (0o100000 | 0o666),
				contents: fileBuffer,
				path: fullPath,
				sha: item.sha || (await getGitShaBrowser(fileBuffer)),
				parent: fullPath.substring(0, fullPath.lastIndexOf('/'))
			};

			githubSelf.FS.virtual[fullPath] = fileNode;
			githubSelf.putRecord?.(githubSelf.DB_STORE_NAME ?? '', fileNode, targetDatabase);
		}

		reportProgress('Complete');
		console.info(`[downloadRepoNew] Successfully mounted ${blobItems.length} files to virtual FS.`);

		return blobItems.length;

	} catch(err: unknown)
	{
		if(err instanceof Error)
		{
			console.error(`[downloadRepoNew] Failed downloading repo structure: ${err.message}`);
		}
		throw err;
	}
}

githubSelf.downloadRepoNew = downloadRepoNew;


export async function listReleases(ownerName: string, repo: string): Promise<any[]>
{
	try
	{
		const releases = await githubRequest(ownerName, repo, 'releases');

		releases.forEach((release: any) =>
		{
			console.info(`Release: ${release.name} (${release.tag_name})`);

			release.assets.forEach((asset: any) =>
			{
				console.info(` - Asset: ${asset.name} | URL: ${asset.browser_download_url}`);
			});
		});

		return releases;
	} catch(err)
	{
		console.error("Failed to list releases: " + err);
		return [];
	}
}


export
{
	getGitShaBrowser,
	getDefaultBranch,
	getBranchVersion,
	trees,
	filesRepo,
};
