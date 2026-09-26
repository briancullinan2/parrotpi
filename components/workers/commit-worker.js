
// @ts-check
import initGit from './lg2_async.js';
//const lg = await initGit();


/** @type {Worker & import('../filelist/widget.d').CommitWorkerWindow} */
const workerSelf2 = /** @type {any} */ (self);

if(!workerSelf2.api)
{
	workerSelf2.api = {
		github_token: null
	};
}

import '../workers/local.js';
import '../workers/sys_fs.js';
import './github.js';

/**
 *
 * @param {string} repoOwner
 * @param {string} repoName
 * @param {string} branch
 * @param {string} commitMessage
 * @param {import('../filelist/widget.d').GithubChanges | undefined} staging
 * @returns
 */
async function pushLocalChangesToGitHub(repoOwner, repoName, branch, commitMessage, staging = void 0)
{
	// 1. Fetch current branch parent pointer references
	const commitData = await workerSelf2.githubRequest?.(repoOwner, repoName, `commits/${branch}`);
	const parentCommitSha = commitData.sha;
	const baseTreeSha = commitData.commit.tree.sha;

	// 2. Get the exact same staging layout calculated dynamically
	staging ||= await calculateStagedChanges(repoOwner, repoName, branch);

	if(staging.treeEntries.length === 0)
	{
		console.log("No discrete variations detected between local working layer and remote branch head.");
		return null;
	}

	// 3. Process and write actual network Blobs only for items in the staging entries
	/** @type {import('../bundle/github-types').GitHubWriteEntry[]} */
	const treeChanges = [];
	debugger;
	for(const entry of staging.treeEntries)
	{
		console.log(`Uploading changed file blob: ${entry.path}`);
		const blobSha = await createGitHubBlob(repoOwner, repoName, entry.contents);

		treeChanges.push({
			path: entry.path,
			mode: '100644',
			type: 'blob',
			sha: blobSha
		});
	}

	// 4. Construct the tree, commit, and bump branch ref
	const newTreeSha = await createGitHubTree(repoOwner, repoName, baseTreeSha, treeChanges);
	const newCommitSha = await createGitHubCommit(repoOwner, repoName, commitMessage, newTreeSha, [parentCommitSha]);
	await updateBranchReference(repoOwner, repoName, branch, newCommitSha);

	// 5. Hard alignment flush
	await workerSelf2.loadGitHubTree?.(repoOwner, repoName, branch);
	return newCommitSha;
}


/**
 * Safely converts Uint8Array to base64 in chunks to prevent stack overflow.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function uint8ToBase64(bytes)
{
	let binary = '';
	const len = bytes.byteLength;
	const CHUNK_SIZE = 0x8000; // 32KB chunks

	for(let i = 0; i < len; i += CHUNK_SIZE)
	{
		const chunk = bytes.subarray(i, i + CHUNK_SIZE);
		binary += String.fromCharCode.apply(null, Array.from(chunk));
	}

	return btoa(binary);
}


/**
 * Creates a raw binary blob structure on GitHub's structural servers.
 * @param {string} owner
 * @param {string} repo
 * @param {string | Uint16Array | ArrayBuffer} contents
 * @returns {Promise<string>}
 */
async function createGitHubBlob(owner, repo, contents)
{
	let base64Content;
	if(contents instanceof Uint8Array)
	{
		base64Content = uint8ToBase64(contents);
	}
	else if(contents instanceof ArrayBuffer)
	{
		base64Content = uint8ToBase64(new Uint8Array(contents));
	}
	else
	{
		base64Content = btoa(unescape(encodeURIComponent(String(contents))));
	}

	const payload = {
		content: base64Content,
		encoding: 'base64'
	};

	// Altering method behavior via an ad-hoc custom fetch context or extended payload wrapping
	const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
		method: 'POST',
		headers: getGitHubHeaders(),
		body: JSON.stringify(payload)
	});

	if(!result.ok) throw new Error(`Blob generation failed with status: ${result.status}`);
	const data = await result.json();
	return data.sha;
}

/**
 * Builds an explicit Git Tree description configuration map array structure.
 */
/**
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} baseTreeSha
 * @param {import('../bundle/github-types').GitHubWriteEntry[]} treeChanges
 * @returns
 */
async function createGitHubTree(owner, repo, baseTreeSha, treeChanges)
{
	const payload = {
		base_tree: baseTreeSha,
		tree: treeChanges
	};

	const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
		method: 'POST',
		headers: getGitHubHeaders(),
		body: JSON.stringify(payload)
	});

	if(!result.ok) throw new Error(`Tree generation failed with status: ${result.status}`);
	const data = await result.json();
	return data.sha;
}

/**
 * Writes an immutable Commit signature referencing the state of a compiled structural tree.
 */
/**
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} message
 * @param {string} treeSha
 * @param {string[]} parentCommitShas
 * @returns {Promise<string>}
 */
async function createGitHubCommit(owner, repo, message, treeSha, parentCommitShas)
{
	const payload = {
		message: message,
		tree: treeSha,
		parents: parentCommitShas
	};

	const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
		method: 'POST',
		headers: getGitHubHeaders(),
		body: JSON.stringify(payload)
	});

	if(!result.ok) throw new Error(`Commit generation failed with status: ${result.status}`);
	const data = await result.json();
	return data.sha;
}

/**
 * Patches the structural reference point pointer configuration for a remote branch layout.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string} commitSha
 * @returns
 */
async function updateBranchReference(owner, repo, branch, commitSha)
{
	const payload = {
		sha: commitSha,
		force: false // Set to true only if resetting historical chains
	};

	const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
		method: 'PATCH',
		headers: getGitHubHeaders(),
		body: JSON.stringify(payload)
	});

	if(!result.ok) throw new Error(`Failed updating reference branch path: ${result.status}`);
	return await result.json();
}

/**
 * Internal parsing token helper targeting local context variables inside workers
 * @returns {any}
 */
function getGitHubHeaders()
{
	let token = typeof workerSelf2.api !== 'undefined' ? workerSelf2.api.github_token : localStorage.getItem('github_token');
	return {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'Authorization': `Bearer ${token}`,
		'Content-Type': 'application/json'
	};
}




/**
 * Compares IndexedDB local storage data against the remote tree cache
 * to calculate unstaged modifications, new additions, or deletions.
 * Dynamically loads and respects a root-level .gitignore file via glob matching.
 * @param {string} repoOwner
 * @param {string} repoName
 * @param {string} branch
 * @param {boolean} listDeleted
 * @returns  {Promise<import('../filelist/widget.d').GithubChanges>}
 */
async function calculateStagedChanges(repoOwner, repoName, branch, listDeleted = false)
{
	const selected = `${repoOwner}/${repoName}`;

	// 1. Ensure the remote baseline tree layout skeleton is hydrated locally
	if(!workerSelf2.filesRepo?.[selected])
	{
		await workerSelf2.loadGitHubTree?.(repoOwner, repoName, branch);
	}
	const remoteTree = workerSelf2.filesRepo?.[selected] || {};

	/** @type {import('../filelist/widget.d').GithubChanges} */
	const changes = {
		modified: [],   // { path, localSha, remoteSha }
		added: [],      // { path, localSha }
		deleted: [],    // Remote files completely missing from local IndexedDB storage
		treeEntries: [] // Structured changes array targeting subsequent Git Trees compilation API passes
	};

	const foundLocalPaths = new Set();
	/** @type {RegExp[]} */
	const ignoreRules = [];

	try
	{
		// 2. Open up the repository's dedicated IndexedDB storage space
		const db = await workerSelf2.getDB?.(selected);
		if(!db?.objectStoreNames.contains(workerSelf2.DB_STORE_NAME ?? ''))
		{
			db?.close();
			console.log(`Target store ${workerSelf2.DB_STORE_NAME} not allocated yet for database: ${selected}`);
			return changes;
		}

		// --- PHASE 1: PARSE .GITIGNORE FROM IDB CACHE ---
		// Attempt to extract raw .gitignore record directly out of your IDB store
		let gitignoreRecord = null;
		try
		{
			gitignoreRecord = await workerSelf2.cacheFile?.(workerSelf2.DB_STORE_NAME ?? '', repoOwner, repoName, '.gitignore');
		} catch(e)
		{
			// Non-fatal if .gitignore doesn't exist yet
			debugger;
		}

		if(gitignoreRecord)
		{
			let ignoreText = "";
			if(gitignoreRecord instanceof Uint8Array)
			{
				ignoreText = new TextDecoder().decode(gitignoreRecord);
			} else if(gitignoreRecord instanceof ArrayBuffer)
			{
				ignoreText = new TextDecoder().decode(new Uint8Array(gitignoreRecord));
			} else if(gitignoreRecord instanceof FileSystemFileHandle)
			{
				ignoreText = await (await gitignoreRecord.getFile()).text();
			} else
			{
				return changes;
			}

			// Split file content into clean rules
			ignoreText.split(/\r?\n/).forEach(line =>
			{
				const trimmed = line.trim();
				// Omit blank lines and commented targets
				if(!trimmed || trimmed.startsWith('#')) return;

				try
				{
					// Adapt your worker's native glob translation rule engine
					const ruleRegex = workerSelf2.globToRegex?.(trimmed, false);
					if(ruleRegex)
					{
						ignoreRules.push(ruleRegex);
					}
				} catch(err)
				{
					console.warn(`Failed compiling ignore pattern [${trimmed}]:`, err);
				}
			});
			console.log(`Loaded ${ignoreRules.length} compiled pattern matching masks from root .gitignore`);
		}


		const ruleRegex1 = workerSelf2.globToRegex?.(workerSelf2.dirs.ENGINE_DEBUG + '/**', false);
		if(ruleRegex1)
		{
			ignoreRules.push(ruleRegex1);
		}

		const ruleRegex2 = workerSelf2.globToRegex?.(workerSelf2.dirs.ENGINE_RELEASE + '/**', false);
		if(ruleRegex2)
		{
			ignoreRules.push(ruleRegex2);
		}

		// Inline matcher to evaluate structural patterns
		const isIgnored = (/** @type {string} */ path) =>
		{
			// Hardcoded sanity fallbacks alongside dynamic rules
			if(path.includes('tmp/') || path.includes('/bin/') || path.includes('/obj/'))
			{
				return true;
			}
			return ignoreRules.some(regex =>
			{
				regex.lastIndex = 0;
				return regex.test(path);
			});
		};

		// --- PHASE 2: SCAN LOCAL INDEXEDDB RECORDS ---
		await workerSelf2.readAll?.(selected, async (fileRecord) =>
		{
			if(!fileRecord || !fileRecord.path) return;

			const filePath = fileRecord.path;

			if((fileRecord.mode >> 12) !== workerSelf2.ST_FILE) return;

			// Run item directly through combined glob evaluation
			if(isIgnored(filePath)) return;

			foundLocalPaths.add(filePath);

			const contents = fileRecord.contents;
			if(!contents) return;

			// Resolve local hash context via optimized fallback routing
			let localSha = fileRecord.sha;
			if(!localSha)
			{
				localSha = await workerSelf2.getGitShaBrowser?.(contents);
			}

			const remoteRecord = remoteTree[filePath];

			if(!remoteRecord)
			{
				// File exists locally in IDB but is absent on GitHub
				changes.added.push({ path: filePath, sha: localSha });
				changes.treeEntries.push({ path: filePath, sha: localSha, contents: contents });
			} else if(remoteRecord.sha !== localSha)
			{
				// File shifted away from remote baseline branch tracking points
				changes.modified.push({ path: filePath, localSha, remoteSha: remoteRecord.sha });
				changes.treeEntries.push({ path: filePath, sha: localSha, contents: contents });
			}
		});

		// --- PHASE 3: IDENTIFY DELETIONS FROM REMOTE ---
		if(listDeleted)
		{
			for(const [remotePath, remoteRecord] of Object.entries(remoteTree))
			{
				if(remoteRecord.type === 'tree') continue;

				// Skip verification tracking if the file matches dynamic ignore patterns
				if(isIgnored(remotePath)) continue;

				if(!foundLocalPaths.has(remotePath))
				{
					changes.deleted.push({ path: remotePath });

					// Formulate deletion entries for the Git Data Tree mapping array
					changes.treeEntries.push({
						path: remotePath,
						mode: '100644',
						type: 'blob',
						sha: null
					});
				}
			}
		}

	} catch(err)
	{
		console.error(`Failed compiling status check tracking matrix for ${selected}:`, err);
		throw err;
	}

	return changes;
}


/**
 *
 * @param {MessageEvent} e
 * @returns
 */
workerSelf2.onmessage = async function (e)
{

	// --- ROUTE A: GET STAGING STATUS (Safe / Read-Only) ---
	if(e.data.type === 'COMMIT_STATUS_CHECK')
	{
		const { owner, repo, branch, callbackId, gitHubToken } = e.data;
		if(workerSelf2.api)
		{
			workerSelf2.api.github_token = gitHubToken;
		}
		try
		{
			const stagingDetails = await calculateStagedChanges(owner, repo, branch);
			workerSelf2.postMessage({
				type: 'staging_status',
				status: 'SUCCESS',
				modified: stagingDetails.modified.map(f => f.path),
				added: stagingDetails.added.map(f => f.path),
				callbackId
			});
		} catch(err)
		{
			if(err instanceof Error)
			{
				workerSelf2.postMessage({ type: 'staging_status', status: 'ERROR', error: err.message, callbackId });
			}
		}
		return;
	}

	// --- ROUTE B: EXECUTE DESTRUCTIVE COMMIT PUSH ---
	if(e.data.type === 'COMMIT_PUSH')
	{
		const { owner, repo, branch, message, callbackId, gitHubToken } = e.data;
		if(workerSelf2.api)
		{
			workerSelf2.api.github_token = gitHubToken;
		}
		try
		{
			const finalSha = await pushLocalChangesToGitHub(owner, repo, branch, message);
			workerSelf2.postMessage({ type: 'commit_status', status: 'SUCCESS', sha: finalSha, callbackId });
		} catch(err)
		{
			if(err instanceof Error)
			{
				workerSelf2.postMessage({ type: 'commit_status', status: 'ERROR', error: err.message, callbackId });
			}
		}
		return;
	}

	if(e.data.type === 'DOWNLOAD_REPOSITORY')
	{
		const { owner, repo, branch, message, callbackId, gitHubToken } = e.data;
		if(workerSelf2.api)
		{
			workerSelf2.api.github_token = gitHubToken;
		}
		try
		{
			const fileCount = await workerSelf2.downloadRepoNew?.(owner, repo, branch, message, (progress) =>
			{
				workerSelf2.postMessage({ type: 'download_status', status: 'PROGRESS', isPartial: true, progress, callbackId });
			});

			workerSelf2.postMessage({ type: 'download_status', status: 'SUCCESS', count: fileCount, callbackId });
		} catch(err)
		{
			if(err instanceof Error)
			{
				workerSelf2.postMessage({ type: 'download_status', status: 'ERROR', error: err.message, callbackId });
			}
		}
		return;
	}
};
