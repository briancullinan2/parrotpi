

// =====================================================================
// 1. STABLE PATTERNS & PIPELINE REGISTRIES
// =====================================================================
const MONITOR_LCC = /^([^:\n]+):(\d+):\s*(error|warning):\s*(.+)$/i;
const CLEAN_ANSI = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// =====================================================================
// 2. HIGH-DIMENSIONAL GLOBAL MICRO-UTILITY FUNCTIONS (Pure Logics)
// =====================================================================

/**
 * Pure mapper that loops through text lines to run polymorphic regex matching pairs
 */
function parseLineAnnotation(line)
{
	let cleanLine = line.trim();
	if(!cleanLine) return;

	for(let p = 0; p < DIAGNOSTIC_PARSERS.length; p++)
	{
		let parser = DIAGNOSTIC_PARSERS[p];
		let match = cleanLine.match(parser.pattern);

		if(match)
		{
			let diagnostic = parser.resolve(match, this);
			if(diagnostic && diagnostic.filePath)
			{
				let path = diagnostic.filePath;
				if(!this.fileAnnotationsMap[path])
				{
					this.fileAnnotationsMap[path] = [];
				}
				this.fileAnnotationsMap[path].push({
					row: diagnostic.row,
					column: undefined, // Line-wide block indicator context
					text: diagnostic.text,
					type: diagnostic.type
				});
			}
			break;
		}
	}
}

/**
 * Pure visual mapper parsing annotations into Ace DOM Range Markers (squigglies)
 */
function drawAnnotationMarker(session, Range, anno)
{
	let row = anno.row;
	let lineText = session.getLine(row) || "";

	let startColumn = (typeof anno.column === "number" && anno.column > 0) ? anno.column : 0;
	let endColumn = lineText.length || 1;

	if(typeof anno.column !== "number" || anno.column === 0)
	{
		let firstCharMatch = lineText.match(/^\s*/);
		if(firstCharMatch)
		{
			startColumn = firstCharMatch[0].length;
		}
	}

	let markerRange = new Range(row, startColumn, row, endColumn);
	let markerClass = (anno.type === "error") ? "compiler-error-marker" : "compiler-warning-marker";

	let markerId = session.addMarker(markerRange, markerClass, "text", false);
	this.activeMarkerIds.push(markerId);
}



function initMouseInterceptors(editor)
{
	let _self = this;
	editor.on("mousemove", function (e)
	{
		let position = e.getDocumentPosition();
		let session = editor.getSession();
		let container = editor.container;

		container.removeAttribute('data-compiler-error');
		container.removeAttribute('data-navigation-target');

		let activeAnnotations = session.getAnnotations().filter(function (ann)
		{
			if(ann.row !== position.row) return false;
			if(typeof ann.column !== "number" || ann.column === 0) return true;
			return position.column >= (ann.column - 4);
		});

		if(activeAnnotations.length > 0)
		{
			let tooltipText = activeAnnotations.map(function (ann)
			{
				return "[" + ann.type.toUpperCase() + "] " + ann.text;
			}).join('\n');

			container.setAttribute('data-compiler-error', tooltipText);
			editor.renderer.getMouseEventTarget().style.cursor = "text";
			return;
		}

		let token = session.getTokenAt(position.row, position.column);
		if(token && (token.type === "storage.type" || token.type === "entity.name.function"))
		{
			container.setAttribute('data-navigation-target', token.value);
			editor.renderer.getMouseEventTarget().style.cursor = "pointer";
			return;
		}

		editor.renderer.getMouseEventTarget().style.cursor = "text";
	});

	editor.on("mouseleave", function ()
	{
		editor.container.removeAttribute('data-compiler-error');
		editor.container.removeAttribute('data-navigation-target');
	});
	this.log("system:1: warning: Worker Error Reporting Connected");
}

function bridgeLog(session, message)
{
	if(!message) return;
	session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();
	let lines = message.split(/\r?\n/);
	for(let i = 0; i < lines.length; i++)
	{
		let cleanLine = lines[i].trim();
		if(cleanLine)
		{
			session.collectedLogLines.push(cleanLine);
		}
	}
	triggerBridgeRefresh(session);
}

function triggerBridgeRefresh(session)
{
	if(session)
	{
		if(!session.collectedLogLines)
		{
			session.collectedLogLines = [];
		}
		if(!session.fileAnnotationsMap)
		{
			session.fileAnnotationsMap = { "system": [] };
		}
		if(!session.workerAnnotations)
		{
			session.workerAnnotations = [];
		}
		if(!session.bridgeInstance)
		{
			session.bridgeInstance = this;
		}
	}
	let _self = this;
	if(this.timer) clearTimeout(this.timer);
	this.timer = setTimeout(function ()
	{
		bridgeProcessAnnotations(session);
	}, this.delay);
}

function bridgeProcessAnnotations(session)
{
	session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();
	if(!session)
	{
		debugger;
		return;
	}
	if(!session.collectedLogLines)
	{
		session.collectedLogLines = [];
	}
	let cleanMegaString = session.collectedLogLines
		.map(function (item) { return typeof item === 'string' ? item : (item.text || ""); })
		.join("\n")
		.replace(CLEAN_ANSI, "");

	let consolidatedLines = cleanMegaString.split(/\r?\n/);
	session.fileAnnotationsMap = { "system": [] };

	consolidatedLines.forEach(parseLineAnnotation.bind(this));
	refreshActiveEditorView(session);
}

function bridgeClear(session)
{
	session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();
	session.collectedLogLines = ["system:1: warning: Worker Error Reporting Connected"];
	session.fileAnnotationsMap = { "system": [] };
	refreshActiveEditorView(session);
}

function bridgeLookupShaderFile(shaderName)
{
	return "scripts/base.shader";
}

function bridgeFindLineInFile(filePath, token)
{
	if(!sessionCache[filePath]) return 0;
	let text = sessionCache[filePath].getValue();
	let lines = text.split('\n');
	for(let i = 0; i < lines.length; i++)
	{
		if(lines[i].includes(token))
		{
			return i;
		}
	}
	return 0;
}

function bridgeFindShaderByAssetDependency(assetPath)
{
	let baseToken = assetPath.replace(/\.(tga|jpg)$/i, "");
	let activeFiles = Object.keys(sessionCache);
	for(let f = 0; f < activeFiles.length; f++)
	{
		let path = activeFiles[f];
		if(path.endsWith('.shader') && sessionCache[path].getValue().includes(baseToken))
		{
			return path;
		}
	}
	return window.currentOpenFileId || "scripts/base.shader";
}

// =====================================================================
// 4. CORE CONSTRUCTOR & PROTOTYPE ASSIGNMENT ROUTINE
// =====================================================================

function DiagnosticsBridge()
{
	this.timer = null;
	this.delay = 250;
	initBridgeSession(this);
}

function initBridgeSession(bridgeInstance)
{
	return {
		log: function (msg) { bridgeInstance.log(msg); },
		clear: function ()
		{
			bridgeClear(session);
		},
		getBridge: function ()
		{
			return ({
				triggerBridgeRefresh: triggerBridgeRefresh.bind(bridgeInstance),
				refreshActiveEditorView: refreshActiveEditorView
			});
		}
	};
}


DiagnosticsBridge.prototype.initMouseInterceptors = initMouseInterceptors;
DiagnosticsBridge.prototype.log = bridgeLog;
DiagnosticsBridge.prototype.triggerBridgeRefresh = triggerBridgeRefresh;
DiagnosticsBridge.prototype.processAnnotations = bridgeProcessAnnotations;
DiagnosticsBridge.prototype.clear = bridgeClear;

// Low bound engine dependencies
DiagnosticsBridge.prototype.lookupShaderFile = bridgeLookupShaderFile;
DiagnosticsBridge.prototype.findLineInFile = bridgeFindLineInFile;
DiagnosticsBridge.prototype.findShaderByAssetDependency = bridgeFindShaderByAssetDependency;

ace.define("ace/ext/compiler_diagnostics", [
	"require",
	"exports",
	"module",
	"ace/config",
	"ace/lib/dom"
], function (require, exports, module)
{
	"use strict";

	// Export module instances
	let bridgeInstance = new DiagnosticsBridge();

	Object.assign(exports, initBridgeSession(bridgeInstance));
});



/**
 * Refreshes annotations, gutter highlights, and line markers synchronously
 */
function refreshActiveEditorView(session)
{
	session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();

	let currentFile = window?.currentSession?.(window.currentOpenFileId || session.id, session)
		|| window.currentOpenFileId || session.id || "";

	// Strip previous drawing layers
	if(!session.activeMarkerIds)
	{
		session.activeMarkerIds = [];
	}
	session.activeMarkerIds.forEach(function (id)
	{
		session.removeMarker(id);
	});
	session.activeMarkerIds = [];
	if(!session.fileAnnotationsMap)
		session.fileAnnotationsMap = { system: [] };
	let systemAnnotations = session.fileAnnotationsMap["system"] || [];
	let targetAnnotations = [];

	let keys = Object.keys(session.fileAnnotationsMap);
	for(let i = 0; i < keys.length; i++)
	{
		let cachedFileKey = keys[i];
		if(cachedFileKey !== "system" && currentFile.endsWith(cachedFileKey))
		{
			targetAnnotations = session.fileAnnotationsMap[cachedFileKey];
			break;
		}
	}

	if(!session.workerAnnotations)
	{
		session.workerAnnotations = [];
	}

	// Combine everything into a single layout array
	let finalAnnotations = systemAnnotations
		.concat(targetAnnotations)
		.concat(session.workerAnnotations);

	// Map subtle styles directly onto the metadata prior to passing to Ace
	finalAnnotations.forEach(function (anno)
	{
		if(anno.isLintingTip)
		{
			// Inject custom class definitions for light, non-distractible gray text
			anno.className = "ace_gutter_annotation_tip lint-subtle-gray";
		}
	});

	session.setAnnotations(finalAnnotations);
	if(finalAnnotations.length === 0) return;

	let Range = ace.require("ace/range").Range;
	finalAnnotations.forEach(function (anno)
	{
		if(typeof drawAnnotationMarker === "function")
		{
			drawAnnotationMarker.call(session, session, Range, anno);
		}
	});
}


