import type { IDisposable, Terminal } from '@xterm/xterm';
import { TerminalHistoryManager } from './history'; // Adjust path accordingly
import type { IPooledTerminal } from './widget-types';
import { FILE_NAME_REGEX, SearchTerminal } from './search';
import { clearCompletionState, handleTabAutocomplete } from './commands-complete';
import { renderState } from './render';
import type { TerminalEvents } from './widget.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';


const termEventSelf: TerminalEvents & GlobalToolbarsWindow = self as unknown as any;


// --- Types & Structural Interfaces ---
export interface ExtractedFile
{
	path: string | null;
	filename: string | null;
	line: number | null;
	index: number;
	text: string;
	isFallback: boolean;
}

export interface TerminalEventPayload
{
	event: MouseEvent | null;
	x: number;
	y: number;
	activeRow: number;
	col: number;
	row: number;
	lineText: string;
	filePath: string | null;
	lineNumber: number | null;
	fileIndex: number;
	isFallback: boolean;
	history: number | null;
}


export const LINES_TO_SAVE = 1000;


export class TerminalEventManager
{
	private pooledCtx: IPooledTerminal;
	private container: HTMLElement;
	public historyManager: TerminalHistoryManager;

	// Ephemeral instance trackers
	private debounceTerminalMouse: ReturnType<typeof setTimeout> | null = null;
	private previousUpdate: TerminalEventPayload | null = null;
	private isDragging = false;
	private dragDownOffset = 0;

	// Explicit tracking metrics mapped to global UI states
	private targetStartX = 0;
	private targetStartY = 0;
	private renderWidth = 20; // Default spatial placeholder bounds
	public terminalStartupBegun = false;

	// Event cleanup references
	private listeners: IDisposable[] = [];

	constructor(pooledCtx: IPooledTerminal, container: HTMLElement)
	{
		this.pooledCtx = pooledCtx;
		this.container = container;
		this.historyManager = TerminalHistoryManager.getInstance();

		this.init();
	}

	private init(): void
	{
		// Wire pointer and container bindings
		this.container.addEventListener('mousemove', this.handleMouseMove);
		this.container.addEventListener('mousedown', this.handleMouseDown);
		this.container.addEventListener('focus', TerminalEventManager.refreshBlinkerState.bind(this, this.pooledCtx.term));

		window.addEventListener('mouseup', this.handleMouseUp);
		window.addEventListener('focus', TerminalEventManager.refreshBlinkerState.bind(this, this.pooledCtx.term));
		document.addEventListener('visibilitychange', TerminalEventManager.refreshBlinkerState.bind(this, this.pooledCtx.term));

		// Core terminal hooks
		this.listeners.push(this.pooledCtx.term.onScroll(() => this.debounceTerminalStatus(null)));
		this.listeners.push(this.pooledCtx.term.onRender(() => this.ensureTerminalStarted()));

		this.pooledCtx.term.attachCustomKeyEventHandler((arg) => this.handleCustomKeyEvent(arg));
		this.listeners.push(this.pooledCtx.term.onData((data) => this.handleRawStreamData(data)));
	}

	public dispose(): void
	{
		this.container.removeEventListener('mousemove', this.handleMouseMove);
		this.container.removeEventListener('mousedown', this.handleMouseDown);
		this.container.removeEventListener('focus', TerminalEventManager.refreshBlinkerState.bind(this, this.pooledCtx.term));

		window.removeEventListener('mouseup', this.handleMouseUp);
		window.removeEventListener('focus', TerminalEventManager.refreshBlinkerState.bind(this, this.pooledCtx.term));
		document.removeEventListener('visibilitychange', TerminalEventManager.refreshBlinkerState.bind(this, this.pooledCtx.term));

		this.listeners.forEach(l => l.dispose());
		this.historyManager.unregister(this.pooledCtx.term);
		if(this.debounceTerminalMouse) clearTimeout(this.debounceTerminalMouse);
	}

	private extractFiles(col: number, row: number): ExtractedFile[]
	{
		const buffer = this.pooledCtx.term.buffer.active;
		const offsets = [-2, -1, 0, 1, 2];

		let unifiedText = '';
		const charMap: Array<{ col: number; row: number; }> = [];
		let absoluteMouseIndex = -1;

		offsets.forEach(off =>
		{
			const currentRowIdx = row + off;
			const line = buffer.getLine(currentRowIdx);
			if(!line) return;

			const lineStr = line.translateToString(false);

			for(let x = 0; x < lineStr.length; x++)
			{
				if(off === 0 && x === col)
				{
					absoluteMouseIndex = unifiedText.length;
				}

				unifiedText += lineStr[x];
				charMap.push({ col: x, row: currentRowIdx });
			}

			if(line.isWrapped)
			{
				if(off === 0 && col >= lineStr.length)
				{
					absoluteMouseIndex = unifiedText.length;
				}
			} else
			{
				if(off === 0 && col >= lineStr.length)
				{
					absoluteMouseIndex = unifiedText.length;
				}
				unifiedText += '\n';
				charMap.push({ col: lineStr.length, row: currentRowIdx });
			}
		});

		let fileMatch: RegExpExecArray | null;
		FILE_NAME_REGEX.lastIndex = 0;

		while((fileMatch = FILE_NAME_REGEX.exec(unifiedText)) !== null)
		{
			const startIdx = fileMatch.index;
			const endIdx = startIdx + fileMatch[0].length;

			if(absoluteMouseIndex >= startIdx && absoluteMouseIndex < endIdx)
			{
				const fullPath = fileMatch[1];
				const lineNo = fileMatch[2] || fileMatch[3] || fileMatch[4];
				const mappedStart = charMap[startIdx] || { col: 0, row };

				return [{
					path: fullPath,
					filename: fullPath ? fullPath.split('/').pop() || null : null,
					line: lineNo ? parseInt(lineNo, 10) : null,
					index: mappedStart.col,
					text: fileMatch[0],
					isFallback: false
				}];
			}
		}

		const baselineText = buffer.getLine(row)?.translateToString(true)?.trim() || "";
		return [{
			path: null,
			filename: null,
			line: null,
			index: 0,
			text: baselineText,
			isFallback: true
		}];
	}

	private updateTerminalStatus(
		col: number,
		row: number,
		activeRow: number,
		filePath: string | null,
		lineNumber: number | null,
		isFallback: boolean,
		historyIndexValue: number | null
	): void
	{
		if(!termEventSelf.statusBar) return;

		const buffer = this.pooledCtx.term.buffer.active;
		const startRow = buffer.viewportY;
		const endRow = startRow + this.pooledCtx.term.rows;

		// Contextually locate active instance buffers safely outside the root loop
		const currentCursorPos = this.historyManager.getHistory().length > 0 ? activeRow : 0;

		termEventSelf.statusBar.updateStatusItem('env-state',
			`Terminal: Mouse: ${col}x${row}, `
			+ `Cursor: ${currentCursorPos}x${activeRow}, `
			+ `Viewport: ${startRow}x${endRow}, `
			+ (historyIndexValue !== null && historyIndexValue !== -1 ? `History: ${historyIndexValue}, ` : '')
			+ (filePath && !isFallback ? (lineNumber !== null ? `File: ${filePath}, Line: ${lineNumber}` : `File: ${filePath}`) : '')
		);
	}

	private detectTerminalEvents(event: MouseEvent | null, x?: number, y?: number, updateStatus = true): TerminalEventPayload
	{
		const rect = this.container.getBoundingClientRect();
		const finalX = event ? (x !== undefined ? x : (event.clientX - rect.left)) : 0;
		const finalY = event ? (y !== undefined ? y : (event.clientY - rect.top)) : 0;

		// Access internal dimensions structures securely
		const coreTerm = (this.pooledCtx.term as any)._core;
		const dims = coreTerm._renderService.dimensions.css.cell;

		const col = Math.floor(finalX / dims.width);
		const row = Math.floor(finalY / dims.height) + this.pooledCtx.term.buffer.active.viewportY;
		const activeRow = this.pooledCtx.term.buffer.active.baseY + this.pooledCtx.term.buffer.active.cursorY;

		const files = this.extractFiles(col, row);
		const lineText = files[0]?.text?.trim() || this.pooledCtx.term.buffer.active.getLine(row)?.translateToString(true) || "";

		let filePath: string | null = null;
		let lineNumber: number | null = null;
		let isFallback = true;
		let fileIndex = 0;

		if(files.length > 0)
		{
			filePath = files[0].path;
			lineNumber = files[0].line;
			fileIndex = files[0].index;
			isFallback = files[0].isFallback;
		}

		let historyIndexMatch: number | null = null;

		if(lineText)
		{
			const cmdHistory = [...this.historyManager.getHistory()];
			const trimmedLine = lineText.trim();

			if(trimmedLine.length > 0)
			{
				// Find matching vectors directly out of unified storage stacks
				for(let i = cmdHistory.length - 1; i >= 0; i--)
				{
					const trimmedCmd = cmdHistory[i].trim();
					if(trimmedCmd.length > 0 && (trimmedCmd === trimmedLine || trimmedCmd.includes(trimmedLine) || trimmedLine.includes(trimmedCmd)))
					{
						historyIndexMatch = i;
						break;
					}
				}
			}
		}

		if(updateStatus)
		{
			this.updateTerminalStatus(col, row, activeRow, filePath, lineNumber, isFallback, historyIndexMatch);
		}

		return {
			event, x: finalX, y: finalY, activeRow, col, row,
			lineText, filePath, lineNumber, fileIndex,
			isFallback, history: historyIndexMatch
		};
	}

	private handleMouseMove = (event: MouseEvent): void =>
	{
		this.debounceTerminalStatus(event);
	};

	private debounceTerminalStatus(event: MouseEvent | null): boolean
	{
		const rect = this.container.getBoundingClientRect();
		const currentX = event ? event.clientX - rect.left : 0;
		const currentY = event ? event.clientY - rect.top : 0;

		if(this.previousUpdate && event)
		{
			this.previousUpdate.event = event;
			this.previousUpdate.x = currentX;
			this.previousUpdate.y = currentY;
		}

		// TODO: camera + remote control gimble? light bulb cameras?
		//if(event && (termEventSelf.isModifierPressed || document.pointerLockElement !== null)
		//	&& typeof termEventSelf.moveLookLocked === 'function')
		//{
		//	termEventSelf.moveLookLocked(event.movementX, event.movementY);
		//}

		if(this.isDragging && event)
		{
			event.preventDefault();
			event.stopPropagation();
			const coreTerm = (this.pooledCtx.term as any)._core;
			const dims = coreTerm._renderService.dimensions.css.cell;
			const col = Math.floor(currentX / dims.width);
			const row = Math.floor(currentY / dims.height) + this.pooledCtx.term.buffer.active.viewportY;
			this.targetStartY = row;
			this.targetStartX = col - this.dragDownOffset;
			renderState.renderMoved = true;
			return false;
		}

		if(this.debounceTerminalMouse) return true;

		this.debounceTerminalMouse = setTimeout(() =>
		{
			if(this.pooledCtx.searchInput)
			{
				SearchTerminal.scanVisibleViewport(this.pooledCtx, this.pooledCtx.searchInput.value);
			}

			if(!this.previousUpdate && !event)
			{
				// No operational vector trace
			} else if(!this.previousUpdate)
			{
				this.previousUpdate = this.detectTerminalEvents(event, currentX, currentY);
			} else
			{
				this.previousUpdate = this.detectTerminalEvents(this.previousUpdate.event, this.previousUpdate.x, this.previousUpdate.y);
			}

			this.debounceTerminalMouse = null;
		}, 200);

		return true;
	}

	private handleMouseDown = async (event: MouseEvent): Promise<boolean> =>
	{
		event.preventDefault();
		const rect = this.container.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const data = this.detectTerminalEvents(event, x, y);

		if(this.pooledCtx.activeOwner?.filterId === 'soft')
		{
			if(data.row === this.targetStartY && data.col > this.targetStartX && data.col < this.targetStartX + this.renderWidth)
			{
				this.isDragging = true;
				this.dragDownOffset = data.col - this.targetStartX;
				document.body.classList.add('dragging');
			}
			if(data.row < this.pooledCtx.term.buffer.active.viewportY + (this.pooledCtx.term.rows / 2))
			{
				return false;
			}
		}

		if(data.filePath && !data.isFallback && event.button === 0)
		{
			await termEventSelf.FileManager?.navigateFile(data.filePath, void 0, void 0, void 0, data.lineNumber);

			return false;
		}

		if(!event.ctrlKey && !event.metaKey && !termEventSelf.isModifierPressed) return false;

		// Command Prompt Input Locus Shifting mapped via context routing
		if(data.row === data.activeRow)
		{
			this.historyManager.changeCursorPosition(this.pooledCtx.term, data.col);
		} else if(data.history !== null && data.history !== -1)
		{
			// Fetch internal target frame state indicators cleanly
			const state = (this.historyManager as any).getState(this.pooledCtx.term);
			state.historyIndex = data.history;
			this.historyManager.updateLineFromHistory(this.pooledCtx.term);
		}

		return false;
	};

	private handleMouseUp(): void
	{
		this.isDragging = false;
		document.body.classList.remove('dragging');
	};

	private handleCustomKeyEvent(arg: KeyboardEvent): boolean
	{
		this.debounceTerminalStatus(null);

		if(arg.type === "keydown" || arg.type === "keyup")
		{
			if(typeof termEventSelf.updateModifierPressed === 'function')
			{
				termEventSelf.updateModifierPressed(arg);
			}
		}

		if(arg.type === "keydown")
		{

			const state = this.historyManager.getState(this.pooledCtx.term);

			if(arg.key === "Tab")
			{
				return handleTabAutocomplete(arg, state.currentLine, this.pooledCtx);
			} else
			{
				clearCompletionState(state);
			}

			// --- Ctrl+F: Focus Search Box ---
			if(termEventSelf.isModifierPressed && arg.code === "KeyF")
			{
				arg.preventDefault?.();
				const searchTerminal = document.getElementById('search-terminal') as HTMLInputElement | null;
				if(searchTerminal)
				{
					searchTerminal.focus();
					const selection = this.pooledCtx.term.getSelection();
					if(selection) searchTerminal.value = selection;
					if(searchTerminal.value.length > 0)
					{
						SearchTerminal.executeFindQuery(this.pooledCtx);
					}
				}
			}

			// --- Ctrl+C: Copy / Cancel ---
			if(termEventSelf.isModifierPressed && arg.code === "KeyC")
			{
				const selection = this.pooledCtx.term.getSelection();
				if(selection)
				{
					navigator.clipboard.writeText(selection);
					return false;
				}
				this.pooledCtx.term.write('\n\rCTRL+C');
				termEventSelf.TERMINATE = true;
				if((window as any).building) this.pooledCtx.term.write('\n\rStopping build...');
				this.historyManager.writePrompt(this.pooledCtx.term);
				state.cursorPosition = 0;
				state.currentLine = '';
			}

			// --- Backspace: Inline Redraw Splicer ---
			if(arg.code === "Backspace")
			{
				arg.preventDefault?.();

				if(state.cursorPosition > 0)
				{
					const leftSide = state.currentLine.slice(0, state.cursorPosition - 1);
					const rightSide = state.currentLine.slice(state.cursorPosition);

					state.currentLine = leftSide + rightSide;
					state.cursorPosition = state.cursorPosition - 1;

					if(this.pooledCtx.term.buffer.active.cursorX === 0)
					{
						this.pooledCtx.term.write(`\x1b[A\x1b[${this.pooledCtx.term.cols}C`);
					} else
					{
						this.pooledCtx.term.write('\b');
					}

					this.pooledCtx.term.write('\x1b[s');
					this.pooledCtx.term.write(rightSide + '\x1b[K');
					this.pooledCtx.term.write('\x1b[u');
				}
				return false;
			}

			// --- Ctrl+V: Paste Filter Loop ---
			if(termEventSelf.isModifierPressed && arg.code === "KeyV")
			{
				arg.preventDefault?.();

				navigator.clipboard.readText().then(text =>
				{
					if(text)
					{
						const filtered = text.split('').filter(c =>
							c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e
						).join('');

						state.cursorPosition = state.cursorPosition + filtered.length;
						state.currentLine = state.currentLine + filtered;
						this.pooledCtx.term.write(filtered);
					}
				}).catch(err => console.error('Paste failed: ', err));
				return false;
			}
		}
		return true;
	}

	private async handleRawStreamData(data: string): Promise<void>
	{
		// Game Engine Vector Controls Interception
		if(typeof (window as any).pressed !== 'undefined' && data.length === 1)
		{
			const lowerChar = data.toLowerCase();

			if(['w', 'a', 's', 'd', ' '].includes(lowerChar))
			{
				let targetKeyCode = lowerChar === ' ' ? 32 : lowerChar.toUpperCase().charCodeAt(0);

				(window as any).pressed[targetKeyCode] = true;
				const selfRef = self as any;
				selfRef.terminalTimers = selfRef.terminalTimers || {};
				clearTimeout(selfRef.terminalTimers[targetKeyCode]);

				selfRef.terminalTimers[targetKeyCode] = setTimeout(() =>
				{
					(window as any).pressed[targetKeyCode] = false;
				}, 120);

				//if(lowerChar === ' ' && typeof termEventSelf.playerMover !== 'undefined')
				//{
				//	termEventSelf.playerMover.jump();
				//}
				return;
			}
		}

		const state = (this.historyManager as any).getState(this.pooledCtx.term);

		switch(data)
		{
			case '\r': // Enter / Return
				let committedCommand = '';

				if(state.currentLine.trim().length > 0)
				{
					committedCommand = this.historyManager.commitLine(this.pooledCtx.term, state.currentLine);

					if(typeof termEventSelf.terminalWrite === 'function')
					{
						termEventSelf.terminalWrite(committedCommand + '\n\r', 'user-input', true);
					}
				} else
				{
					this.historyManager.commitLine(this.pooledCtx.term, '');
				}

				try
				{
					//window.lastNewLine = true;
					this.pooledCtx.term.write('\n\r');

					if(typeof termEventSelf.handleCommand === 'function')
					{
						await termEventSelf.handleCommand(committedCommand, this.pooledCtx.term);
					}
				} catch(e: any)
				{
					if(typeof termEventSelf.terminalWrite === 'function')
					{
						termEventSelf.terminalWrite(e.toString() + '\r\n' + (e.stack || e.stacktrace || '') + '\r\n');
					}
				}

				this.historyManager.writePrompt(this.pooledCtx.term);
				break;

			case '\u001b[A': // Up Arrow
				this.historyManager.navigateHistory(this.pooledCtx.term, 'up');
				break;

			case '\u001b[B': // Down Arrow
				this.historyManager.navigateHistory(this.pooledCtx.term, 'down');
				break;

			case '\u001b[D': // Left Arrow
				if(state.cursorPosition > 0)
				{
					state.cursorPosition = state.cursorPosition - 1;
					this.pooledCtx.term.write('\u001b[D');
				}
				break;

			case '\u001b[C': // Right Arrow
				if(state.cursorPosition < state.currentLine.length)
				{
					state.cursorPosition = state.cursorPosition + 1;
					this.pooledCtx.term.write('\u001b[C');
				}
				break;

			case '\u001b[H': // Home
			case '\u001bOH':
				if(state.cursorPosition > 0)
				{
					this.pooledCtx.term.write(`\u001b[${state.cursorPosition}D`);
					state.cursorPosition = 0;
				}
				break;

			case '\u001b[F': // End
			case '\u001bOF':
				if(state.cursorPosition < state.currentLine.length)
				{
					this.pooledCtx.term.write(`\u001b[${state.currentLine.length - state.cursorPosition}C`);
					state.cursorPosition = state.currentLine.length;
				}
				break;

			case '\u001b[5~': // Page Up
				this.pooledCtx.term.scrollLines(-Math.floor(this.pooledCtx.term.rows / 2));
				break;

			case '\u001b[6~': // Page Down
				this.pooledCtx.term.scrollLines(Math.floor(this.pooledCtx.term.rows / 2));
				break;

			default: // Standard Type Splicing Pass
				if(data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7e))
				{
					const leftSide = state.currentLine.slice(0, state.cursorPosition);
					const rightSide = state.currentLine.slice(state.cursorPosition);

					state.currentLine = leftSide + data + rightSide;
					state.cursorPosition = state.cursorPosition + data.length;

					if(rightSide.length === 0)
					{
						this.pooledCtx.term.write(data);
					} else
					{
						this.pooledCtx.term.write(data + rightSide);
						this.pooledCtx.term.write(`\x1b[${rightSide.length}D`);
					}
				}
		}
		this.debounceTerminalStatus(null);
	}

	// --- Placeholder Fallbacks for External Execution Methods ---
	public static refreshBlinkerState = (term: Terminal): void =>
	{
		if(document.visibilityState !== 'visible') return;

		term.focus();
		const core = (term as any)._core;
		if(!term || !core) return;

		if(core._cursorBlinkContext)
		{
			core._cursorBlinkContext.restartInterval();
		}

		if(core.renderService)
		{
			core.renderService.refreshRows(0, term.rows - 1);
		} else if(term.refresh)
		{
			term.refresh(0, term.rows - 1);
		}
	};


	terminalHasValidLayout = () =>
	{
		if(!this.pooledCtx.activeOwner) return false;
		if(this.pooledCtx.container.clientWidth === 0 || this.pooledCtx.container.clientHeight === 0) return false;

		const core = (this.pooledCtx.term as any)._core;
		if(!core) return false;

		// The panel is visible now; force xterm to (re)measure the font if it
		// hasn't yet, since it skips measuring while display:none.
		if(core._charSizeService && !core._charSizeService.hasValidSize)
		{
			core._charSizeService.measure();
		}

		const dims = core._renderService && core._renderService.dimensions;
		return !!(dims && dims.css.cell.width > 0 && dims.css.cell.height > 0);
	};


	private ensureTerminalStarted = (): void =>
	{
		if(this.terminalStartupBegun) return;
		if(!this.terminalHasValidLayout()) return;
		this.terminalStartupBegun = true;
		this.pooledCtx.activeOwner?.syncTerminalState();
	};

}

