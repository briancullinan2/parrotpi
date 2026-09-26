



function bridgeApplyCustomWorkerHighlights(tokenLines)
{
	if(!this.activeEditor || !tokenLines) return;

	let session = this.activeEditor.getSession();
	session.bgTokenizer.lines = tokenLines;
	session.bgTokenizer.fireUpdateEvent(0, tokenLines.length - 1);
}

function onBridgeHighlight(response)
{
	const session = this.docSession; // Ensure you have a reference to the active session
	const { totalLines, antlrTokensByLine } = response.data;

	// 1. Tell Ace's background tokenizer to stop fighting your data
	if(session.bgTokenizer)
	{
		// Clear Ace's default internal cache lines
		session.bgTokenizer.lines = session.bgTokenizer.lines || [];

		// 2. Overwrite Ace's token cache arrays with your precise ANTLR tokens
		for(let row = 0; row < totalLines; row++)
		{
			if(antlrTokensByLine[row])
			{
				// Format expected by Ace: [{ type: "keyword.antlr", value: "void" }, ...]
				session.bgTokenizer.lines[row] = antlrTokensByLine[row];
			}
		}

		// 3. Force Ace to redraw the viewport using your newly injected arrays
		session._emit("tokenizerUpdate", { first: 0, last: totalLines - 1 });
	}
}


function onWorkerAnnotate(session, e)
{
	var compilerDiagnostics = ace.require("ace/ext/compiler_diagnostics");
	if(compilerDiagnostics && compilerDiagnostics.getBridge)
	{
		var bridge = compilerDiagnostics.getBridge();
		bridge.setWorkerAnnotations(e.data);
	} else
	{
		session.setAnnotations(e.data);
	}
}

/**
 * Cleanup handler when a workspace edit session is dismantled
 */
function onWorkerTerminate(_this2, session)
{
	session.clearAnnotations();
	for(var m = 0; m < _this2.activeMarkerIds.length; m++)
	{
		session.removeMarker(_this2.activeMarkerIds[m]);
	}
	_this2.activeMarkerIds = [];
}


/**
 * Explicit setter proxy forwarding environment states downstream to the background thread
 */
function setLanguageTarget(_worker, langKey, fileId)
{
	if(_worker)
	{
		_worker.postMessage({
			command: "setLanguageContext",
			args: [langKey, fileId]
		});
	}
}

ace.define("ace/mode/antlr_worker", [
	"require",
	"exports",
	"module",
	"ace/lib/oop",
	"ace/mode/text",
	"ace/worker/worker_client",
	"ace/mode/text_highlight_rules"
], function (require, exports, module)
{
	"use strict";

	var oop = require("ace/lib/oop");
	var TextMode = require("ace/mode/text").Mode;
	var WorkerClient = require("ace/worker/worker_client").WorkerClient;
	var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

	var sharedWorkerInstance = null;
	var activeSession = null;

	function AntlrWorker(session)
	{
		var baseOrigin = window.location.origin;
		var targetUrl = baseOrigin + "/ace/worker-antlr.js";

		WorkerClient.call(this, ["ace"], "ace/mode/antlr_worker_actions", "AntlrWorker", targetUrl);

		// --- CRITICAL FIX 1: Prevent Ace from terminating this single background worker ---
		this.terminate = function ()
		{
			// No-op! Intercept Ace's automatic session.stopWorker() / worker.terminate()
		};

		// Explicit method to really kill it if the entire web app unmounts
		this.forceTerminate = function ()
		{
			if(this.$worker)
			{
				this.$worker.terminate();
				this.$worker = null;
			}
		};

		this.setLanguageTarget = function (fileId)
		{
			if(this.$worker)
			{
				this.$worker.postMessage({
					command: "setLanguageContext",
					args: [fileId]
				});
			}
		};

		if(this.$worker)
		{
			this.$worker.postMessage({
				command: "importScripts",
				args: [
					baseOrigin + '/components/rosetta/rosetta.js',
					baseOrigin + '/components/rosetta/parsers.js',
					baseOrigin + "/ace/worker-base.js",
					baseOrigin + '/components/rosetta/antlr-languages.bundle.js',
					baseOrigin + "/components/rosetta/worker-language.js"
				]
			});
		}

		// Forward messages ONLY to the active session
		this.on("highlight", function (response)
		{
			if(activeSession && typeof handleWorkerStreamHighlight === 'function')
			{
				handleWorkerStreamHighlight(activeSession, response.data);
			}
		});

		this.on("blockRange", function (response)
		{
			if(activeSession && typeof handleWorkerBlockHighlight === 'function')
			{
				handleWorkerBlockHighlight(activeSession, response.data);
			}
		});

		this.on("annotate", function (response)
		{
			if(activeSession)
			{
				activeSession.setAnnotations(response.data);
				if(typeof handleWorkerAnnotate === 'function')
				{
					handleWorkerAnnotate(activeSession, response);
				}
			}
		});

		this.on("foldRegionsCalculated", function (response)
		{
			if(activeSession && typeof handleWorkerFoldRegions === 'function')
			{
				handleWorkerFoldRegions(activeSession, response.data);
			}
		});
	}

	oop.inherits(AntlrWorker, WorkerClient);

	function switchActiveSession(newSession)
	{
		if(!newSession) return;

		// If the shared worker was terminated or not created yet, recreate it
		if(!sharedWorkerInstance || !sharedWorkerInstance.$worker)
		{
			sharedWorkerInstance = new AntlrWorker(newSession);
		}

		// --- CRITICAL FIX 2: Re-bind document listener on the worker ---
		if(activeSession !== newSession)
		{
			if(activeSession)
			{
				//sharedWorkerInstance.detachFromDocument();
			}
			activeSession = newSession;
			sharedWorkerInstance.attachToDocument(activeSession);
		}

		var modeId = (activeSession.getMode() && activeSession.getMode().$id) || activeSession.$modeId || "";
		var languageKey = modeId.split("/").pop() || "c";
		var fileId = activeSession.workspaceFileId ||
			(activeSession.getDocument() && activeSession.getDocument().$fileId) ||
			"temp_buffer." + languageKey;

		activeSession.workspaceFileId = fileId;

		// Notify worker about the new file context
		sharedWorkerInstance.setLanguageTarget(fileId);
	}

	var Mode = function ()
	{
		this.HighlightRules = TextHighlightRules;
	};
	oop.inherits(Mode, TextMode);

	(function ()
	{
		this.createWorker = function (session)
		{
			if(!session) return null;

			// Hand off control to the switchActiveSession manager
			switchActiveSession(session);

			return sharedWorkerInstance;
		};

		this.$id = "ace/mode/antlr";
	}).call(Mode.prototype);

	exports.Mode = Mode;
	exports.switchActiveSession = switchActiveSession;
});



/**
 * Core Gutter Plugin: Man-in-the-middle handler that overrides Ace's
 * internal template string generators to force VS Code style chevrons.
 */
function handleWorkerFoldRegions(session, data)
{
	const blocks = data.blocks || [];
	session.antlrDiscoveredFoldBlocks = blocks;

	const renderer = session.$editor.renderer;
	if(!renderer || !renderer.$gutterLayer) return;

	// ─── 1. FORCE THE IN-MEMORY ARRAY SYSTEM TO SHIFT STATES ───
	session.foldWidgets = [];
	for(let i = 0; i < session.getLength(); i++)
	{
		const humanRow = i + 1;
		const hasBlockStart = blocks.some(b => b.startLine === humanRow);
		session.foldWidgets[i] = hasBlockStart ? "start" : "";
	}

	// ─── 2. PLUG NATIVE RANGE OVERRIDES FOR CLICK INTERACTIONS ───
	session.getFoldWidget = function (row)
	{
		return session.foldWidgets[row] || "";
	};

	session.getFoldWidgetRange = function (row)
	{
		const humanRow = row + 1;
		const aceRange = ace.require("ace/range").Range;

		// Specificity sort: prioritize the narrowest nested inner rule on multi-block lines
		const targetBlock = (session.antlrDiscoveredFoldBlocks || [])
			.filter(b => b.startLine === humanRow)
			.sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine))[0];

		if(targetBlock)
		{
			const lineText = session.getLine(row);
			const startColumn = lineText.search(/\S/) !== -1 ? lineText.search(/\S/) : 0;
			return new aceRange(row, startColumn, targetBlock.endLine - 1, session.getLine(targetBlock.endLine - 1).length);
		}
		return null;
	};

}





function handleWorkerStreamHighlight(session, responseData)
{
	if(!responseData || !responseData.tokenLinesChunk) return;

	const { tokenLinesChunk, annotationsChunk, startLine, endLine } = responseData;
	const bgTokenizer = session.bgTokenizer;

	// Convert 1-based editor bounds to 0-indexed internal array rows
	const startRow = startLine - 1;
	const endRow = endLine - 1;

	// --- LINEAR BOUNDARY OVERLAY LOOP ---
	// Iterate strictly through the modified block range to prevent skipping slots
	for(let rowIndex = startRow; rowIndex <= endRow; rowIndex++)
	{
		const lineTokens = tokenLinesChunk[rowIndex];

		if(Array.isArray(lineTokens))
		{
			// Ace breaks completely if an array is empty [].
			// If it's a blank line, give it a baseline plain text token type definition.
			if(lineTokens.length === 0)
			{
				bgTokenizer.lines[rowIndex] = [{ type: "text", value: "" }];
			} else
			{
				bgTokenizer.lines[rowIndex] = lineTokens;
			}

			// Invalidate the row's state layout frame explicitly
			bgTokenizer.states[rowIndex] = "start";
			bgTokenizer.fireUpdateEvent(rowIndex, rowIndex);
		}
		// If lineTokens is completely undefined for this index, we leave Ace's
		// existing background tokenizer cache completely untouched!
	}

	// 2. Stitch Annotations safely
	if(Array.isArray(annotationsChunk))
	{
		const currentAnnotations = session.getAnnotations() || [];
		const preservedAnnotations = currentAnnotations.filter(ann =>
			ann.row < startRow || ann.row > endRow
		);
		session.setAnnotations([...preservedAnnotations, ...annotationsChunk]);
	}
}




/**
 * Handles incoming background worker annotations
 */
function handleWorkerAnnotate(session, e)
{
	session.workerAnnotations = e.data || [];
	refreshActiveEditorView(session);
}



let currentBlockMarkerId = null;
let lastRenderedBoundsKey = "";

function handleWorkerBlockHighlight(session, responseData)
{

	const AceRange = ace.require("ace/range").Range;

	// If response is invalid or missing numeric boundaries, clear existing marker and reset
	if(
		!responseData ||
		typeof responseData.startLine !== "number" ||
		typeof responseData.endLine !== "number"
	)
	{
		if(currentBlockMarkerId !== null && session)
		{
			session.removeMarker(currentBlockMarkerId);
			currentBlockMarkerId = null;
		}
		lastRenderedBoundsKey = "";
		return;
	}

	const { startLine, endLine } = responseData;
	const boundsKey = `${startLine}:${endLine}`;

	// Target efficiency gate: exit early if line bounds have not changed
	if(boundsKey === lastRenderedBoundsKey)
	{
		return;
	}
	lastRenderedBoundsKey = boundsKey;

	// Clear old marker prior to rendering the new boundary
	if(currentBlockMarkerId !== null)
	{
		session.removeMarker(currentBlockMarkerId);
		currentBlockMarkerId = null;
	}

	// Convert 1-indexed input to Ace 0-indexed rows
	const startRow = Math.max(0, startLine - 1);
	const endRow = Math.max(0, endLine - 1);

	// Columns are set to 0 as "fullLine" expands across the full viewport width
	const highlightRange = new AceRange(startRow, 0, endRow, 0);

	currentBlockMarkerId = session.addMarker(
		highlightRange,
		"ace_active_block_scope_highlight",
		"fullLine"
	);
}

