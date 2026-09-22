import type { Terminal } from "@xterm/xterm";
import type { TerminalWidget } from './widget';
import type { TerminalEventManager } from "./events";

/**
 * Interface tracking an active xterm instance context inside our static pool.
 */
export interface IPooledTerminal
{
	id: string;
	term: Terminal;
	container: HTMLDivElement;
	resizeObserver: ResizeObserver;
	activeOwner: TerminalWidget | null;
	events?: TerminalEventManager;
	searchContainer?: HTMLDivElement;
	searchInput?: HTMLInputElement;
	searchObserver?: ResizeObserver;
}

export interface TerminalLogEntry
{
	render: string;
	source: string[] | string;
	text: string;
	index: number;
	line: number;
}

export interface CompletionState {
    lastTabTime: number;
    candidates: string[];
    candidateIndex: number;
    originalTokenValue: string;
    argnum: number;
}
