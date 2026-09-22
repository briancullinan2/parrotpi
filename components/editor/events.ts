import type { StatusBarWidget } from '../bundle/status';
import type { AceEditorWidget } from './widget';
import type { AceEditor, AceSession, EditorWindow } from './widget.d';
import type { NavPoint } from '../bundle/menu-history';
import { Ace } from 'ace-builds';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';

const editorSelf: EditorWindow & LuminoLayoutWindow & GlobalToolbarsWindow = self as unknown as any;

export interface AceTrackingPayload
{
	event: MouseEvent;
	row: number;
	column: number;
	lineText: string;
	tokenText: string | null;
	tokenType: string | null;
	isFunctionCall: boolean;
	compilerError: string | null;
	id: string | number;
	file: string | null;
}

export class AceEventManager
{
	private _widget: AceEditorWidget;
	private _container: HTMLElement;

	// Position caching layers
	private _lastTrackedRow = -1;
	private _lastTrackedColumn = -1;
	private _lastTrackedGutterRow: number | null = null;
	private _previousAceUpdate: AceTrackingPayload | null = null;

	// State Tracking
	private _aceMoveDebounceTimer: number | null = null;
	private _globalTooltip: HTMLElement;
	private _currentBlockMarkerId: number | null = null;

	constructor(widget: AceEditorWidget)
	{
		this._widget = widget;
		this._container = widget.node;

		// Find or create a single shared overlay tooltip in the DOM
		this._globalTooltip = document.getElementById('global-editor-tooltip') || this._createTooltipNode();

		this._initAceEventHooks();
	}

	/**
	 * Bind native DOM listeners when the widget becomes active.
	 * Call this inside your widget's `onAfterAttach`.
	 */
	public attachListeners(): void
	{
		this._container.addEventListener('mousemove', this._onAceMouseMove);
		this._container.addEventListener('mouseup', this._onMouseUp);
		this._container.addEventListener('mousedown', this._onMouseDown);
	}

	/**
	 * Unbind native DOM listeners when the widget goes out of scope.
	 * Call this inside your widget's `onBeforeDetach`.
	 */
	public detachListeners(): void
	{
		this._container.removeEventListener('mousemove', this._onAceMouseMove);
		this._container.removeEventListener('mouseup', this._onMouseUp);
		this._container.removeEventListener('mousedown', this._onMouseDown);

		if(this._aceMoveDebounceTimer)
		{
			clearTimeout(this._aceMoveDebounceTimer);
			this._aceMoveDebounceTimer = null;
		}

		if(this._globalTooltip)
		{
			this._globalTooltip.style.display = 'none';
		}
	}

	private _initAceEventHooks(): void
	{
		this._widget._editor?.on('changeSession', (e: any) =>
		{
			console.log('[ACE SESSION SWAP] New file context mounted. Re-binding tracking listeners.');

			if(this._currentBlockMarkerId !== null && e.oldSession)
			{
				e.oldSession.removeMarker(this._currentBlockMarkerId);
				this._currentBlockMarkerId = null;
			}

			editorSelf.ace?.require(["ace/mode/antlr_worker"], (antlrWorkerModule: any) =>
			{
				if(antlrWorkerModule && antlrWorkerModule.switchActiveSession)
				{
					antlrWorkerModule.switchActiveSession(e.session);
				}
			});

			// Route block tracking tasks back up to the widget context if they exist
			if(this._widget._editor)
			{
				bindBlockTrackerToSession(e.session, this._widget._editor);
				onBlockTrackerCursorChange(e.session, this._widget._editor);
			}
		});

		/*
		this._widget._editor?.on('guttermouseout', () =>
		{
			this._lastTrackedGutterRow = null;
			if(this._globalTooltip)
			{
				this._globalTooltip.style.display = 'none';
			}
		});
		*/
	}

	private _detectAceEditorEvents(event: MouseEvent): AceTrackingPayload | null
	{
		if(!this._widget._editor || !this._widget._editor.renderer) return null;

		const screenPos = this._widget._editor.renderer.screenToTextCoordinates(event.clientX, event.clientY);
		const row = screenPos.row;
		const column = screenPos.column;

		if(row === this._lastTrackedRow && column === this._lastTrackedColumn)
		{
			return this._previousAceUpdate;
		}

		this._lastTrackedRow = row;
		this._lastTrackedColumn = column;

		const session = this._widget._editor.getSession();
		const token = session.getTokenAt(row, column);
		const lineText = session.getLine(row);

		let tokenText: string | null = null;
		let tokenType: string | null = null;
		let isFunctionCall = false;

		if(token)
		{
			tokenText = token.value.trim();
			tokenType = token.type;

			const nextToken = session.getTokenAt(row, column + token.value.length);
			if(tokenType.includes('support.function') ||
				tokenType.includes('entity.name.function') ||
				(nextToken && nextToken.value.startsWith('(')))
			{
				isFunctionCall = true;
			}
		}

		let compilerError: string | null = null;
		const aceContainer = (event.target as HTMLElement).closest('.ace_editor');
		if(aceContainer)
		{
			compilerError = aceContainer.getAttribute('data-compiler-error');
		}

		// Pull active parameters safely straight from your live host widget instance definitions
		const updatePayload: AceTrackingPayload = {
			event,
			row: row + 1,
			column: column + 1,
			lineText,
			tokenText,
			tokenType,
			isFunctionCall,
			compilerError,
			id: (this._widget as any).currentOpenFileId ?? 'unknown',
			file: (this._widget as any).filePath ?? null,
		};

		if(editorSelf.statusBar)
		{
			updateAceStatus(updatePayload, this._widget._editor, editorSelf.statusBar);
		}

		this._previousAceUpdate = updatePayload;
		return updatePayload;
	}

	private _onAceMouseMove = (event: MouseEvent): void =>
	{
		if(this._aceMoveDebounceTimer) return;

		this._aceMoveDebounceTimer = window.setTimeout(() =>
		{
			this._aceMoveDebounceTimer = null;
			const target = event.target as HTMLElement;

			if(this._widget._editor && target &&
				(target === this._widget._editor.renderer.container ||
					target.parentElement === this._widget._editor.renderer.container ||
					target.closest('.ace_editor')))
			{
				this._doAceEditorMouse(event);
			}

			this._previousAceUpdate = this._detectAceEditorEvents(event);
		}, 100);
	};

	private _onMouseUp = (): void =>
	{
		const hasClass = document.body.classList.contains('dragging');

		if(!editorSelf.isModifierPressed && hasClass)
		{
			document.body.classList.remove('dragging');
		}
		if(editorSelf.isModifierPressed && !hasClass)
		{
			document.body.classList.add('dragging');
		}
	};

	private _onMouseDown = async (event: MouseEvent): Promise<void> =>
	{
		const telemetry = this._detectAceEditorEvents(event);
		if(!telemetry || !telemetry.tokenText) return;

		if(!event.ctrlKey && !event.metaKey) return;

		console.log(`Ace Intercept -> Token: ${telemetry.tokenText}, Line: ${telemetry.row}, Fn: ${telemetry.isFunctionCall}`);

		if(telemetry.isFunctionCall)
		{
			event.preventDefault();

			if(typeof (window as any).lookupFunctionDefinition === 'function')
			{
				await (window as any).lookupFunctionDefinition(telemetry.tokenText, telemetry.id);
			} else
			{
				console.log(`Ready to link function definition for: ${telemetry.tokenText}`);
			}
		}
	};

	private _doAceEditorMouse(e: MouseEvent): void
	{
		const canvasY = e.clientY;
		const row = this._widget._editor?.renderer.screenToTextCoordinates(0, canvasY).row;

		const session = this._widget._editor?.getSession();
		const allActiveAnnotations = session?.getAnnotations() || [];
		const activeErrorsOnLine = allActiveAnnotations.filter((anno) => anno.row === row);

		if(activeErrorsOnLine.length === 0)
		{
			this._globalTooltip.style.display = 'none';
			this._globalTooltip.style.opacity = '0';
			this._globalTooltip.style.zIndex = '-1';
			this._lastTrackedGutterRow = null;
			return;
		}

		if(row === this._lastTrackedGutterRow && this._globalTooltip.style.display === 'block')
		{
			return;
		}
		this._lastTrackedGutterRow = row ?? 0;

		const combinedDiagnosticText = activeErrorsOnLine.map((anno) =>
		{
			const textContent = anno.text || '';
			const prefix = anno.type === 'error' ? '❌ Error: ' : (anno.type === 'warning' ? '⚠️ Warning: ' : 'ℹ️ Info: ');
			return prefix + textContent;
		}).join('\n\n');

		this._globalTooltip.innerText = combinedDiagnosticText;
		this._globalTooltip.style.position = 'absolute';
		this._globalTooltip.style.display = 'block';
		this._globalTooltip.style.opacity = '1';
		this._globalTooltip.style.zIndex = '99999';

		const rowCoords = this._widget._editor?.renderer.textToScreenCoordinates(row ?? 0, 0);
		const gutterLayer = (this._widget._editor?.renderer as any).$gutterLayer?.element as HTMLElement;

		if(!gutterLayer) return;

		const gutterRect = gutterLayer.getBoundingClientRect();
		const absoluteGutterRight = gutterRect.right;

		const correctedLeft = absoluteGutterRight + 10;
		const rowHeight = (this._widget._editor?.renderer as any).layerConfig?.lineHeight || 19;
		const correctedTop = rowCoords?.pageY + rowHeight;

		this._globalTooltip.style.left = correctedLeft + 'px';
		this._globalTooltip.style.top = correctedTop + 'px';
	}

	private _createTooltipNode(): HTMLElement
	{
		const node = document.createElement('div');
		node.id = 'global-editor-tooltip';
		node.style.display = 'none';
		document.body.appendChild(node);
		return node;
	}
}

/**
 * Updates the global or instance status bar with active text telemetry and diagnostics.
 * @param data The tracked event payload from the mouse positioning layers.
 * @param aceEditor The active Ace editor instance to query cursor coordinates from.
 * @param statusBar The physical HTML element or widget node hosting the status bar text.
 */
export function updateAceStatus(
	data: AceTrackingPayload | null,
	aceEditor: Ace.Editor,
	statusBar: StatusBarWidget
): void
{
	if(!statusBar) return;

	if(!data)
	{
		statusBar.updateStatusItem('env-state', "Editor: Idle");
		return;
	}

	const cursor = aceEditor.getCursorPosition();
	const cursorLine = cursor.row + 1;
	const cursorCol = cursor.column + 1;

	const tokenInfo = data.tokenText
		? `Token: "${data.tokenText}" [${data.tokenType}]${data.isFunctionCall ? ' (Function Call)' : ''}, `
		: '';

	// Format error banner text smoothly across line breaks if present
	const errorInfo = data.compilerError
		? ` ⚠️  ${data.compilerError.replace(/\n/g, ' | ')}, `
		: '';

	statusBar.updateStatusItem('env-state', `Editor: Mouse: ${data.row}x${data.column}, `
		+ `Cursor: ${cursorLine}x${cursorCol}, `
		+ tokenInfo
		+ errorInfo
		+ `File: ${data.file}, ID: ${data.id}`
	);
}


let navTimer: ReturnType<typeof setTimeout> | undefined;


// TODO: fix block tracker
export function onBlockTrackerCursorChange(session: AceSession, aceEditor: Ace.Editor): void
{
	if(typeof editorSelf.historyToolbar !== "undefined" && editorSelf.historyToolbar.isNavigating)
	{
		return;
	}

	if(navTimer)
	{
		clearTimeout(navTimer);
	}

	navTimer = setTimeout(() =>
	{
		if(!session) return;

		const pos = aceEditor.getCursorPosition();
		const currentFile = typeof editorSelf.currentOpenFileId !== "undefined" ? editorSelf.currentOpenFileId : null;

		const humanRow = pos.row + 1;
		const humanCol = pos.column + 1;

		const lastPoint: NavPoint | null = typeof editorSelf.historyToolbar !== "undefined"
			? editorSelf.historyToolbar.stack[editorSelf.historyToolbar.index]
			: null;

		if(!lastPoint || lastPoint.fileId !== currentFile || Math.abs(lastPoint.row - humanRow) > 5)
		{
			if(typeof editorSelf.historyToolbar !== "undefined")
			{
				editorSelf.historyToolbar.push(currentFile, humanRow, humanCol);
			}
		}

		updateEditorLineIds(session, aceEditor);

		// Strongly type the hidden multi-layered Web Worker client inside Ace
		const activeWorker = (session.$worker as any)?.$worker;

		if(activeWorker)
		{
			activeWorker.postMessage({
				event: "calculateActiveBlockRange",
				data: { lineNumber: humanRow }
			});

			activeWorker.postMessage({
				event: "getFoldRegions",
				data: { fileId: session.workspaceFileId ?? null }
			});
		}

	}, 150);
}


export function bindBlockTrackerToSession(session: Ace.EditSession, editor: Ace.Editor)
{
	if(!session || !session.selection) return;

	// Remove any pre-existing tracker handle on this session to prevent duplicate fire leaks
	session.selection.off("changeCursor", onBlockTrackerCursorChange.bind(null, session, editor));

	// Bind the execution frame cleanly
	session.selection.on("changeCursor", onBlockTrackerCursorChange.bind(null, session, editor));
}



export function updateEditorLineIds(session: AceSession, aceEditor: Ace.Editor)
{

	for(let cn of document.body.classList)
	{
		if(cn.startsWith('line-'))
		{
			document.body.classList.remove(cn);
		}
	}

	for(let cn of document.body.classList)
	{
		if(cn.startsWith('error-')
			|| cn.startsWith('warning-')
		)
		{
			document.body.classList.remove(cn);
		}
	}


	for(let cn of document.body.classList)
	{
		if(cn.startsWith('hash-'))
		{
			document.body.classList.remove(cn);
		}
	}


	let currentLine = aceEditor.getCursorPosition();
	document.body.classList.add('line-' + (currentLine.row + 1));
	document.body.classList.add('hash-' + (editorSelf.previousHashLineNumber || 0));
	if(currentLine.row + 1 === editorSelf.previousHashLineNumber)
		document.body.classList.add('line-match');
	if(session.getAnnotations)
	{
		var matches = session.getAnnotations().filter(function (ann)
		{
			return ann.row === currentLine.row;
			//&& ann.type === 'error';
		});
		if(matches.length > 0)
		{
			document.body.classList.add(matches[0].type + '-' + currentLine.row);
		}
	}
}

