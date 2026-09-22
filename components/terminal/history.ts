import type { Terminal } from '@xterm/xterm';
import type { CompletionState } from './widget-types';

export interface TerminalState
{
	historyIndex: number;
	currentLine: string;
	cursorPosition: number;
	completionState?: CompletionState;
}

export class TerminalHistoryManager
{
	private static instance: TerminalHistoryManager;
	private commandHistory: string[] = [];
	private states = new Map<Terminal, TerminalState>();

	private readonly PROMPT = "> ";
	private readonly MAX_HISTORY_LENGTH = 20;
	private readonly LINES_TO_SAVE = 1000;

	private constructor()
	{
		this.loadHistory();

		// Listen for changes from other tabs, splits, or windows
		window.addEventListener('storage', (e) =>
		{
			if(e.key === 'history')
			{
				this.loadHistory();
			}
		});
	}

	public static getInstance(): TerminalHistoryManager
	{
		if(!TerminalHistoryManager.instance)
		{
			TerminalHistoryManager.instance = new TerminalHistoryManager();
		}
		return TerminalHistoryManager.instance;
	}

	private loadHistory(): void
	{
		try
		{
			const stored = localStorage.getItem('history');
			this.commandHistory = stored ? JSON.parse(stored) : [];
		} catch(e)
		{
			console.error('Failed to load command history from localStorage:', e);
			this.commandHistory = [];
		}
	}

	/**
	 * Retrieves or initializes unique ephemeral input states for an attached terminal instance.
	 */
	public getState(term: Terminal): TerminalState
	{
		let state = this.states.get(term);
		if(!state)
		{
			state = {
				historyIndex: -1,
				currentLine: '',
				cursorPosition: 0
			};
			this.states.set(term, state);
		}
		return state;
	}

	/**
	 * Cleans up references when a terminal widget is closed or disposed.
	 */
	public unregister(term: Terminal): void
	{
		this.states.delete(term);
	}

	public writePrompt(term: Terminal): void
	{
		term.write(`\n\r${this.PROMPT}`);
	}

	public getLastLineIsInput(term: Terminal): boolean
	{
		const buffer = term.buffer.active;
		const endRow = buffer.baseY + buffer.cursorY;
		const startRow = endRow - 3;

		for(let i = startRow; i <= endRow; i++)
		{
			const line = buffer.getLine(i);
			if(line)
			{
				const lineStr = line.translateToString(true);
				if(lineStr === this.PROMPT || lineStr === this.PROMPT.trim() || lineStr.trim() === '>')
				{
					return true;
				}
			}
		}
		return false;
	}

	public getInternalTerminalLog(term: Terminal): string[]
	{
		const lines: string[] = [];
		const buffer = term.buffer.active;
		const endRow = buffer.baseY + buffer.cursorY;
		const startRow = Math.max(0, endRow - this.LINES_TO_SAVE);

		for(let i = startRow; i <= endRow; i++)
		{
			const line = buffer.getLine(i);
			if(line)
			{
				lines.push(line.translateToString(true));
			}
		}
		return lines;
	}

	public getInternalTerminalLogColored(term: Terminal): string[]
	{
		const lines: string[] = [];
		const buffer = term.buffer.active;
		const endRow = buffer.baseY + buffer.cursorY;
		const startRow = Math.max(0, endRow - this.LINES_TO_SAVE);

		for(let i = startRow; i <= endRow; i++)
		{
			const line = buffer.getLine(i);
			if(line)
			{
				let lineString = '';
				let currentFg = -1;
				let currentBg = -1;

				for(let x = 0; x < line.length; x++)
				{
					const cell = line.getCell(x);
					if(!cell) continue;

					const char = cell.getChars();
					const fg = cell.getFgColor();
					const bg = cell.getBgColor();

					if(fg !== currentFg || bg !== currentBg)
					{
						let ansiSequence = '\x1b[0m';

						if(cell.isFgPalette() || cell.isFgRGB())
						{
							ansiSequence += `\x1b[38;5;${fg}m`;
						} else if(fg >= 0 && fg < 16)
						{
							ansiSequence += `\x1b[${fg < 8 ? fg + 30 : fg + 82}m`;
						}

						if(cell.isBgPalette() || cell.isBgRGB())
						{
							ansiSequence += `\x1b[48;5;${bg}m`;
						} else if(bg >= 0 && bg < 16)
						{
							ansiSequence += `\x1b[${bg < 8 ? bg + 40 : bg + 92}m`;
						}

						lineString += ansiSequence;
						currentFg = fg;
						currentBg = bg;
					}

					lineString += char;
				}

				if(currentFg !== -1 || currentBg !== -1)
				{
					lineString += '\x1b[0m';
				}

				const cleanLine = lineString.replace(/\s+(\x1b\[0m)?$/, '$1');
				lines.push(cleanLine);
			}
		}
		return lines;
	}

	public updateLineFromHistory(term: Terminal, specificValue: string | null = null): void
	{
		const state = this.getState(term);

		term.write('\r\x1b[K\x1b[A');
		this.writePrompt(term);

		state.currentLine = specificValue !== null ? specificValue : (this.commandHistory[state.historyIndex] || '');
		term.write(state.currentLine);
		state.cursorPosition = state.currentLine.length;
	}

	public commitLine(term: Terminal, lineText: string): string
	{
		const trimmed = lineText.trim();
		if(trimmed.length > 0)
		{
			this.commandHistory.push(lineText);

			if(this.commandHistory.length > this.MAX_HISTORY_LENGTH)
			{
				this.commandHistory.splice(0, this.commandHistory.length - 10);
			}

			localStorage.setItem('history', JSON.stringify(this.commandHistory));
		}

		const state = this.getState(term);
		const completedLine = state.currentLine;

		state.historyIndex = -1;
		state.currentLine = '';
		state.cursorPosition = 0;

		return completedLine;
	}

	public navigateHistory(term: Terminal, direction: 'up' | 'down'): void
	{
		if(this.commandHistory.length === 0) return;
		const state = this.getState(term);

		if(direction === 'up')
		{
			if(state.currentLine.trim().length > 0)
			{
				this.commandHistory[state.historyIndex] = state.currentLine;
			}
			if(state.historyIndex === -1)
			{
				state.historyIndex = this.commandHistory.length - 1;
			} else if(state.historyIndex > 0)
			{
				state.historyIndex--;
			}
			this.updateLineFromHistory(term);
		} else if(direction === 'down')
		{
			if(state.historyIndex !== -1)
			{
				if(state.currentLine.trim().length > 0)
				{
					this.commandHistory[state.historyIndex] = state.currentLine;
				}
				if(state.historyIndex < this.commandHistory.length - 1)
				{
					state.historyIndex++;
					this.updateLineFromHistory(term);
				} else
				{
					state.historyIndex = -1;
					this.updateLineFromHistory(term, '');
				}
			}
		}
	}

	public changeCursorPosition(term: Terminal, col: number): void
	{
		const state = this.getState(term);
		const promptLength = this.PROMPT.length;
		let newPos = col - promptLength;

		newPos = Math.max(0, Math.min(newPos, state.currentLine.length));
		state.cursorPosition = newPos;

		term.write(`\x1b[G\x1b[${promptLength + state.cursorPosition}C`);
	}

	public getHistory(): string[]
	{
		return this.commandHistory;
	}
}

