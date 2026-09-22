let antlrProcessor = null;

// =====================================================================
// 1. TOP-LEVEL GLOBAL MICRO-UTILITY FUNCTIONS
// =====================================================================
const EXTENSION_TO_PARSER_ID = {
	'abap': 'abap',
	'abc': 'abc',
	'ada': 'ada',
	'adb': 'ada',
	'ahk': 'autohotkey',
	'apex': 'apex',
	'applescript': 'applescript',
	'as': 'angelscript',
	'asm': 'asm',
	'bat': 'batchfile',
	'bash': 'sh',
	'c': 'c',
	'cbl': 'cobol',
	'cc': 'cpp',
	'cfc': 'coldfusion',
	'cfm': 'coldfusion',
	'cfg': 'q3config',
	'cjs': 'javascript',
	'cl': 'lisp',
	'clj': 'clojure',
	'cljs': 'clojure',
	'cls': 'apex',
	'cmakelists.txt': 'cmake',
	'cmake': 'cmake',
	'cmd': 'batchfile',
	'cob': 'cobol',
	'coffee': 'coffee',
	'conf': 'apache_conf',
	'cpp': 'cpp',
	'cs': 'csharp',
	'css': 'css3',
	'csx': 'csharp',
	'cxx': 'cpp',
	'd': 'd',
	'dart': 'dart',
	'diff': 'diff',
	'dockerfile': 'dockerfile',
	'dot': 'dot',
	'e': 'eiffel',
	'edn': 'clojure',
	'ejs': 'ejs',
	'erl': 'erlang',
	'ex': 'elixir',
	'exs': 'elixir',
	'f': 'fortran',
	'f90': 'fortran',
	'f95': 'fortran',
	'for': 'fortran',
	'forth': 'forth',
	'frag': 'glsl',
	'fs': 'fsharp',
	'fsi': 'fsharp',
	'fsx': 'fsharp',
	'fth': 'forth',
	'ftl': 'freemarker',
	'gcode': 'gcode',
	'gitignore': 'ini',
	'glsl': 'glsl',
	'vlsl': 'glsl',
	'hlsl': 'glsl',
	'go': 'golang',
	'gql': 'graphql',
	'graphql': 'graphql',
	'groovy': 'groovy',
	'gsh': 'groovy',
	'gvy': 'groovy',
	'gy': 'groovy',
	'h': 'c',
	'haml': 'haml',
	'handlebars': 'handlebars',
	'hbs': 'handlebars',
	'hh': 'cpp',
	'hjson': 'hjson',
	'hpp': 'cpp',
	'hrl': 'erlang',
	'hs': 'haskell',
	'htm': 'html',
	'html': 'html',
	'htaccess': 'apache_conf',
	'hxx': 'cpp',
	'i': 'c',
	'ini': 'ini',
	'ino': 'c',
	'io': 'io',
	'java': 'java',
	'jade': 'pug',
	'jl': 'julia',
	'js': 'javascript',
	'json': 'json',
	'jsm': 'javascript',
	'jsp': 'jsp',
	'jsx': 'jsx',
	'kt': 'kotlin',
	'kts': 'kotlin',
	'less': 'less',
	'liquid': 'liquid',
	'lisp': 'lisp',
	'log': 'text',
	'ls': 'livescript',
	'lsp': 'lisp',
	'ltx': 'latex',
	'lua': 'lua',
	'm': 'matlab',
	'makefile': 'makefile',
	'make': 'makefile',
	'markdown': 'creole',
	'md': 'creole',
	'mel': 'mel',
	'mjs': 'javascript',
	'mk': 'makefile',
	'ml': 'ocaml',
	'mli': 'ocaml',
	'mm': 'objectivec',
	'mysql': 'mysql',
	'nginx': 'nginx',
	'nim': 'nim',
	'nix': 'nix',
	'nsh': 'nsis',
	'nsi': 'nsis',
	'pas': 'pascal',
	'patch': 'diff',
	'perl': 'perl',
	'pgsql': 'postgresql',
	'php': 'php',
	'phtml': 'php',
	'pig': 'pig',
	'pl': 'perl',
	'plsql': 'plsql',
	'pm': 'perl',
	'pp': 'pascal',
	'powershell': 'powershell',
	'prefs': 'ini',
	'properties': 'properties',
	'props': 'properties',
	'proto': 'protobuf3',
	'ps1': 'powershell',
	'psm1': 'powershell',
	'pug': 'pug',
	'puppet': 'puppet',
	'py': 'python3',
	'pyw': 'python3',
	'q': 'q',
	'r': 'r',
	'rb': 'ruby',
	'rdoc': 'rdoc',
	'rhtml': 'ruby',
	'rprofile': 'r',
	'rs': 'rust',
	's': 'asm',
	'sass': 'sass',
	'sbt': 'scala',
	'scad': 'scad',
	'scala': 'scala',
	'scheme': 'scheme',
	'scm': 'scheme',
	'scss': 'scss',
	'sh': 'sh',
	'sieve': 'sieve',
	'slim': 'slim',
	'smali': 'smali',
	'smarty': 'smarty',
	'sql': 'sql',
	'ss': 'scheme',
	'styl': 'stylus',
	'svg': 'svg',
	'swift': 'swift',
	'tcl': 'tcl',
	'tex': 'latex',
	'toml': 'toml',
	'tpl': 'smarty',
	'ts': 'typescript',
	'tsx': 'tsx',
	'twig': 'twig',
	'txt': 'text',
	'wasm': 'wat',
	'qvm': 'wat',
	'v': 'verilog',
	'vala': 'vala',
	'vapi': 'vala',
	'vbe': 'vbscript',
	'vbs': 'vbscript',
	'vert': 'glsl',
	'vh': 'verilog',
	'vhd': 'vhdl',
	'vhdl': 'vhdl',
	'vue': 'vue',
	'xhtml': 'html',
	'xml': 'xml',
	'xsd': 'xml',
	'xsl': 'xml',
	'yaml': 'yaml',
	'yml': 'yaml',
	'zig': 'zig',
	'zsh': 'sh',


	'cam': 'q3camera',
	'shader': 'q3shader',
	'shaderx': 'q3shader',
	'cam': 'q3camera',
	'map': 'q3map', // Or 'quakemap' if targeting your legacy BSP parser
	'arena': 'q3arena',
	'menu': 'q3menu',
	'skin': 'q3skin',
};
/**
 * Updates the structural targets and re-schedules the parser timeline
 */
function setLanguageContext(fileId)
{
	const ext = fileId.split('.').pop().toLowerCase();
	const filenameAsType = fileId.split('/').pop().toLowerCase();
	const modeKey = ((!EXTENSION_TO_PARSER_ID[ext] || ext === 'txt') && EXTENSION_TO_PARSER_ID[filenameAsType]) ? filenameAsType : ext;
	this.languageKey = EXTENSION_TO_PARSER_ID[modeKey];
	if(!this.languageKey)
	{
		const textContent = this.doc.getValue();

		const matchedLanguageNode = TEXT_LANGUAGE_DETECTOR_WATERFALL.find(lang => lang.match(textContent, cleanBuffer));

	}
	this.activeFileId = fileId;
	this.deferredUpdate.schedule(); // Native trigger to fire onUpdate()
}

/**
 * Functional collector scanning for lingering tasks or preprocessor channels
 */
function processStructuralFlags(annotations, token)
{
	if(token.textType === 'comment'
		&& (token.text.toLowerCase().includes('todo')
			|| token.text.toLowerCase().includes('fix'))
	)
	{
		annotations.push({
			row: token.line - 1,
			column: token.column,
			text: "Unresolved task: " + token.text.trim(),
			type: "info"
		});
	}
	if(token.channel > 1)
	{
		annotations.push({
			row: token.line - 1,
			column: token.column,
			text: "Isolated preprocessor block [" + token.type + "]",
			type: "warning"
		});
	}
}



async function onUpdate()
{
	if(!this.doc) return;

	const fullText = this.doc.getValue();
	let annotations = [];

	try
	{
		// Kick off the unified single-pass compiler pipeline
		runParserPipeline(fullText, this.languageKey, annotations, this.sender);
	} catch(pipelineCrash)
	{
		console.error("[ANTLR Pipeline Crash]:", pipelineCrash);
		annotations.push({
			row: 0,
			column: 0,
			text: "ANTLR Processing crash: " + pipelineCrash.message,
			type: "error"
		});
	}

	// Send any remaining preprocessing or global syntax errors down to Ace
	this.sender.emit("annotate", annotations);
}


function AntlrWorkerBackend(sender)
{
	const Mirror = ace.require("ace/worker/mirror").Mirror;
	Mirror.call(this, sender);

	this.setTimeout(200);
	this.languageKey = "c";
	this.activeFileId = "";
}

function setupInheritance()
{
	const Mirror = ace.require("ace/worker/mirror").Mirror;
	const oop = ace.require("ace/lib/oop");
	oop.inherits(AntlrWorkerBackend, Mirror);
	AntlrWorkerBackend.prototype.setLanguageContext = setLanguageContext;
	AntlrWorkerBackend.prototype.onUpdate = onUpdate;
}




self.addEventListener('message', function (e)
{
	const msg = e.data;
	if(!msg) return;

	// Use a localized variable for routing so we don't mutate the raw event object
	// that Ace's worker-base.js expects to read further down the chain.
	const commandName = msg.command || msg.event;

	// 1. FILTER HIGH-FIDELITY HOOKS
	if(commandName && ['customHighlightRoute', 'requestAST'].includes(commandName))
	{
		e.stopImmediatePropagation();
		return;
	}

	if(commandName === "calculateActiveBlockRange")
	{
		const cursorRow = msg.data.lineNumber; // 1-based lineNumber passed from front-end
		const codeString = antlrProcessor.doc.getValue(); // Get running buffer from doc wrapper
		const runningLangId = antlrProcessor.languageKey || "c";

		try
		{
			// Execute your streamlined look-around block algorithm
			const blockMeta = extractCurrentBlock(codeString, cursorRow, runningLangId);

			// Post the clean range boundaries right back up the thread channel
			antlrProcessor.sender.emit("blockRange", {
				startLine: blockMeta.startLine,
				endLine: blockMeta.endLine
			});
		} catch(err)
		{
			console.error("[Worker Block Trace Error]: ", err);
		}
		e.stopImmediatePropagation();
		return;
	}

	if(commandName === 'getFoldRegions')
	{
		e.stopImmediatePropagation();
		return executeGetFoldRegionsCommand(msg, antlrProcessor.sender);
	}

	// 2. SOVEREIGN BOOTSTRAP INITIALIZATION
	if(commandName === "importScripts")
	{
		e.stopImmediatePropagation(); // Prevent Ace from trying to parse script imports

		// Let the worker thread download your dependencies cleanly
		self.importScripts(...msg.args);
		setupInheritance.apply(antlrProcessor);

		// Build a dedicated sender pipeline to post events straight back to our frontend instance
		const cleanSender = {
			on: function () { },
			callback: function (data, id) { self.postMessage({ type: "call", id: id, data: data }); },
			emit: function (name, data) { self.postMessage({ type: "event", name: name, data: data }); }
		};

		// Construct your independent workspace engine instance!
		antlrProcessor = new AntlrWorkerBackend(cleanSender);
		return;
	}

	// 3. AUTONOMOUS TUNNELING GATES
	// If your frontend worker client posts an explicit execution directive,
	// intercept it and apply it straight to your processor context.
	if(antlrProcessor && typeof antlrProcessor[commandName] === "function")
	{
		antlrProcessor[commandName].apply(antlrProcessor, msg.args);
		e.stopImmediatePropagation();
		return;
	}

	/*
	// 4. ACE CHANGE HOOK INTEGRATION
	// Mirror the edits to your state tracker, but DO NOT call stopImmediatePropagation().
	// Ace's background engine relies on receiving this identical change event next.
	if (antlrProcessor && antlrProcessor.doc && commandName === "change") {
		// Rehydrate compressed delta structure back into the required standard format
		const rawPayload = msg.data && msg.data.data;
		if (Array.isArray(rawPayload) && rawPayload.length >= 2) {
			const startPos = rawPayload[0]; // {"row":6,"column":28}
			const secondParam = rawPayload[1]; // Can be {"row":6,"column":30} OR an Array of lines [";"]

			let cleanDelta;

			// 1. CHECK IF DELETION: If the second element has a 'row' property, it's an end position object
			if (secondParam && typeof secondParam === "object" && "row" in secondParam) {
				cleanDelta = {
					action: "remove",
					start: startPos,
					end: secondParam,
					// For a remove action, standard applyDeltas will slice out the text,
					// but providing an empty array prevents crashes if the tracker demands the lines key
					lines: []
				};
			}
			// 2. CHECK IF INSERTION: If the second element is an array of text lines
			else if (Array.isArray(secondParam)) {
				const endRow = startPos.row + secondParam.length - 1;
				const endColumn = (secondParam.length === 1)
					? startPos.column + secondParam[0].length
					: secondParam[secondParam.length - 1].length;

				cleanDelta = {
					action: "insert",
					start: startPos,
					end: { row: endRow, column: endColumn },
					lines: secondParam
				};
			}

			// 3. Apply the fixed delta to your tracker if valid
			if (cleanDelta) {
				antlrProcessor.doc.applyDeltas([cleanDelta]);
				antlrProcessor.deferredUpdate.schedule(); // Trigger lookahead parse
			}
		}
		// No stopImmediatePropagation() here! Let it pass straight through to Ace.
	}
	*/
}, true);





function executeGetFoldRegionsCommand(msg, sender)
{
	// 1. RECOVER WORKER CONTEXT HOOKS
	const activeDoc = antlrProcessor.doc || self.doc || (typeof globalDoc !== 'undefined' ? globalDoc : null);
	if(!activeDoc)
	{
		console.warn("[Worker Fold] Execution failed: Active document stream buffer is missing.");
		return;
	}

	const codeString = activeDoc.getValue();
	const languageKey = antlrProcessor.languagekey || self.languageKey || "c";

	// Resolve core ANTLR library context reference out of the worker global space
	const antlrCore = AntlrRegistry?.antlr4 || self.antlr4 || (self.antlr && self.antlr.core) || antlr;
	if(!antlrCore)
	{
		console.error("[Worker Fold] Critical Error: ANTLR runtime core library context lost.");
		return;
	}

	// 2. PARSER CONSTRUCTION PIPELINE
	const cleanKey = languageKey.toLowerCase().trim();
	const lexerLookupKey = `${cleanKey}_lexer`;
	const parserLookupKey = `${cleanKey}_parser`;

	let LexerCtor = AntlrRegistry[lexerLookupKey];
	let ParserCtor = AntlrRegistry[parserLookupKey];

	if(!LexerCtor || !ParserCtor)
	{
		console.warn(`[Worker Fold] No valid ANTLR grammars registered for language key: ${languageKey}`);
		return;
	}

	// Spin up lightweight input char-stream frameworks natively
	//const chars = new antlrCore.InputStream(codeString);
	const lexer = createLexerInstance(codeString, languageKey);
	const tokens = new antlrCore.CommonTokenStream(lexer);
	const parser = new ParserCtor(tokens);

	// Mute console errors during layout-only block parsing runs
	parser.removeErrorListeners();
	const silentDiagnosticObserver = {
		syntaxError: function (recognizer, offendingSymbol, line, column, msg, e)
		{
			// Quietly absorb syntax markers during visual fold processing runs
		},
		reportAmbiguity: function (recognizer, dfa, startIndex, stopIndex, exact, ambigAlts, configs)
		{
			// Absorb deep SLL prediction branching conflicts silently
		},
		reportAttemptingFullContext: function (recognizer, dfa, startIndex, stopIndex, conflictingAlts, configs)
		{
			// CRITICAL PROXIMATE GAP FIX: Satisfies the engine when dropping into deep LL validation
		},
		reportContextSensitivity: function (recognizer, dfa, startIndex, stopIndex, prediction, configs)
		{
			// Absorb fallback optimization logs smoothly
		}
	};

	// Attach the clean listener shell to the parser
	parser.addErrorListener(silentDiagnosticObserver);

	//parser._interp.predictionMode = AntlrRegistry.antlr4.atn.PredictionMode.SLL;
	const ErrorNamespace = AntlrRegistry.antlr4?.error || {};
	const BailStrategy = ErrorNamespace.BailErrorStrategy;
	const DefaultStrategy = ErrorNamespace.DefaultErrorStrategy;

	// 2. Default to DefaultErrorStrategy so the parser attempts syntax recovery
	// rather than instantly throwing an uncatchable exception on minor token gaps
	if(DefaultStrategy)
	{
		parser._errHandler = new DefaultStrategy();
	} else if(BailStrategy)
	{
		parser._errHandler = new BailStrategy();
	}

	// 3. GENERATE AST SYNTAX TREE SKELETON
	let tree = null;
	try
	{
		const targetRules = parser.ruleNames || (parser.constructor && parser.constructor.ruleNames);
		if(targetRules && targetRules[0] && typeof parser[targetRules[0]] === 'function')
		{
			const rootRuleName = targetRules[0]; // Matches base rules like "compilationUnit" or "json"
			tree = parser[rootRuleName]();
		}
	} catch(parseFallbackError)
	{
		// If Bail Strategy tripped under SLL, drop back to LL mode quickly for deep checking
		try
		{
			tokens.reset();
			parser._interp.predictionMode = antlrCore.atn.PredictionMode.LL;
			parser._errHandler = new antlrCore.error.DefaultErrorStrategy();
			const rootRuleName = parser.ruleNames[0];
			tree = parser[rootRuleName]();
		} catch(treeCrash)
		{
			console.error("[Worker Fold] Syntax compilation completely blocked context generation: ", treeCrash);
			return;
		}
	}



	// 4. RUN AGNOSTIC BLOCK HARVEST VISITOR
	if(tree)
	{
		try
		{
			const blockVisitor = new AntlrBlockCollectorVisitor(parser);
			const rawBlocks = blockVisitor.collect(tree);
			const checkDoc = antlrProcessor.doc || self.doc || (typeof globalDoc !== 'undefined' ? globalDoc : null);

			if(checkDoc)
			{
				const discoveredBlocks = [];

				// Total line count helper to check bounds safely
				const totalLines = checkDoc.getLength();

				// Step 2: Filter out blocks that don't meet basic size criteria
				// Rule: Must be at least 5 lines long (inclusive bounds check)
				const candidates = rawBlocks.filter(b => (b.endLine - b.startLine + 1) >= 5);

				// Step 3: Run filtering & line adjustments
				for(let i = 0; i < candidates.length; i++)
				{
					const b = candidates[i];

					// 1-based to 0-based conversion for Ace Document line indexing
					const startLineIdx = b.startLine - 1;
					const endLineIdx = b.endLine - 1;

					// Skip safely if the positions are out of file boundaries
					if(startLineIdx < 0 || endLineIdx >= totalLines) continue;

					// Step 4: Handle standard JS deep nesting threshold
					// Filter elements in the original list that are strictly inside this block
					const internalBlocks = rawBlocks.filter(other =>
						other !== b &&
						other.startLine >= b.startLine &&
						other.endLine <= b.endLine
					);

					// Skip block if it contains more than 4 nested functional blocks
					if(internalBlocks.length > 100)
					{

						continue;
					}

					// Step 5: Double-stack elimination (De-duplication of identical/near-identical ranges)
					// Check if we already processed a broader structural rule handling this exact code range
					const isDuplicate = discoveredBlocks.some(existing =>
						Math.abs(existing.startLine - b.startLine) <= 1 &&
						Math.abs(existing.endLine - b.endLine) <= 1
					);
					if(isDuplicate) continue;

					// Step 6: Visual Bracket Layout Adjustment
					const headerLineText = checkDoc.getLine(startLineIdx) || "";
					let finalStartLine = b.startLine;
					let finalEndLine = b.endLine;

					// If the starting line contains an opening curly bracket '{',
					// adjust the fold downward by 1 line so the function signature line remains visible
					if(headerLineText.includes('{'))
					{
						finalStartLine = b.startLine + 1;
					}


					if(checkDoc.getLine(endLineIdx).includes('}')
						|| checkDoc.getLine(endLineIdx + 1).includes('}')
					)
					{
						finalEndLine = b.endLine - 1;
					}

					// Final sanity check: ensuring our modifications didn't shrink the fold to less than 2 lines
					if(b.endLine - finalStartLine >= 2)
					{
						discoveredBlocks.push({
							ruleName: b.ruleName,
							startLine: finalStartLine,
							endLine: finalEndLine,
							startIndex: b.startIndex,
							endIndex: b.endIndex
						});
					}
				}

				// Step 7: Emit processed clean fold structures to the Ace interface
				sender.emit("foldRegionsCalculated", {
					fileId: self.activeFileId || msg.args?.[0] || "active_buffer",
					blocks: discoveredBlocks
				});
			}

		} catch(visitorError)
		{
			console.warn("[Worker Fold] AntlrBlockCollectorVisitor invocation error: ", visitorError);
		}
	}
}
