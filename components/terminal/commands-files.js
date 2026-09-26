
// @ts-check


/** @type {import('./widget.d').TerminalCommandFileWindow} */
const commandFileSelf = /** @type {any} */ (self);


/**
 *
 * @param {number} bytes
 * @returns
 */
const formatBytes = (bytes) =>
{
	if(bytes === 0) return '0B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

/**
 *
 * @param {string[]} argv
 * @param {string} database
 */
async function ls(argv, database)
{
	let selected = commandFileSelf.toolsRepository || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : commandFileSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || commandFileSelf.RepositoryToolbar?.repository?.value;

	if(!commandFileSelf.filesRepo?.[selected]
		&& ownerName && repoName
	)
	{
		let branch = await commandFileSelf.getDefaultBranch?.(ownerName, repoName);
		if(branch)
		{
			await commandFileSelf.loadGitHubTree?.(ownerName, repoName, branch);
		}
	}

	const flags = {
		recursive: argv.includes('-R'),
		human: argv.includes('-h'),
		flat: argv.includes('-1')
	};

	// Assuming FS.virtual.readdir returns objects with {name, size, type}
	const entries = Object.values(commandFileSelf.FS.virtual)
		.concat(Object.values(commandFileSelf.filesRepo?.[selected] || {}) || [])
		.filter(p =>
		{
			if(!p)
			{
				return false;
			}
			if(!p.path)
			{
				debugger;
			}
			let compare = commandFileSelf.CWD ?? '';
			let startMatch = false;
			let subMatch = false;
			if(compare.trim().length == 0)
				compare = '/';
			if(!compare.endsWith('/'))
				compare += '/';

			let path = p.path;
			if(!path.startsWith('/'))
				path = '/' + path;
			if(path.startsWith(compare))
				startMatch = true;
			if(flags.recursive || path.substring(compare.length).indexOf('/') === -1)
				subMatch = true;
			return startMatch && (flags.recursive || subMatch);
		});


	if(flags.flat)
	{
		entries.forEach(e =>
		{
			if(!e) return;
			commandFileSelf.terminalWrite?.(e.path + '\n\r');
		});
	} else
	{
		// Calculate column width for alignment
		const maxName = Math.max(...entries.map(e =>
		{
			if(!e) return 0;
			return e.path.length;
		}), 10);

		commandFileSelf.terminalWrite?.(`${'NAME'.padEnd(maxName + 2)}${'SIZE'.padEnd(10)}TYPE\n\r`);
		commandFileSelf.terminalWrite?.('-'.repeat(maxName + 20) + '\n\r');

		for(let e of entries)
		{
			if(!e) return;
			const contentLength = e.contents ? await commandFileSelf.FileManager?.getContentLength(e.contents) : void 0;
			const size = e.contents && contentLength ? flags.human ? formatBytes(contentLength) : contentLength.toString() : '0B';
			const nameStr = e.path.padEnd(maxName + 2);
			const sizeStr = size.padEnd(10);
			const color = e.mode === commandFileSelf.FS_DIR ? '\x1b[1;34m' : '\x1b[0m'; // Blue for dirs

			commandFileSelf.terminalWrite?.(`${color}${nameStr}\x1b[0m${sizeStr}${e.mode}\n\r`);
		};
	}
}


commandFileSelf.ls = ls;


/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @returns
 */
async function remove(argv, database)
{
	if(!argv.length || !argv[0])
	{
		commandFileSelf.terminalWrite?.(`\x1b[1;38;5;196mError:\x1b[0m Target filename or glob pattern required.\n\r`);
		return;
	}

	const caseSensitiveActive = argv.includes('-c');
	const filteredArgs = argv.filter(arg => arg !== '-c');
	const filename = filteredArgs[0];
	const cleanQuery = filteredArgs.join(' ').trim();

	if(!cleanQuery || cleanQuery.length < 2)
	{
		commandFileSelf.terminalWrite?.(`\x1b[1;38;5;196mError:\x1b[0m Search target must span at least 2 characters.\n\r`);
		return;
	}

	// Resolve target databases
	const metas = await commandFileSelf.getDatabaseMetadata?.() || [];
	const targetDatabases = [database, ...metas.map((m) => m.key)].filter(Boolean);

	commandFileSelf.terminalWrite?.(`\x1b[38;5;242m[Worker Thread] Locating candidate files for removal matching: "${cleanQuery}"...\x1b[0m\n\r`);

	let timerId = null;

	// Dispatch query through shared service
	const { callbackId, promise } = commandFileSelf.searchService?.search(
		{
			query: cleanQuery,
			caseSensitive: caseSensitiveActive,
			activeRepositories: targetDatabases
		},
		undefined,
		'cli-remove'
	) ?? { callbackId: '', promise: Promise.resolve([]) };

	// Watchdog safety timeout
	const watchdogPromise = new Promise((resolve) =>
	{
		timerId = setTimeout(() =>
		{
			commandFileSelf.searchService?.cancelSearch(callbackId);
			resolve([]);
		}, 8000);
	});

	/** @type {import('../bundle/lumino-search').GroupedSearchResult[]} */
	const groupedMatches = await Promise.race([promise, watchdogPromise]);

	if(timerId) clearTimeout(timerId);

	const rx = commandFileSelf.globToRegex?.(filename);

	// 1. Purge matching records across repositories
	await Promise.all(
		groupedMatches.map(async (group) =>
		{
			if(rx?.test(group.path))
			{
				commandFileSelf.terminalWrite?.(`Removing ${group.path} on ${group.repo}\n\r`);
				await commandFileSelf.deleteRecord?.(commandFileSelf.DB_STORE_NAME ?? '', group.path, group.repo);
			}
		})
	);

	// 2. Clear matching in-memory entries from FS.virtual
	const virtualFS = commandFileSelf.FS?.virtual;
	if(virtualFS)
	{
		for(const path of Object.keys(virtualFS))
		{
			if(rx?.test(path))
			{
				delete virtualFS[path];
				commandFileSelf.terminalWrite?.(`Removing ${path} from memory\n\r`);
			}
		}
	}

	// 3. Notify remote storage backend
	try
	{
		await commandFileSelf.api?.remove?.(filename);
	} catch(e)
	{
		// Silently swallow backend removal errors if unhandled
	}

	commandFileSelf.terminalWrite?.(`\x1b[38;5;118mRemove operation finished.\x1b[0m\n\r`);
}


/**
 *
 * @param {string[]} argv
 * @param {string} database
 */
function openCommand(argv, database)
{
	let selected = commandFileSelf.toolsRepository || argv[1] || database;
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : commandFileSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || commandFileSelf.RepositoryToolbar?.repository?.value;
	let fileName = argv[0];
	if(!fileName)
	{
		return;
	}
	// TODO: I did this backwards, i should have had the terminal click execute the command, and put it in history
	if(ownerName && repoName)
	{
		commandFileSelf.FileManager?.openFile(ownerName, repoName, fileName);
	}
}

/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @returns
 */
function edit(argv, database)
{
	return openCommand(argv, database);
}



/**
 * Asynchronous terminal worker searching interface gateway.
 * Stream-renders results as they arrive while keeping the promise alive until complete.
 * @param {string[]} argv
 */
async function find(argv)
{
	const caseSensitiveActive = argv.includes('-c');
	const filteredArgs = argv.filter(arg => arg !== '-c');
	const cleanQuery = filteredArgs.join(' ').trim();

	if(!cleanQuery || cleanQuery.length < 2)
	{
		commandFileSelf.terminalWrite?.(`\x1b[1;38;5;196mError:\x1b[0m Search query parameter context must span at least 2 characters.\n\r`);
		return;
	}

	commandFileSelf.terminalWrite?.(`\x1b[38;5;242m[Worker Thread] Querying repositories for matching traces: "${cleanQuery}"...\x1b[0m\n\r`);

	let knownPathsCount = 0;
	let timerId = null;

	/**
	 *
	 * @param {import('../bundle/lumino-search').GroupedSearchResult[]} groupedMatches
	 * @returns
	 */
	const renderIncrementalResults = (groupedMatches) =>
	{
		if(groupedMatches.length === 0 || groupedMatches.length <= knownPathsCount)
		{
			return;
		}

		const newGroups = groupedMatches.slice(knownPathsCount);
		knownPathsCount = groupedMatches.length;

		newGroups.forEach(group =>
		{
			commandFileSelf.terminalWrite?.(`\x1b[1;38;5;45m📁 repo: [${group.repo}] -> ${group.path}\x1b[0m\n\r`);

			if(group.localMatches.length > 0)
			{
				group.localMatches.forEach(match =>
				{
					const lineLabel = `   Line ${match.line}: `.padEnd(14);
					commandFileSelf.terminalWrite?.(`\x1b[38;5;246m${lineLabel}\x1b[0m \x1b[38;5;253m${match.matchText}\x1b[0m\n\r`);
				});
			} else
			{
				commandFileSelf.terminalWrite?.(`   \x1b[38;5;242m=> structural path pattern footprint match verified\x1b[0m\n\r`);
			}

			commandFileSelf.terminalWrite?.(`\x1b[38;5;236m${'-'.repeat(80)}\x1b[0m\n\r`);
		});
	};

	const { callbackId, promise } = commandFileSelf.searchService?.search(
		{
			query: cleanQuery,
			caseSensitive: caseSensitiveActive
		},
		(partialResults) =>
		{
			renderIncrementalResults(partialResults);
		},
		'cli-find'
	) ?? { callbackId: '', promise: Promise.resolve([]) };

	const watchdogPromise = new Promise((resolve) =>
	{
		timerId = setTimeout(() =>
		{
			commandFileSelf.searchService?.cancelSearch(callbackId);
			resolve([]);
		}, 8000);
	});

	commandFileSelf.terminalWrite?.(`\n\r\x1b[1;38;5;118m=== WORKSPACE SEARCH RESULTS STREAM ===\x1b[0m\n\r`);

	const finalResults = await Promise.race([promise, watchdogPromise]);

	if(timerId) clearTimeout(timerId);

	if(knownPathsCount === 0)
	{
		commandFileSelf.terminalWrite?.(`\n\r\x1b[1;38;5;208m[!] 0 results returned matching parameter targets.\x1b[0m\n\r`);
	} else
	{
		commandFileSelf.terminalWrite?.(`\n\rSearch operations completed successfully (${knownPathsCount} total files matched).\n\r`);
	}
}
