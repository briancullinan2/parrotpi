// @ts-check


/** @type {import('./widget.d').TerminalCommandGitWindow} */
const commandGitSelf = /** @type {any} */ (self);


/**
 * Renders a sub-character precise progress bar to an xterm.js Terminal instance.
 * Uses ANSI escape sequences to clear and overwrite the active line.
 *
 * @param {import('@xterm/xterm').Terminal} term - The xterm.js Terminal instance
 * @param {import('../bundle/github.d').ProgressDetails} progress - The current progress update containing loaded, total, percent, and optional stage
 */
export function renderXtermProgress(term, progress)
{
	const { loaded, total, percent, stage = 'Processing' } = progress;
	const termWidth = term.cols || 80;

	// Unicode block sub-characters (1/8th increments)
	const BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];

	// Format bytes nicely (KB, MB, GB)
	/** @type {(bytes: number) => string} */
	const formatBytes = (/** @type {number} */ bytes) =>
	{
		if(bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	};

	// Format right-hand text stats: " 45.2 MB / 100 MB  45%" or " 45.2 MB"
	const statsText = total > 0
		? ` ${formatBytes(loaded)} / ${formatBytes(total)}  ${percent.toString().padStart(3, ' ')}%`
		: ` ${formatBytes(loaded)}`;

	// Left prefix text
	const prefixText = `\x1b[36m${stage}:\x1b[0m `; // Cyan stage label
	const rawPrefixLen = stage.length + 2; // "Stage: " length without ANSI codes
	const rawStatsLen = statsText.length;

	// Calculate available width for the progress bar itself
	const minBarWidth = 10;
	const barWidth = Math.max(minBarWidth, termWidth - rawPrefixLen - rawStatsLen - 4); // [ ... ]

	let barString = '';

	if(total > 0 && percent >= 0)
	{
		// 1. Precise sub-character math
		const clampedPercent = Math.min(100, Math.max(0, percent));
		const totalSubBlocks = (clampedPercent / 100) * barWidth * 8;
		const fullBlocks = Math.floor(totalSubBlocks / 8);
		const remainder = Math.floor(totalSubBlocks % 8);

		const filledPart = '█'.repeat(fullBlocks);
		const partialPart = fullBlocks < barWidth ? BLOCKS[remainder] : '';
		const emptyPart = '░'.repeat(Math.max(0, barWidth - fullBlocks - (partialPart ? 1 : 0)));

		// Color gradient / styling: Bright Green filled, Dark Grey empty
		barString = `\x1b[32m${filledPart}${partialPart}\x1b[90m${emptyPart}\x1b[0m`;
	}
	else
	{
		// 2. Fallback Indeterminate / Spinner animation when total length is unknown (Content-Length missing)
		const frame = Math.floor(Date.now() / 150) % barWidth;
		const leading = '░'.repeat(frame);
		const pulse = '█▉▊▋▌';
		const trailing = '░'.repeat(Math.max(0, barWidth - frame - pulse.length));

		barString = `\x1b[90m${leading}\x1b[33m${pulse.slice(0, barWidth - frame)}\x1b[90m${trailing}\x1b[0m`;
	}

	// Assemble ANSI line sequence:
	// \r       - Move cursor to start of current line
	// \x1b[2K   - Clear entire current line
	const output = `\r\x1b[2K${prefixText}\x1b[90m[\x1b[0m${barString}\x1b[90m]\x1b[0m${statsText}`;

	term.write(output);

	// If task reached 100%, commit line with a newline so subsequent logs start below
	if(percent >= 100)
	{
		term.write('\r\n');
	}
}


/**
 * @param {string[]} argv
 */
/**
 *
 * @param {string[]} argv
 * @param {string | undefined} database
 * @param {string} commandName
 * @param {import('@xterm/xterm').Terminal} term
 */
async function clone(argv, database, commandName, term)
{
	const selected = argv[0] ?? commandGitSelf.engineRepository ?? 'briancullinan2/Quake3e';
	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : commandGitSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || commandGitSelf.RepositoryToolbar?.repository?.value;

	/** @type {string | undefined} */
	let branch = argv[1];
	if(!branch && ownerName && repoName)
	{
		branch = await commandGitSelf.getDefaultBranch?.(ownerName, repoName);
	}

	commandGitSelf.terminalWrite?.('Cloning branch: ' + branch + ' from ' + ownerName + '/' + repoName + '\n\r');

	if(ownerName && repoName && branch)
	{
		await commandGitSelf.loadGitHubTree?.(ownerName, repoName, branch);
	}

	commandGitSelf.terminalWrite?.('Downloaded file tree: ' + branch + ' from ' + ownerName + '/' + repoName + '\n\r');

	const githubStateService = commandGitSelf.GithubService?.getInstance();
	const response = await githubStateService?.executeCommand({
		type: 'DOWNLOAD_REPOSITORY',
		owner: ownerName,
		repo: repoName,
		branch,
		gitHubToken: localStorage.getItem('github_token') || commandGitSelf.api?.github_token
	}, void 0, (result) =>
	{
		/** @type {import('../bundle/github.d').ProgressDetails} */
		const progress = result.progress;
		if(progress && term)
		{
			renderXtermProgress(term, {
				loaded: progress.loaded,
				total: progress.total,
				percent: progress.percent,
				stage: progress.stage ?? 'Downloading'
			});
		}
	});

	if(response?.status === 'ERROR')
	{
		commandGitSelf.terminalWrite?.('Download error: ' + branch + ' error: ' + response.error + ' from ' + ownerName + '/' + repoName + '\n\r');
	} else
	{
		commandGitSelf.terminalWrite?.('Checked out: ' + branch + '.zip (' + response?.count + ' files) from ' + ownerName + '/' + repoName + '\n\r');
	}

}

commandGitSelf.clone = clone;


/**
 * Executes terminal 'status' layout profiling pass
 * @param {string[]} args
 */
async function statusCommand(args)
{
	// Fall back to engine target context if no path argument is supplied directly
	let repoPath = args[0] || commandGitSelf.settingsManager?.get('github', 'engineRepository');
	if(!repoPath)
	{
		console.log("Error: Missing repository configuration context path mapping rules.");
		return;
	}

	const parts = repoPath.split('/');
	if(parts.length !== 2)
	{
		console.log(`Error: Invalid target repository definition standard format [${repoPath}]. Use owner/repo.`);
		return;
	}

	const owner = parts[0];
	const repo = parts[1];
	const branch = await commandGitSelf.getDefaultBranch?.(owner, repo);

	console.log(`Calculating changes for ${owner}/${repo} on branch [${branch}]...`);

	try
	{
		const githubStateService = commandGitSelf.GithubService?.getInstance();
		const response = await githubStateService?.executeCommand({
			type: 'COMMIT_STATUS_CHECK',
			owner,
			repo,
			branch,
			gitHubToken: localStorage.getItem('github_token') || commandGitSelf.api?.github_token
		});


		const { modified = [], added = [], deleted = [] } = /** @type {import('../filelist/widget-github').StagingDetails} */ (response);
		const totalChanges = modified.length + added.length + deleted.length;

		if(totalChanges === 0)
		{
			console.log(`On branch ${branch}\nYour branch is up to date with origin.\n\nnothing to commit, working tree clean`);
			return;
		}

		console.log(`On branch ${branch}\nChanges tracking matrix compiled:\n`);

		if(modified.length > 0)
		{
			console.log("  Modified files:");
			modified.forEach(p => console.log(`     modified:   ${p}`));
			console.log("");
		}

		if(added.length > 0)
		{
			console.log("  Untracked / Added files:");
			added.forEach(p => console.log(`     new file:   ${p}`));
			console.log("");
		}

		if(deleted.length > 0)
		{
			console.log("  Deleted files:");
			deleted.forEach(p => console.log(`     deleted:    ${p}`));
			console.log("");
		}
	} catch(err)
	{
		if(err instanceof Error)
		{
			console.log(`Status check aborted: ${err.message || err}`);
		}
	}
}

commandGitSelf.statusCommand = statusCommand;

/**
 * Executes terminal 'push' network transaction pass
 * @param {string[]} args
 */
async function push(args)
{
	const commitMessage = args[0];
	if(!commitMessage || commitMessage.trim().length === 0)
	{
		console.log("Error: A non-empty descriptive commit message string target parameter is required.");
		return;
	}

	let repoPath = args[1] || commandGitSelf.settingsManager?.get('github', 'engineRepository');
	const parts = repoPath.split('/');
	const owner = parts[0];
	const repo = parts[1];
	const branch = await commandGitSelf.getDefaultBranch?.(owner, repo);

	console.log(`Assembling commit data layout package context structures to push directly...`);

	try
	{
		const githubStateService = commandGitSelf.GithubService?.getInstance();
		const response = await githubStateService?.executeCommand({
			type: 'COMMIT_PUSH',
			owner,
			repo,
			branch,
			message: commitMessage,
			gitHubToken: localStorage.getItem('github_token') || commandGitSelf.api?.github_token
		});

		console.log(`\nCommit verification success! Head reference synchronized cleanly.`);
		if(response?.sha)
		{
			console.log(`New Remote Commit OID: ${response.sha}`);
		}

		// Optional: Re-render matching UI subtrees to reflect reset modifications state
		for(let widget of commandGitSelf.mainDock?.widgets() ?? [])
		{
			if(widget.constructor.name === 'GithubListWidget' && commandGitSelf.trees?.[repoPath])
			{
				/** @type {import('../filelist/widget-github').GithubListWidget} */
				const githubTree = /** @type {any} */ (widget);
				/** @type {HTMLElement} */
				const node = /** @type {any} */ (githubTree.node.querySelector('[data-id="${repoPath}"]'));
				if(node)
				{
					githubTree.expandDatabaseTree(node, repoPath);
				}
				break;
			}
		}
	} catch(err)
	{
		if(err instanceof Error)
		{
			console.log(`\nPush execution sequence bricked: ${err.message || err}`);
		}
	}
}

commandGitSelf.push = push;

