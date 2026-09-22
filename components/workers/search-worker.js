
// search-worker.js

/** @type {Worker & WorkerGlobalScope & import('../bundle/local.d').LocalWindow & import('../bundle/make.d').BuildWindow & import('../bundle/github.d').GithubWindow & { api?: { github_token?: string | null | undefined } }} */
const workerSelf = /** @type {any} */ (self);

if(!workerSelf.api)
{
	workerSelf.api = {
		github_token: null
	};
}

importScripts('/components/workers/local.js');
importScripts('/components/workers/sys_fs.js');
importScripts('/components/workers/github.js');


/**
 * Pulls all files from IndexedDB to scan locally in memory
 */
/**
 *
 * @param {string[]} activeRepositories
 * @returns {Promise<(import('../bundle/local.d').FileRecord & {repoSource: string, textContent: string})[]>}
 */
async function getAllLocalFiles(activeRepositories)
{
	/** @type {(import('../bundle/local.d').FileRecord & {repoSource: string, textContent: string})[]} */
	const allFiles = [];

	// Scan across all registered repository DB namespaces
	for(const dbName of activeRepositories)
	{
		try
		{
			const db = await workerSelf.getDB?.(dbName);
			if(!db?.objectStoreNames.contains(workerSelf.DB_STORE_NAME ?? ''))
			{
				db?.close();
				debugger;
				continue;
			}

			await workerSelf.readAll?.(dbName, file => allFiles.push({
				...file,
				repoSource: dbName,
				// Ensure contents are text strings if stored as array buffers/blobs
				textContent: file.contents instanceof Uint8Array
					? new TextDecoder().decode(file.contents)
					: (file.contents || '')
			}));

		} catch(err)
		{
			console.warn(`Worker IDB fetch skipped for ${dbName}:`, err);
		}
	}
	return allFiles;
}


// =========================================================================
// MAIN WORKER SWITCHBOARD INTERCEPTOR
// =========================================================================
workerSelf.onmessage = async function (e)
{
	const { query, activeRepositories, gitHubToken, caseSensitive, callbackId } = e.data;
	if(workerSelf.api)
	{
		workerSelf.api.github_token = gitHubToken;
	}

	if(!query || query.length < 2)
	{
		return workerSelf.postMessage({ type: 'clear', results: [], callbackId, query });
	}

	// Determine if the query is intended to be processed as a path glob
	const isGlobPattern = query.includes('*') || query.includes('?');

	/** @type {RegExp} */
	let regex;
	if(isGlobPattern && workerSelf.globToRegex)
	{
		regex = workerSelf.globToRegex(query, caseSensitive);
	} else
	{
		const flags = caseSensitive ? 'g' : 'gi';
		regex = new RegExp(query.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&'), flags);
	}

	// 1. Fetch unified array elements across all IndexedDB stores concurrently
	const localFiles = await getAllLocalFiles(activeRepositories || []);

	// -----------------------------------------------------------------
	// PASS 1: Filename Path String Search (Supports Regex & Glob Modes)
	// -----------------------------------------------------------------
	const pathResults = [];
	for(const file of localFiles)
	{
		regex.lastIndex = 0;

		// If it's a glob, we match the *entire* path string.
		// If it's a regular search query, we perform a standard substring test.
		const isMatch = isGlobPattern ? regex.test(file.path) : regex.test(file.path);

		if(isMatch)
		{
			pathResults.push({
				path: file.path,
				sha: file.sha,
				repoSource: file.repoSource,
				line: 1,
				matchText: `[Filename Match] ${file.path}`,
				filename: true,
				isDirty: !!workerSelf.FS?.virtual?.[file.path] // Check against tracking state
			});
		}
	}
	// Stream early match frames up to the UI thread layout immediately
	workerSelf.postMessage({ type: 'paths', results: pathResults, callbackId, query });

	// -----------------------------------------------------------------
	// PASS 2: Deep File Content String Parsing Loop
	// -----------------------------------------------------------------
	// Bypassed if the user is explicitly executing a structural file-path glob query
	if(isGlobPattern)
	{
		return workerSelf.postMessage({ type: 'contents', results: [], callbackId, query });
	}

	const contentResults = [];
	for(const file of localFiles)
	{
		const text = file.textContent;
		if(!text) continue;

		let match;
		regex.lastIndex = 0;

		while((match = regex.exec(text)) !== null)
		{
			const upToMatch = text.substring(0, match.index);
			const lineParts = upToMatch.split('\n');
			const lineNo = lineParts.length;

			const rawLineText = text.split('\n')[lineNo - 1] || '';
			const trimmedLineText = rawLineText.trim();

			const leadingWhitespaceLength = rawLineText.length - rawLineText.trimStart().length;
			const matchIndexInLine = lineParts[lineParts.length - 1].length - leadingWhitespaceLength;

			contentResults.push({
				path: file.path,
				sha: file.sha,
				repoSource: file.repoSource,
				line: lineNo,
				matchIndex: Math.max(0, matchIndexInLine), // <-- The index inside the trimmed snippet
				matchLength: match[0].length,              // <-- Length of the matched token
				matchText: trimmedLineText,
				isDirty: false
			});

			if(contentResults.length > 500) break;
		}
	}
	workerSelf.postMessage({ type: 'contents', results: contentResults, callbackId, query });

	// -----------------------------------------------------------------
	// PASS 3: Remote Network Gateway Interceptor Sync
	// -----------------------------------------------------------------
	if(gitHubToken)
	{
		const remoteResults = await workerSelf.searchGitHubCode?.(query, activeRepositories || [], gitHubToken);
		workerSelf.postMessage({ type: 'github', results: remoteResults, callbackId, query });
	}
};
