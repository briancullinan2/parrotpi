
// @ts-check


/** @type {import('./widget.d').TerminalCommandBuildWindow} */
const commandBuildSelf = /** @type {any} */ (self);

/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @returns
 */
async function buildCommand(argv, database)
{
	const mode = argv[0] || 'release';

	/** @type {string | undefined | null} */
	let selected = argv[1] || commandBuildSelf.engineRepository || database;
	if(commandBuildSelf.api)
	{
		commandBuildSelf.api.database = selected;
	}
	if(mode === 'q3lcc'
		|| mode === 'q3rcc'
		|| mode === 'q3cpp'
		|| mode === 'lburg'
		|| mode === 'tools'
	)
		selected = argv[1] || commandBuildSelf.toolsRepository;
	if(mode === 'q3asm')
		selected = argv[1] || commandBuildSelf.tools2Repository;
	if(mode === 'all'
		|| mode === 'release'
		|| mode === 'debug'
		|| mode === 'stringify'
		|| mode === 'shaders'
		|| mode === 'client'
		|| mode === 'engine'
		|| mode === 'server'
	)
		selected = argv[1] || commandBuildSelf.engineRepository;

	if(mode === 'cgame'
		|| mode === 'game'
		|| mode === 'ui'
		|| mode === 'q3_ui'
		|| mode === 'qvms'
	)
		selected = argv[1] || commandBuildSelf.gameRepository;

	const parts = selected?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : commandBuildSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || commandBuildSelf.RepositoryToolbar?.repository?.value;
	if(selected && !commandBuildSelf.filesRepo?.[selected] && ownerName && repoName)
	{
		let branch = await commandBuildSelf.getDefaultBranch?.(ownerName, repoName);
		if(branch)
		{
			await commandBuildSelf.loadGitHubTree?.(ownerName, repoName, branch);
		}
	}


	if(commandBuildSelf.TERMINATE) return;

	let validMode = commandBuildSelf.SettingsToolbar?.configuration?.value;

	if(mode === 'q3lcc'
		|| mode === 'q3rcc'
		|| mode === 'q3cpp'
		|| mode === 'lburg'
		|| mode === 'q3asm'
		|| mode === 'tools'
	)
		validMode = 'tools';

	else if(mode === 'cgame'
		|| mode === 'game'
		|| mode === 'ui'
		|| mode === 'q3_ui'
		|| mode === 'qvms'
	)
		validMode = 'qvms';
	else if(mode === 'all'
		|| mode === 'release'
		|| mode === 'debug'
		|| mode === 'stringify'
		|| mode === 'shaders'
		|| mode === 'client'
		|| mode === 'engine'
		|| mode === 'server'
	)
		validMode = 'release';


	if(commandBuildSelf.SettingsToolbar?.configuration?.querySelector(`[value="${validMode}"]`))
	{
		if(commandBuildSelf.SettingsToolbar && commandBuildSelf.SettingsToolbar.configuration && validMode)
		{
			commandBuildSelf.SettingsToolbar.configuration.value = validMode;
		}
		if(commandBuildSelf.api)
		{
			commandBuildSelf.api.configuration = commandBuildSelf.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
		}
	}
	else if(mode)
	{
		let modes = Array.from(commandBuildSelf.SettingsToolbar?.configuration?.children || []).map(m =>
		{
			if(m instanceof HTMLOptionElement)
			{
				return m.value;
			}
		});
		commandBuildSelf.terminalWrite?.(`Valid modes ${modes.join('|')}: ${mode} given.\n\r`);
		return;
	}


	commandBuildSelf.terminalWrite?.(`Starting ${mode} build...\n\r`);

	if(selected === commandBuildSelf.engineRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.q3eCommonHeaders, 10, mode === 'all' ? commandBuildSelf.engineRepository : selected);
	}

	commandBuildSelf.needsHeaders = false;


	if(commandBuildSelf.TERMINATE) return;

	if(mode === 'stringify' || mode === 'all')
		await commandBuildSelf.buildStringify?.(mode === 'all' ? commandBuildSelf.engineRepository : selected, false, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'shaders')
		await commandBuildSelf.buildShaders?.(selected ?? commandBuildSelf.engineRepository, false);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'client' || mode === 'engine'
		|| mode === 'release' || mode === 'debug'
		|| mode === 'all'
	)
		await commandBuildSelf.buildClient?.(mode === 'all' ? commandBuildSelf.engineRepository : selected, mode === 'client' || mode === 'engine', false, true); // also builds shaders

	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.toolsRepository)
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.lccToolHeaders, 10, mode === 'all' ? commandBuildSelf.toolsRepository : selected);
	}

	if(commandBuildSelf.TERMINATE) return;

	if(mode === 'lburg' || mode === 'all' || mode === 'tools')
		await commandBuildSelf.buildTools?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, 'lburg', mode === 'lburg', true); // shared debouncer

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3rcc' || mode === 'all' || mode === 'tools')
		await commandBuildSelf.buildTools?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, 'q3rcc', mode === 'q3rcc', true); // implicit forceChanged = true

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3cpp' || mode === 'all' || mode === 'tools')
		await commandBuildSelf.buildTools?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, 'q3cpp', mode === 'q3cpp', true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3lcc' || mode === 'all' || mode === 'tools')
		await commandBuildSelf.buildTools?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, 'q3lcc', mode === 'q3lcc', true);

	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.tools2Repository)
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.asmToolHeaders, 10, mode === 'all' || mode === 'tools' ? commandBuildSelf.tools2Repository : selected);
	}

	if(mode === 'q3asm' || mode === 'all' || mode === 'tools')
		await commandBuildSelf.buildTools?.(mode === 'q3asm' || mode === 'tools' ? selected : commandBuildSelf.tools2Repository, 'q3asm', mode === 'q3asm', true);




	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.gameRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.qvmHeaders, 10, mode === 'all' ? commandBuildSelf.gameRepository : selected);
	}

	if(commandBuildSelf.TERMINATE) return;

	if(mode === 'game' || mode === 'all' || mode === 'qvms')
		await commandBuildSelf.buildModule?.('game', commandBuildSelf.dirs.QADIR, commandBuildSelf.gameFiles ?? [], mode === 'all' ? commandBuildSelf.gameRepository : selected, ['QAGAME'], mode === 'game', false, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'cgame' || mode === 'all' || mode === 'qvms')
		await commandBuildSelf.buildModule?.('cgame', commandBuildSelf.dirs.CGDIR, commandBuildSelf.cgameFiles ?? [], mode === 'all' ? commandBuildSelf.gameRepository : selected, ['CGAME'], mode === 'cgame', false, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'ui' || mode === 'all' || mode === 'qvms')
		await commandBuildSelf.buildModule?.('ui', commandBuildSelf.dirs.UIDIR, commandBuildSelf.uiFiles ?? [], mode === 'all' ? commandBuildSelf.gameRepository : selected, ['UI'], mode === 'ui', false, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3_ui' || mode === 'all' || mode === 'qvms')
		await commandBuildSelf.buildModule?.('q3_ui', commandBuildSelf.dirs.Q3UIDIR, commandBuildSelf.q3uiFiles ?? [], mode === 'all' ? commandBuildSelf.gameRepository : selected, ['UI'], mode === 'q3_ui', false, true);


}


/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @returns
 */
async function link(argv, database)
{
	const mode = argv[0] || 'engine';

	/** @type {string | undefined | null} */
	let selected = argv[1] || commandBuildSelf.engineRepository || database;
	if(commandBuildSelf.api)
	{
		commandBuildSelf.api.database = selected;
	}
	if(mode === 'q3lcc'
		|| mode === 'q3rcc'
		|| mode === 'q3cpp'
		|| mode === 'lburg'
		|| mode === 'tools'
	)
		selected = argv[1] || commandBuildSelf.toolsRepository;
	if(mode === 'q3asm')
		selected = argv[1] || commandBuildSelf.tools2Repository;
	if(mode === 'all'
		|| mode === 'release'
		|| mode === 'debug'
		|| mode === 'stringify'
		|| mode === 'shaders'
		|| mode === 'client'
		|| mode === 'engine'
		|| mode === 'server'
	)
		selected = argv[1] || commandBuildSelf.engineRepository;

	if(mode === 'cgame'
		|| mode === 'game'
		|| mode === 'ui'
		|| mode === 'q3_ui'
		|| mode === 'qvms'
	)
		selected = argv[1] || commandBuildSelf.gameRepository;


	const parts = selected?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : commandBuildSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || commandBuildSelf.RepositoryToolbar?.repository?.value;
	if(selected && !commandBuildSelf.filesRepo?.[selected] && ownerName && repoName)
	{
		let branch = await commandBuildSelf.getDefaultBranch?.(ownerName, repoName);
		if(branch)
		{
			await commandBuildSelf.loadGitHubTree?.(ownerName, repoName, branch);
		}
	}

	if(commandBuildSelf.TERMINATE) return;

	if(commandBuildSelf.api)
	{
		commandBuildSelf.api.configuration = commandBuildSelf.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
	}


	commandBuildSelf.terminalWrite?.(`Starting ${mode} linking...\n\r`);


	if(selected === commandBuildSelf.engineRepository
		&& commandBuildSelf.q3eCommonHeaders
	) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.q3eCommonHeaders, 10, mode === 'all' ? commandBuildSelf.engineRepository : selected);
	}

	if(commandBuildSelf.TERMINATE) return;


	if(mode === 'stringify' || mode === 'all')
		await commandBuildSelf.linkStringify?.(mode === 'all' ? commandBuildSelf.engineRepository : selected, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'client' || mode === 'engine'
		|| mode === 'shaders' || mode === 'release'
		|| mode === 'debug' || mode === 'all'
	)
		await commandBuildSelf.linkEngine?.(mode === 'all' ? commandBuildSelf.engineRepository : selected, true);

	if(commandBuildSelf.TERMINATE) return;


	if(selected === commandBuildSelf.toolsRepository)
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.lccToolHeaders, 10, mode === 'all' ? commandBuildSelf.toolsRepository : selected);
	}



	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'lburg' || mode === 'tools' || mode === 'all')
		await commandBuildSelf.linkLburg?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3rcc' || mode === 'tools' || mode === 'all')
		await commandBuildSelf.linkRCC?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3cpp' || mode === 'tools' || mode === 'all')
		await commandBuildSelf.linkCPP?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3lcc' || mode === 'tools' || mode === 'all')
		await commandBuildSelf.linkLCC?.(mode === 'all' ? commandBuildSelf.toolsRepository : selected, true);

	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.tools2Repository)
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.asmToolHeaders, 10, mode === 'all' || mode === 'tools' ? commandBuildSelf.tools2Repository : selected);
	}


	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3asm' || mode === 'tools' || mode === 'all')
		await commandBuildSelf.linkAsm?.(mode === 'all' || mode === 'tools' ? commandBuildSelf.tools2Repository : selected, true);

	if(commandBuildSelf.TERMINATE) return;
	if(selected === commandBuildSelf.gameRepository) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.qvmHeaders, 10, mode === 'all' ? commandBuildSelf.gameRepository : selected);
	}
	if(commandBuildSelf.TERMINATE) return;


	if(mode === 'game' || mode === 'qvms' || mode === 'all')
		await commandBuildSelf.linkModule?.(mode === 'all' ? commandBuildSelf.gameRepository : selected, 'game', commandBuildSelf.dirs.QADIR, commandBuildSelf.gameFiles, true, false, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'cgame' || mode === 'qvms' || mode === 'all')
		await commandBuildSelf.linkModule?.(mode === 'all' ? commandBuildSelf.gameRepository : selected, 'cgame', commandBuildSelf.dirs.CGDIR, commandBuildSelf.cgameFiles, true, false, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'ui' || mode === 'qvms' || mode === 'all')
		await commandBuildSelf.linkModule?.(mode === 'all' ? commandBuildSelf.gameRepository : selected, 'ui', commandBuildSelf.dirs.UIDIR, commandBuildSelf.uiFiles, true, false, true);

	if(commandBuildSelf.TERMINATE) return;
	if(mode === 'q3_ui' || mode === 'qvms' || mode === 'all')
		await commandBuildSelf.linkModule?.(mode === 'all' ? commandBuildSelf.gameRepository : selected, 'q3_ui', commandBuildSelf.dirs.Q3UIDIR, commandBuildSelf.q3uiFiles, true, false, true);

	if(commandBuildSelf.TERMINATE) return;

	// TODO: link dedicated server

}

/**
 *
 * @param {string[]} argv
 * @param {string | null} database
 */
async function header(argv, database)
{
	let selected = commandBuildSelf.toolsRepository || argv[1] || database;
	const parts = selected?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : commandBuildSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || commandBuildSelf.RepositoryToolbar?.repository?.value;
	if(!selected || !ownerName || !repoName) return;

	let headers = [argv[0]];

	if(!argv[0])
		headers = [...commandBuildSelf.lccToolHeaders ?? []];

	if(!commandBuildSelf.filesRepo?.[selected] && ownerName && repoName)
	{
		let branch = await commandBuildSelf.getDefaultBranch?.(ownerName, repoName);
		if(branch)
		{
			await commandBuildSelf.loadGitHubTree?.(ownerName, repoName, branch);
		}
	}

	for(let header of headers)
	{
		let sha = commandBuildSelf.filesRepo?.[selected]?.[header].sha;

		await commandBuildSelf.cacheFile?.(commandBuildSelf.DB_STORE_NAME ?? '', ownerName, repoName, header, sha);
		if(ownerName && repoName)
		{
			await commandBuildSelf.api?.header?.(ownerName, repoName, header, selected);
		}
	}
}


/**
 * @returns {{fileId: string, contents: string} | undefined}
 */
function currentSession()
{
	for(let widget of commandBuildSelf.mainDock?.widgets() ?? [])
	{
		if(widget.constructor.name === 'AceEditorWidget')
		{
			/** @type {import('../editor/widget').AceEditorWidget} */
			const editorWidget = /** @type {any} */ (widget);
			const editorFilename = editorWidget._editor?.getSession().workspaceFileId;
			if(editorFilename?.endsWith('.c') || editorFilename?.endsWith('.h'))
			{
				return { fileId: editorFilename, contents: editorWidget._editor?.getValue() ?? '' };
			}
		}
	}
}



/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @param {string} commandName
 * @param {import('@xterm/xterm').Terminal} term
 * @returns
 */
async function compileWorker(argv, database, commandName, term)
{
	const session = !argv[0] ? currentSession() : void 0;
	const file = argv[0] ?? session?.fileId;
	if(!file) return;

	/** @type {string | undefined | null} */
	let selected = argv[1] || commandBuildSelf.engineRepository || database;
	if(!selected) return;

	if(file.includes('src')
		|| file.includes('cpp')
		|| file.includes('etc')
		|| file.includes('lburg')
	)
	{
		selected = commandBuildSelf.toolsRepository;
	}

	if((commandBuildSelf.q3asmFiles ?? []).indexOf(file) > -1)
	{
		selected = commandBuildSelf.tools2Repository;
	}


	if(file.includes('code/client')
		|| file.includes('code/server')
		|| file.includes('code/qcommon')
		|| file.includes('code/renderer2')
		|| file.includes('code/botlib')
		|| file.includes('code/wasm')
		|| file.includes('code/renderercommon')
	)
	{
		selected = commandBuildSelf.engineRepository;
	}

	if(file.includes('code/cgame')
		|| file.includes('code/game')
		|| file.includes('code/q3_ui')
		|| file.includes('code/ui')
	)
	{
		selected = commandBuildSelf.gameRepository;
	}


	const parts = selected?.split('/');
	const ownerName = parts?.length == 2 ? parts[0] : commandBuildSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts?.length == 2 ? parts[1] : parts?.[0] || commandBuildSelf.RepositoryToolbar?.repository?.value;
	if(!ownerName || !repoName) return;

	if(selected && !commandBuildSelf.filesRepo?.[selected] && ownerName && repoName)
	{
		let branch = await commandBuildSelf.getDefaultBranch?.(ownerName, repoName);
		if(branch)
		{
			await commandBuildSelf.loadGitHubTree?.(ownerName, repoName, branch);
		}
	}

	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.engineRepository
		|| file.includes('code/client')
		|| file.includes('code/server')
		|| file.includes('code/qcommon')
		|| file.includes('code/renderer2')
		|| file.includes('code/botlib')
		|| file.includes('code/wasm')
		|| file.includes('code/renderercommon')) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.q3eCommonHeaders, 10, selected);
	}

	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.gameRepository || file.includes('code/game')
		|| file.includes('code/cgame') || file.includes('code/ui')
		|| file.includes('code/q3_ui')) // TODO: || file.includes('code/') && !file.includes('code/'))
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.qvmHeaders, 10, selected);
	}

	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.toolsRepository || file.includes('src/')
		|| file.includes('cpp/') || file.includes('etc/')
		|| file.includes('lburg/'))
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.lccToolHeaders, 10, selected);
	}

	if(commandBuildSelf.TERMINATE) return;

	if(selected === commandBuildSelf.tools2Repository || (commandBuildSelf.q3asmFiles ?? []).indexOf(file) > -1)
	{
		await commandBuildSelf.downloadHeaders?.(commandBuildSelf.asmToolHeaders, 10, selected);
	}

	if(commandBuildSelf.TERMINATE) return;

	//let sha = filesRepo[selected][file].sha
	let contents = session ? session.contents : await commandBuildSelf.cacheFile?.(commandBuildSelf.DB_STORE_NAME ?? '', ownerName, repoName, file);

	if(commandBuildSelf.api)
	{
		commandBuildSelf.api.configuration = commandBuildSelf.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
	}

	let CONFIGURATION = commandBuildSelf.api?.configuration === 'release'
		? commandBuildSelf.dirs.ENGINE_RELEASE
		: commandBuildSelf.dirs.ENGINE_DEBUG;


	let srcPath = file.replace('.o', '.c');
	let obj = CONFIGURATION + '/' + file.replace('.c', '.o');
	let outPath = CONFIGURATION + '/' + file.replace('.c', '.asm');


	if(commandBuildSelf.TERMINATE) return;


	if(selected === commandBuildSelf.gameRepository
		|| file.includes('code/cgame')
		|| file.includes('code/game')
		|| file.includes('code/q3_ui')
		|| file.includes('code/ui')
	)
	{

		let DEFINE = ['-DGAME'];
		let vm = 'game';
		if(file.includes('code/cgame'))
		{
			DEFINE = ['-DCGAME', "-Icode/cgame"];
			vm = 'cgame';
		}
		if(file.includes('code/q3_ui'))
		{
			DEFINE = ['-DUI', "-Icode/ui"];
			vm = 'ui';
		}
		if(file.includes('code/ui'))
		{
			DEFINE = ['-DUI', "-Icode/q3_ui"];
			vm = 'q3_ui';
		}


		let tempPath = CONFIGURATION + '/' + srcPath.replace('.c', '.i');

		/*
q3lcc -v -v -D__LCC__ -D__CHAR_UNSIGNED__ -U_CHAR_IS_SIGNED -DQ3_VM -D_Q3_VM -Icode/game -Icode/cgame -Icode/q3_ui code/g
ame/bg_lib.c build/debug-wasm-js/code/game/bg_lib.i
q3lcc $Id$
code/game/bg_lib.c:
q3cpp -D__STDC__=1 -D__STRICT_ANSI__ -D__signed__=signed -DQ3_VM -D__LCC__ -D__LCC__ -D__CHAR_UNSIGNED__ -U_CHAR_IS_SIGNED
-DQ3_VM -D_Q3_VM -Icode/game -Icode/cgame -Icode/q3_ui code/game/bg_lib.c /tmp/lcc420.i
q3rcc -target=bytecode -v /tmp/lcc420.i bg_lib.asm
build/debug-wasm-js/code/game/bg_lib.i:
q3rcc -target=bytecode -v build/debug-wasm-js/code/game/bg_lib.i bg_lib.asm
rm /tmp/lcc420.i
*/

		/*

				await api.run({
					tool: 'q3cpp.js.wasm',
					args: [
						'q3cpp', // '-v', '-v',
						"-Icode/game",
						...DEFINE,
						srcPath,
						tempPath,
					],
					database: selected,
					toolsRepo: toolsRepo,
					paths: [file, tempPath],

					// TODO:
					contents: contents,
					width: term.cols,
					input: srcPath,
					tempPath,
					github_token: api.github_token
				})

				await api.run({
					tool: 'q3rcc.js.wasm',
					args: [
						'q3rcc', // '-v', '-v',
						'-target=bytecode',
						//(configuration.value === 'pre' ? '-g' : '-g2'),
						'-v',
						tempPath,
						outPath //.split('/').pop(),
					],
					database: selected,
					toolsRepo: toolsRepo,
					paths: [outPath, tempPath],
				})

				*/

		if(commandBuildSelf.SettingsToolbar?.configuration?.value === 'qvms')
		{
			await commandBuildSelf.api?.run?.({
				tool: 'q3lcc.js.wasm',
				args: [
					'q3lcc', '-v', '-v', '-S', '-Wf-g',  //  '-Wf-g', '-S',
					"-Icode/game",
					...DEFINE,
					srcPath,
					'-o', outPath,
				],
				contents: contents,
				database: selected,
				toolsRepo: commandBuildSelf.toolsRepository,
				paths: [outPath, srcPath],
			});

		} else
		{
			await commandBuildSelf.api?.run?.({
				tool: 'clang.wasm',
				args: [
					'clang',
					...commandBuildSelf.QVMLIB_CFLAGS ?? [],
					"-Icode/game",
					...DEFINE,
					...(srcPath.includes('bg_lib.c') ? ['-DQ3_VM=1'] : []),
					srcPath,
					'-o', obj,
				],
				contents: contents,
				database: selected,
				toolsRepo: commandBuildSelf.toolsRepository,
				paths: [obj, srcPath],
			});

		}


		return;
	}

	// TODO: clang -E -P -fminimize-whitespace file.c


	const INCLUDES = selected === commandBuildSelf.engineRepository
		? [...commandBuildSelf.CFLAGS ?? [], "-Icode/wasm", "-Icode/qcommon", "-Icode/client", "-Icode/game"]
		: [...commandBuildSelf.LCC_CFLAGS ?? [], "-Isrc"];

	return await commandBuildSelf.api?.compile?.({
		CFLAGS: [
			...INCLUDES,
			...(commandBuildSelf.SettingsToolbar?.configuration?.value === 'pre' ? [
				'-o', obj.replace('.o', '.a')
			] : ['-o', obj]),
			srcPath
		],
		contents: contents,
		width: term.cols,
		input: srcPath,
		database: selected,
		obj,
		github_token: commandBuildSelf.api?.github_token
	});
}


/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @param {string} commandName
 * @param {import('@xterm/xterm').Terminal} term
 * @returns
 */
async function clang(argv, database, commandName, term)
{

	let CONFIGURATION = commandBuildSelf.api?.configuration === 'release'
		? commandBuildSelf.dirs.ENGINE_RELEASE
		: commandBuildSelf.dirs.ENGINE_DEBUG;

	const session = !argv[0] ? currentSession() : void 0;
	const file = argv[0] ?? session?.fileId;
	if(!file) return;

	return await commandBuildSelf.api?.compile?.({
		CFLAGS: argv,
		contents: session?.contents,
		width: term.cols,
		input: file,
		database: database,
		obj: file ? CONFIGURATION + '/' + file.replace('.c', '.o') : null
	});
}


/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @param {string} commandName
 * @returns
 */
async function runWorker(argv, database, commandName)
{
	if(!argv[0] || argv[0].trim().length === 0
		|| argv[0].includes('quake3e')
		// TODO: remove conflict down below by running engine and dedicated in a worker
		|| argv[0].includes('engine')
		|| argv[0].includes('client')
		|| argv[0].includes('q3')
	)
	{
		return commandBuildSelf.loadCommand?.([argv[0]], database, commandName);
	}

	/** @type {string | undefined | null} */
	let thisDatabase = database;
	if(argv[0].includes('lburg')
		|| argv[0].includes('q3lcc')
		|| argv[0].includes('q3rcc')
		|| argv[0].includes('q3cpp')
		|| argv[0].includes('q3asm')
	)
		thisDatabase = commandBuildSelf.toolsRepository;
	if(argv[0].includes('stringify')
		|| argv[0].includes('quake3e')
		|| argv[0] === 'dedicated')
		thisDatabase = commandBuildSelf.engineRepository;

	return await commandBuildSelf.api?.run?.({
		tool: argv[0],
		args: argv,
		database: thisDatabase,
		toolsRepo: commandBuildSelf.toolsRepository
	});
}


/**
 *
 * @param {string[]} argv
 * @param {string} database
 * @returns
 */
async function lburg(argv, database)
{
	let selected = commandBuildSelf.toolsRepository || argv[1] || database;
	if(!selected) return;

	const parts = selected.split('/');
	const ownerName = parts.length == 2 ? parts[0] : commandBuildSelf.RepositoryToolbar?.owner?.value;
	const repoName = parts.length == 2 ? parts[1] : parts[0] || commandBuildSelf.RepositoryToolbar?.repository?.value;
	if(!ownerName || !repoName) return;

	if(!commandBuildSelf.filesRepo?.[selected] && ownerName && repoName)
	{
		let branch = await commandBuildSelf.getDefaultBranch?.(ownerName, repoName);
		if(branch)
		{
			await commandBuildSelf.loadGitHubTree?.(ownerName, repoName, branch);
		}
	}

	if(commandBuildSelf.api)
	{
		commandBuildSelf.api.configuration = commandBuildSelf.SettingsToolbar?.configuration?.value === 'debug' ? 'debug' : 'release';
	}

	let CONFIGURATION = commandBuildSelf.api?.configuration === 'release'
		? commandBuildSelf.dirs.ENGINE_RELEASE
		: commandBuildSelf.dirs.ENGINE_DEBUG;


	let paths = [
		argv[0] || 'src/dagcheck.md',
		argv[1] || commandBuildSelf.path.join(CONFIGURATION, argv[0] ? argv[0].replace('.md', '.c') : 'src/dagcheck.c'),
	];

	await commandBuildSelf.cacheFile?.(commandBuildSelf.DB_STORE_NAME ?? '', ownerName, repoName, paths[0], (commandBuildSelf.filesRepo?.[selected]?.[paths[0]] || {}).sha);


	let args = [
		'lburg.js.wasm',
		...paths,
		...argv.slice(2)
	];

	return await commandBuildSelf.api?.run?.({
		tool: 'lburg.js.wasm',
		args: args,
		database: selected,
		toolsRepo: commandBuildSelf.toolsRepository,
		paths: paths,
		github_token: commandBuildSelf.api.github_token
	});
}


/**
 *
 * @param {string[]} argv
 * @returns
 */
async function lcc(argv)
{
	return commandBuildSelf.COMMAND_SCHEMA['clang'].execute?.(argv);
}


/**
 *
 * @param {string[]} argv
 * @param {string | undefined} database
 * @returns
 */
async function wasm(argv, database = void 0)
{
	return await commandBuildSelf.api?.link?.({
		LDFLAGS: argv,
		database: database,
		github_token: commandBuildSelf.api?.github_token
	});
}


function kill()
{
	commandBuildSelf.api?.terminate?.();
	//api.worker.terminate()
}
