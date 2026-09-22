

// @ts-check

/** @type {import('../filelist/widget').GithubWorkerWindow & import('../bundle/local').LocalWindow} */
const githubSelf = /** @type {any} */ (self);

if(!githubSelf.trees)
{
	githubSelf.trees = {};
}

if(!githubSelf.filesRepo)
{
	githubSelf.filesRepo = {};
}

/**
 *
 * @param {string} ownerName
 * @param {string} repoName
 * @param {string} url
 * @param {boolean} authorize
 * @param {boolean} buffer
 * @returns
 */
async function githubRequest(ownerName, repoName, url, authorize = true, buffer = false)
{
	if(typeof githubSelf.SettingsManager != 'undefined' && githubSelf.api)
		githubSelf.api.github_token = githubSelf.settingsManager?.get('github', 'githubToken');

	const fullUrl = `https://api.github.com/repos/${ownerName}/${repoName}`
		+ (url.startsWith('/') || url.trim().length == 0 ? '' : '/') + url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;
	try
	{
		/** @type {Record<string, string>} */
		const headers = {
			'Accept': 'application/vnd.github+json',
			//'X-GitHub-Api-Version': '2022-11-28'
		};

		let token = typeof githubSelf.api !== 'undefined'
			? githubSelf.api.github_token
			: localStorage.getItem('github_token');

		// Only add auth if explicitly requested AND we have a token
		if(authorize && token)
		{
			// Using 'token ' works universally for both classic and fine-grained PATs
			headers['Authorization'] = `Bearer  ${token}`;
		} else if(!token)
		{
		}

		const response = await fetch(fullUrl, {
			method: 'GET',
			//mode: 'cors',
			//credentials: 'omit',
			headers: headers
		});

		if(!response.ok)
		{
			if(response.status === 401
				|| response.status === 403
			)
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
	} catch(up)
	{
		if(up instanceof Error)
		{
			if(authorize && up.message === 'UNAUTHORIZED_ACCESS')
			{
				return await githubRequest(ownerName, repoName, url, false, buffer);
			} else if(up.message === 'UNAUTHORIZED_ACCESS')
			{
			}
		}
		console.error("Failed to github: " + fullUrl, up);
		throw up;
	}

}


/** @type {Record<string, string>} */
let defaultBranches = {};
/**
 *
 * @param {string} owner
 * @param {string} repo
 * @returns
 */
async function getDefaultBranch(owner, repo)
{
	if(defaultBranches[owner + '/' + repo]) return defaultBranches[owner + '/' + repo];
	const data = await githubRequest(owner, repo, '');
	defaultBranches[owner + '/' + repo] = data.default_branch;
	return data.default_branch; // Usually "main" or "master"
}

/**
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string | undefined} branch
 * @returns
 */
async function getBranchVersion(owner, repo, branch)
{
	// Fallback to default branch if not specified
	branch ||= await getDefaultBranch(owner, repo);

	// 1. Query the specific branch endpoint
	const branchData = await githubRequest(owner, repo, `/branches/${branch}`);

	// 2. Extract the date string from the latest commit on that branch
	const dateString = branchData.commit.commit.author.date;

	// 3. Parse into a JavaScript Date object
	const buildDate = new Date(dateString);

	return buildDate;
}

githubSelf.getBranchVersion = getBranchVersion;


/**
 *
 * @param {string} repoOwner
 * @param {string} repoName
 * @returns {Promise<import('../bundle/github-types').GitHubBranch[]>}
 */
async function getBranches(repoOwner, repoName)
{

	try
	{
		/** @type {import('../bundle/github-types').GitHubBranch[]} */
		const branches = await githubRequest(repoOwner, repoName, 'branches');;

		const defaultName = await getDefaultBranch(repoOwner, repoName);

		const sortedBranches = branches.sort((a, b) =>
		{
			if(a.name === defaultName) return -1;
			if(b.name === defaultName) return 1;
			return a.name.localeCompare(b.name);
		});


		return sortedBranches;
	} catch(error)
	{
		console.error("Failed to fetch branches:", error);
		return [];
	}
}


/**
 *
 * @param {string} query
 * @param {any} variables
 * @returns
 */
async function githubGraphQL(query, variables = {})
{

	let token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: githubSelf.settingsManager?.get('github', 'githubToken');


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

/** @type {Record<string, string>} */
const mapFiles = {
	"": "Current map"
};

/**
 *
 * @param {string} repoOwner
 * @param {string} repoName
 * @param {string} branch
 * @returns
 */
async function loadGitHubTree(repoOwner, repoName, branch)
{

	try
	{
		let database = repoOwner + '/' + repoName;
		/** @type {({tree: import('../bundle/github-types').GitHubFileEntry[]})} */
		const treeData = await githubRequest(repoOwner, repoName, `git/trees/${branch}?recursive=1`);

		// 2. Get the latest commit to get a "Build Date"
		const commitData = await githubRequest(repoOwner, repoName, `commits/${branch}`);
		const buildDate = new Date(commitData.commit.author.date);

		if(githubSelf.filesRepo)
		{
			githubSelf.filesRepo[database] = treeData.tree.reduce((/** @type {Record<string, import('../bundle/github-types').GitHubFileEntry>} */ obj, a) =>
			{
				// Attach the buildDate to every file as a fallback mtime
				if(a.path.toLowerCase().includes('.map') || a.path.toLowerCase().includes('.bsp'))
				{
					const mapName = a.path.split('/').pop();
					if(!mapFiles[a.path] && mapName)
					{
						mapFiles[a.path] = mapName;
					}
				}
				a.timestamp = buildDate;
				obj[a.path] = a;
				return obj;
			}, {});
		}

		let databases = await githubSelf.getDatabaseMetadata?.() ?? [];
		if(databases.filter(d => d.key == database).length == 0
			|| (await githubSelf.needsInstall?.(database, githubSelf.DB_SCHEME ?? []))?.item3)
		{
			await githubSelf.deleteOldDatabase?.(database);
			await githubSelf.setupDatabase?.(database, githubSelf.DB_SCHEME ?? []);
		}

		if(Object.keys(mapFiles).length > 1 && typeof githubSelf.updateSelectOptions !== 'undefined')
		{
			githubSelf.updateSelectOptions('map', mapFiles);
		}

		return githubSelf.filesRepo?.[database];
	} catch(error)
	{
		console.error('Failed to load GitHub tree:', error);
	}

}


/**
 * Main Orchestrator: Instantiates an in-memory virtual filesystem cache
 * populated with accurate historical mtimes from Git history via recursive GraphQL.
 * @param {string} repoOwner - The owner of the GitHub repository.
 * @param {string} repoName - The repository name.
 * @param {string} branch - The branch target (defaults to 'main').
 * @param {string} initialPath - Optional directory subdirectory path to scope the initialization tree.
 */
async function loadGitHubTreeNew(repoOwner, repoName, branch, initialPath = '')
{
	const database = `${repoOwner}/${repoName}`;
	const branchName = branch || 'main';

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
		// Initialize the tracking database allocation if it hasn't happened yet
		if(githubSelf.filesRepo && typeof githubSelf.filesRepo?.[database] === 'undefined')
		{
			githubSelf.filesRepo[database] = {};
		}

		const filesToHydrate = [];

		// --- PHASE 1: Breadth-First Search Queue Recursion ---
		// Seed our queue with the initial explicit target path
		const directoryQueue = [initialPath];

		while(directoryQueue.length > 0)
		{
			const currentSubPath = directoryQueue.shift();

			// Format Git expression rule: "branch:" for root, or "branch:path/to/dir"
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
				// If a subfolder fails, log it and continue instead of crashing the entire build run
				console.warn(`Could not resolve repository sub-tree entries at expression: ${expressionString}`);
				continue;
			}

			for(const entry of entries)
			{
				const isFile = entry.type === 'blob';

				// Map out the flat file cache signature
				if(githubSelf.filesRepo?.[database])
				{
					githubSelf.filesRepo[database][entry.path] = {
						path: entry.path,
						sha: entry.oid,
						type: isFile ? 'file' : 'dir',
						mode: isFile ? (githubSelf.FS_FILE ?? (0o100000 | 0o666)) : (githubSelf.FS_DIR ?? (0o040000 | 0o755)),
						size: entry.object?.byteSize || 0,
						timestamp: null, // Will be hydrated later if file
						parent: entry.path.includes('/') ? entry.path.substring(0, entry.path.lastIndexOf('/')) : ''
					};
				}

				if(isFile)
				{
					filesToHydrate.push(entry.path);
				} else if(githubSelf.filesRepo?.[database])
				{
					// Set directory runtime fallback timestamp
					githubSelf.filesRepo[database][entry.path].timestamp = new Date();
					// Push the newly uncovered subdirectory straight into the queue loop to look deeper
					directoryQueue.push(entry.path);
				}
			}
		}

		// --- PHASE 2: Dynamic Batch Log Hydration via GraphQL Aliasing ---
		const BATCH_SIZE = 50;
		const batchPromises = [];

		if(githubSelf.filesRepo?.[database])
		{
			for(let i = 0; i < filesToHydrate.length; i += BATCH_SIZE)
			{
				const chunk = filesToHydrate.slice(i, i + BATCH_SIZE);
				batchPromises.push(hydrateFileMTimes(repoOwner, repoName, branchName, chunk, githubSelf.filesRepo[database]));
			}
		}

		// Concurrently populate file modification records across all chunks
		await Promise.all(batchPromises);

		return githubSelf.filesRepo?.[database];

	} catch(error)
	{
		console.error('Robust GraphQL recursive tree load failed:', error);
		throw error;
	}
}


/**
 * Compiles and runs an aliased GraphQL query targeting a specific array of paths.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string[]} filePaths
 * @param {Record<string, import('../bundle/local').FileRecord | null | undefined>} targetCache
 * @returns
 */
async function hydrateFileMTimes(owner, repo, branch, filePaths, targetCache)
{
	if(filePaths.length === 0) return;

	// Dynamically build up the aliased fields inside the query block
	let aliasLines = '';
	filePaths.forEach((path, index) =>
	{
		// GraphQL aliases must match standard naming constraints (no slashes, dots, or dashes)
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
			owner,
			repo,
			qualifiedBranch
		});

		const repoData = result?.repository;
		if(!repoData) return;

		// Loop back over the file paths and bind the returned commit logs to the original object references
		filePaths.forEach((path, index) =>
		{
			const safeAlias = `file_${index}`;
			const historyNodes = repoData[safeAlias]?.target?.history?.nodes;

			if(historyNodes && historyNodes.length > 0 && targetCache[path])
			{
				// Map the authentic Git modification time from the latest commit targeting this path
				targetCache[path].timestamp = new Date(historyNodes[0].committedDate);
			} else if(targetCache[path])
			{
				// Fallback safe assignment if no file mutations are tracked in current branch ref history
				targetCache[path].timestamp = new Date();
			}
		});

	} catch(err)
	{
		console.warn('Failed resolving batch historical mtimes, processing paths:', filePaths, err);
		// Fallback gracefully so an individual chunk failure doesn't brick the entire initialization process
		filePaths.forEach(path =>
		{
			if(targetCache[path] && !targetCache[path].timestamp) targetCache[path].timestamp = new Date();
		});
	}
}


/**
 *
 * @param {Uint8Array | ArrayBuffer | string} content
 * @returns {Promise<string>}
 */
async function getGitSha256Browser(content)
{
	const encoder = new TextEncoder();
	let contentBytes;

	if(content instanceof Uint8Array)
	{
		contentBytes = content;
	} else if(content instanceof ArrayBuffer)
	{
		// Wrap the raw ArrayBuffer in a Uint8Array view so it has a .length property
		contentBytes = new Uint8Array(content);
	} else
	{
		contentBytes = encoder.encode(content);
	}

	// Create Git blob header using .byteLength for accuracy
	const header = `blob ${contentBytes.byteLength}\0`;
	const headerBytes = encoder.encode(header);

	// Combine using .byteLength to support all binary types safely
	const finalBytes = new Uint8Array(headerBytes.byteLength + contentBytes.byteLength);
	finalBytes.set(headerBytes);
	finalBytes.set(contentBytes, headerBytes.byteLength);

	// Generate SHA-256 hash
	const hashBuffer = await crypto.subtle.digest('SHA-256', finalBytes);

	// Convert ArrayBuffer to Hex string
	return Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

githubSelf.getGitSha256Browser = getGitSha256Browser;

/**
 *
 * @param {Uint8Array | ArrayBuffer | string} content
 * @returns {Promise<string>}
 */
async function getGitShaBrowser(content)
{
	const encoder = new TextEncoder();
	let contentBytes;

	if(content instanceof Uint8Array)
	{
		contentBytes = content;
	} else if(content instanceof ArrayBuffer)
	{
		// Wrap the raw ArrayBuffer in a Uint8Array view so it has a .length property
		contentBytes = new Uint8Array(content);
	} else
	{
		contentBytes = encoder.encode(content);
	}

	// Create Git blob header using .byteLength for accuracy
	const header = `blob ${contentBytes.byteLength}\0`;
	const headerBytes = encoder.encode(header);

	// Combine using .byteLength to support all binary types safely
	const finalBytes = new Uint8Array(headerBytes.byteLength + contentBytes.byteLength);
	finalBytes.set(headerBytes);
	finalBytes.set(contentBytes, headerBytes.byteLength);

	// Generate SHA-1 hash
	const hashBuffer = await crypto.subtle.digest('SHA-1', finalBytes);

	// Convert ArrayBuffer to Hex string
	return Array.from(new Uint8Array(hashBuffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

githubSelf.getGitShaBrowser = getGitShaBrowser;

/**
 *
 * @param {string} storeName
 * @param {string} repoOwner
 * @param {string} repoName
 * @param {string} filePath
 * @param {string | undefined | null} sha
 * @param {boolean} forceReload
 * @returns {Promise<ArrayBuffer | Uint8Array | null>}
 */
async function cacheFile(storeName, repoOwner, repoName, filePath, sha, forceReload = false)
{
	return await githubSelf.debounceRecords?.(storeName ?? githubSelf.DB_STORE_NAME ?? '', 'path', filePath, sha, forceReload, repoOwner + '/' + repoName, 'cache');
}

githubSelf.cacheFile = cacheFile;

/**
 *
 * @param {string} storeName
 * @param {string} repoOwner
 * @param {string} repoName
 * @param {string} localPath
 * @param {string | undefined | null} sha
 * @param {boolean} forceReload
 * @returns  {Promise<ArrayBuffer | Uint8Array | FileSystemDirectoryHandle | FileSystemFileHandle | null | undefined>}
 */
async function cacheFileInternal(storeName, repoOwner, repoName, localPath, sha, forceReload = false)
{

	const selected = repoOwner + '/' + repoName;
	const filePath = selected + '/' + localPath;
	localPath = localPath.replace(selected, '');

	try
	{


		// TODO: this once from front end or backend, but not both
		if(!githubSelf.filesRepo?.[selected])
		{
			let branch = await getDefaultBranch(repoOwner, repoName);
			await loadGitHubTree(repoOwner, repoName, branch);
		}

		if(!githubSelf.FS.virtual[filePath]
			|| !githubSelf.FS.virtual[filePath].contents
			|| (githubSelf.FS.virtual[filePath].contents instanceof ArrayBuffer && githubSelf.FS.virtual[filePath].contents.byteLength === 0)
			|| (githubSelf.FS.virtual[filePath].contents instanceof Uint8Array && githubSelf.FS.virtual[filePath].contents.length === 0)
		)
		{
			githubSelf.FS.virtual[filePath] = await githubSelf.getRecord?.(storeName ?? githubSelf.DB_STORE_NAME, filePath, selected);
		}
		if(githubSelf.filesRepo?.[selected]
			&& githubSelf.filesRepo[selected][filePath] && githubSelf.FS.virtual[filePath])
		{
			if(githubSelf.FS.virtual[filePath].timestamp
				&& githubSelf.filesRepo[selected][filePath].timestamp
				&& githubSelf.FS.virtual[filePath].timestamp > githubSelf.filesRepo[selected][filePath].timestamp)
			{
				console.info(`Skipping changed (${typeof githubSelf.api !== 'undefined'
					&& githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return githubSelf.FS.virtual[filePath].contents;
			}
			//FS.virtual[filePath].timestamp = filesRepo[selected][filePath].timestamp
		}

		try
		{
			if(typeof githubSelf.api !== 'undefined' && githubSelf.api.memfs
				&& githubSelf.FS.virtual[filePath] && !githubSelf.api.memfs.exists(filePath))
				githubSelf.api.memfs.addFile(filePath, githubSelf.FS.virtual[filePath].contents);
		} catch(e)
		{
			if(e instanceof Error)
			{
				console.error(`${e.message}\n\r${e.stack}`);
			}
		}

		if(filePath.includes('tmp/')
			|| filePath.includes(githubSelf.dirs.ENGINE_RELEASE)
			|| filePath.includes(githubSelf.dirs.ENGINE_DEBUG))
		{
			if(githubSelf.FS.virtual[filePath])
			{
				console.info(`Already compiled (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return githubSelf.FS.virtual[filePath].contents;
			}
			else
			{
				console.info(`Skipping output (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
				return null;
			}
		}


		// TODO: only continue if the file is in github
		const shouldDownload = githubSelf.filesRepo?.[selected] && githubSelf.filesRepo[selected][filePath];


		// TODO: IF GITHUB, ALWAYS UPDATE
		if(!shouldDownload && githubSelf.FS.virtual[filePath])
		{
			if(filePath.includes('.syms'))
			{
				debugger;
				console.error('No you fucking dont: ' + filePath);
			}
			console.info(`Already have cached (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return githubSelf.FS.virtual[filePath].contents;
		}

		if(!shouldDownload)
		{
			console.info(`Skipping unimportant (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return null;
		}


		// TODO: use this to indicate whether we should update against file change time
		if(!forceReload && githubSelf.FS.virtual[filePath])
		{
			console.info(`Skipping important (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
			return githubSelf.FS.virtual[filePath].contents;
		} else
		{
			console.info(`Downloading important (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);
		}


		let jsonResponse = await githubRequest(repoOwner, repoName, `contents/${filePath}`);

		// --- DECODING LOGIC ---
		// GitHub wraps the file content in a JSON object and encodes it in Base64
		// We strip newlines and decode it back to a standard UTF-8 string
		let bytes;
		if(jsonResponse.encoding === 'base64')
		{
			// Decode base64 string to a binary string, then map to bytes
			const binString = atob(jsonResponse.content.replace(/\s/g, ''));
			bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
		} else
		{
			// Encode raw text to UTF-8 bytes
			bytes = new TextEncoder().encode(jsonResponse.content || "");
		}
		if(bytes.length === 0 && jsonResponse.size > 0)
		{
			const response = await fetch(jsonResponse.download_url);
			bytes = new Uint8Array(await response.arrayBuffer());
		}


		githubSelf.FS.virtual[filePath] = {
			timestamp: githubSelf.filesRepo?.[selected]?.[filePath].timestamp,
			mode: githubSelf.FS_FILE ?? (0o100000 | 0o666),
			contents: bytes,
			path: filePath,
			sha: jsonResponse.sha,
			parent: filePath.substring(0, filePath.lastIndexOf('/'))
		};


		// async to filesystem
		// does it REALLY matter if it makes it? wont it just redownload?
		await githubSelf.putRecord?.(storeName ?? githubSelf.DB_STORE_NAME, githubSelf.FS.virtual[filePath], selected);

		try
		{

			if(typeof githubSelf.api !== 'undefined' && githubSelf.api.memfs && !githubSelf.api.memfs.exists(filePath))
				githubSelf.api.memfs.addFile(filePath, bytes);

		} catch(e)
		{
			if(e instanceof Error)
			{
				console.warn(`Memfs Error: ${e.message}\n\r${e.stack}`);
			}
		}

		console.info(`Downloaded fresh (${typeof githubSelf.api !== 'undefined' && githubSelf.api.worker ? 'frontend' : 'worker'}): ${filePath}`);

		return bytes;
	} catch(e)
	{
		console.error(`Cache file error in ${filePath}`);
		if(e instanceof Error && !e.message.includes('HTTP_ERROR:'))
		{
			console.error(`${e.message}\n\r${e.stack}`);
		}

		if(githubSelf.filesRepo?.[selected]?.[filePath])
			return githubSelf.filesRepo[selected][filePath].contents;
		throw e;
	}

}

githubSelf.cacheFileInternal = cacheFileInternal;

/**
 * Downloads a GitHub repository zip archive while streaming progress back to the caller.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} [branch='master']
 * @param {string | null} [database=null]
 * @param {undefined | null | import('../bundle/github').ProgressFunction} [onProgress]
 * @returns {Promise<string | undefined | null>}
 */
async function downloadRepoZip(owner, repo, branch = 'master', database = null, onProgress = null)
{
	if(!database)
	{
		database = `${owner}/${repo}`;
	}

	let token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: githubSelf.settingsManager?.get('github', 'githubToken');

	try
	{
		console.info(`Requesting archive from ${owner}/${repo}...`);

		/** @type {HeadersInit} */
		const headers = {
			'Accept': 'application/vnd.github+json'
		};

		if(token)
		{
			headers['Authorization'] = `Bearer ${token}`;
		}

		// 1. Fetch archive stream from GitHub API (follows redirects automatically)
		const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`, {
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
		/** @type {Uint8Array[]} */
		const chunks = [];

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

		const zipPath = githubSelf.path.join(githubSelf.config.MOUNT_DIR, `${branch}.zip`);


		githubSelf.FS.virtual[zipPath] = {
			timestamp: new Date(),
			mode: githubSelf.FS_FILE ?? (0o100000 | 0o666),
			contents: buffer,
			path: zipPath,
			sha: await getGitShaBrowser(buffer),
			parent: zipPath.substring(0, zipPath.lastIndexOf('/'))
		};
		githubSelf.putRecord?.(githubSelf.DB_STORE_NAME ?? '', githubSelf.FS.virtual[zipPath], database);
		console.info(`Downloaded ${buffer.byteLength} bytes. Processing...`);

		// Use JSZip to hydrate FS.virtual
		const contents = githubSelf.JSZip ? await new githubSelf.JSZip().loadAsync(buffer) : undefined;

		/** @type {Promise<any>[]} */
		const unzipPromises = [];

		contents?.forEach((relativePath, file) =>
		{
			if(file.dir) return;

			unzipPromises.push(file.async('uint8array').then(async data =>
			{
				// Remove the top-level GitHub folder name (e.g., 'repo-master/')
				const cleanedPath = relativePath.substring(relativePath.indexOf('/') + 1);
				const fullPath = githubSelf.path.join(githubSelf.config.MOUNT_DIR, cleanedPath);

				githubSelf.FS.virtual[fullPath] = {
					timestamp: new Date(),
					mode: githubSelf.FS_FILE ?? (0o100000 | 0o666),
					contents: data,
					path: fullPath,
					sha: await getGitShaBrowser(data),
					parent: fullPath.substring(0, fullPath.lastIndexOf('/'))
				};

				githubSelf.putRecord?.(githubSelf.DB_STORE_NAME ?? '', githubSelf.FS.virtual[fullPath], database);
			}));
		});

		await Promise.all(unzipPromises);
		console.info("Repository successfully mounted to virtual FS.");

		return githubSelf.FS.virtual[zipPath].sha;
	} catch(err)
	{
		if(err instanceof Error)
		{
			console.error(`Failed to download repo: ${err.message}`);
		}
		throw err;
	}
}


/**
 * Downloads a GitHub repository file-by-file using the Git Tree API and raw content streams,
 * updating progress piece-wise across all files without needing JSZip or CORS-blocked zipball endpoints.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} [branch='master']
 * @param {string | null} [database=null]
 * @param {undefined | null | import('../bundle/github').ProgressFunction} [onProgress]
 * @returns {Promise<number>} Returns the total count of files downloaded and mounted.
 */
async function downloadRepoNew(owner, repo, branch = 'master', database = null, onProgress = null)
{
	if(!database)
	{
		database = `${owner}/${repo}`;
	}

	let token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: githubSelf.settingsManager?.get('github', 'githubToken');

	/** @type {HeadersInit} */
	const headers = {
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

		// 1. Get complete recursive tree structure
		const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
			headers
		});

		if(!treeResponse.ok)
		{
			throw new Error(`Failed to fetch git tree structure: HTTP ${treeResponse.status}`);
		}

		/** @type {({tree: import('../bundle/github-types').GitHubFileEntry[]})} */
		const treeData = await treeResponse.json();

		if(!treeData.tree || !Array.isArray(treeData.tree))
		{
			throw new Error('Invalid or empty Git tree object returned by API.');
		}

		// 2. Filter file blobs (type === 'blob') and calculate absolute size total upfront
		/** @type {import('../bundle/github-types').GitHubFileEntry[]} */
		const blobItems = treeData.tree.filter((item) => item.type === 'blob');

		let totalBytes = 0;
		blobItems.forEach(item =>
		{
			totalBytes += item.size || 0;
		});

		console.info(`[downloadRepoNew] Found ${blobItems.length} files (${totalBytes} total bytes). Downloading...`);

		let cumulativeLoadedBytes = 0;

		// Helper to report global progress state
		const reportProgress = (stage = 'Downloading') =>
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

		/**
		 *
		 * @param {import('../bundle/github-types').GitHubFileEntry} item
		 * @param {string} fullPath
		 * @param {number} expectedFileSize
		 */
		const fetchAndMount = async function (item, fullPath, expectedFileSize)
		{
			// Use raw.githubusercontent.com for public files (completely bypasses API rate limits & CORS)
			// Fall back to API raw media type if token is present for private repositories
			const rawUrl = token
				? `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`
				: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`;

			/** @type {HeadersInit} */
			const fileHeaders = token
				? { ...headers, 'Accept': 'application/vnd.github.v3.raw' }
				: {};

			const fileResponse = await fetch(rawUrl, { headers: fileHeaders });

			if(!fileResponse.ok)
			{
				console.warn(`[downloadRepoNew] Could not fetch file ${item.path} (HTTP ${fileResponse.status}). Skipping...`);
				cumulativeLoadedBytes += expectedFileSize;
				reportProgress('Downloading');
				return;
			}

			if(!fileResponse.body)
			{
				throw new Error(`ReadableStream not available for file stream: ${item.path}`);
			}

			const reader = fileResponse.body.getReader();
			/** @type {Uint8Array[]} */
			const chunks = [];
			let fileDownloadedBytes = 0;

			// Stream reading chunks piece-wise
			while(true)
			{
				const { done, value } = await reader.read();

				if(done)
				{
					break;
				}

				chunks.push(value);
				fileDownloadedBytes += value.length;
				cumulativeLoadedBytes += value.length;

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

			// Mount directly into virtual file system & IndexedDB
			githubSelf.FS.virtual[fullPath] = {
				timestamp: new Date(),
				mode: githubSelf.FS_FILE ?? (0o100000 | 0o666),
				contents: fileBuffer,
				path: fullPath,
				sha: item.sha || (await getGitShaBrowser(fileBuffer)),
				parent: fullPath.substring(0, fullPath.lastIndexOf('/'))
			};

			githubSelf.putRecord?.(githubSelf.DB_STORE_NAME ?? '', githubSelf.FS.virtual[fullPath], database);
		};

		const CONCURRENCY_LIMIT = 8;
		for(let i = 0; i < blobItems.length; i += CONCURRENCY_LIMIT)
		{
			const chunk = blobItems.slice(i, i + CONCURRENCY_LIMIT);
			await Promise.all(chunk.map(item =>
			{
				const fullPath = githubSelf.path.join(githubSelf.config.MOUNT_DIR, item.path);
				const expectedFileSize = item.size || 0;
				return fetchAndMount(item, fullPath, expectedFileSize);
			}));
		}

		reportProgress('Complete');
		console.info(`[downloadRepoNew] Successfully mounted ${blobItems.length} files to virtual FS.`);

		return blobItems.length;

	} catch(err)
	{
		if(err instanceof Error)
		{
			console.error(`[downloadRepoNew] Failed downloading repo structure: ${err.message}`);
		}
		throw err;
	}
}


githubSelf.downloadRepoNew = downloadRepoNew;


/**
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<import('../bundle/github-types').GitHubRelease[] | undefined>}
 */
async function listReleases(owner, repo)
{
	try
	{
		/** @type {import('../bundle/github-types').GitHubRelease[]} */
		const releases = await githubRequest(owner, repo, 'releases');

		releases.forEach(release =>
		{
			console.info(`Release: ${release.name} (${release.tag_name})`);

			// If you want the assets (like your compiled zip)
			release.assets.forEach(asset =>
			{
				console.info(` - Asset: ${asset.name} | URL: ${asset.browser_download_url}`);
			});
		});

		return releases;
	} catch(err)
	{
		console.error("Failed to list releases: " + err);
	}
}

async function getAuthenticatedUser()
{
	const token = githubSelf.settingsManager?.get('github', 'githubToken');
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

		// You can now use userData.avatar_url, userData.name, etc.
		return userData;
	} catch(err)
	{
		console.error("Failed to fetch user data: " + err);
	}
}

githubSelf.getAuthenticatedUser = getAuthenticatedUser;


/**
 *
 * @param {string} query
 * @param {string} ownerName
 * @param {string} repoName
 * @returns
 */
async function searchGitHubRepositories(query, ownerName, repoName)
{
	let queryString = query;

	// Append qualifiers cleanly inside the q parameter value
	if(ownerName && repoName)
	{
		queryString += ` repo:${ownerName}/${repoName}`;
	} else if(ownerName)
	{
		queryString += ` user:${ownerName}`;
	}

	// Now safely encode the entire combined query string
	const fullUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(queryString)}`;

	let token = typeof githubSelf.api !== 'undefined'
		? githubSelf.api.github_token
		: localStorage.getItem('github_token');

	/** @type {HeadersInit} */
	const headers = {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};

	if(token)
	{
		headers['Authorization'] = `Bearer  ${token}`;
	}

	const response = await fetch(fullUrl, {
		//mode: 'cors',
		//credentials: 'omit',
		headers
	});
	if(!response.ok) throw new Error(`Search failed: ${response.status}`);

	const data = await response.json();
	return data.items; // Array of matched repository objects containing names, owners, and shas
}


/**
 * Dispatches the safe GitHub global query pass
 * @param {string} query
 * @param {string[]} activeRepositories
 * @param {string} token
 * @returns
 */
async function searchGitHubCode(query, activeRepositories, token)
{
	// If no scopes are ready, drop out
	if(activeRepositories.length === 0) return [];

	// Use the first active repository context to scope the code query space safely
	const primaryRepo = activeRepositories[0];
	const queryString = `${query} repo:${primaryRepo}`;
	const fullUrl = `https://api.github.com/search/code?q=${encodeURIComponent(queryString)}`;

	/** @type {HeadersInit} */
	const headers = {
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
			//mode: 'cors',
			//credentials: 'omit',
			headers
		});
		if(!response.ok) return [];

		/** @type {({items: import('../bundle/github-types').GitHubFileEntry[]})} */
		const data = await response.json();

		return (data.items || []).map(item => ({
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



(function (root)
{

	const exportsObject = {
		defaultBranches,
		mapFiles,
		githubRequest,
		getDefaultBranch,
		getBranchVersion,
		getBranches,
		githubGraphQL,
		loadGitHubTree,
		loadGitHubTreeNew,
		hydrateFileMTimes,
		getGitShaBrowser,
		cacheFile,
		cacheFileInternal,
		downloadRepoZip,
		listReleases,
		getAuthenticatedUser,
		searchGitHubRepositories,
		searchGitHubCode
	};

	// 1. CommonJS Node environment
	if(typeof module !== 'undefined' && module.exports)
	{
		module.exports = exportsObject;
	}
	// 2. Bare exports environment
	else if(typeof exports !== 'undefined')
	{
		Object.assign(exports, exportsObject);
	}
	// 3. Web Worker context (Classic or Module)
	else if(typeof self !== 'undefined' && typeof githubSelf.importScripts === 'function')
	{
		Object.assign(self || root || {}, exportsObject);
	}
	// 4. Standard Browser UI Thread fallback
	else
	{
		Object.assign(root || {}, exportsObject);
	}
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);

