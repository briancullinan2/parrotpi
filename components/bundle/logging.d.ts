import type { DockPanel, Widget } from "@lumino/widgets";
import type { TerminalLogEntry } from "../terminal/widget-types";
import type { AceSession } from "../editor/widget";
import type { specialWrite, terminalWrite } from "./logging";
import type { ApiWindow } from "../bundle/worker.d";

// --- TYPES & INTERFACES ---
export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export type SourceMetadata = [
	category: string,
	...trailingFilesAndFunc: string[],
	rawFileName: string,
	rawFilePath: string
];

export interface ParsedStackFrame
{
	func: string;
	file: string;
}

export type CalleeInfo = [
	func: string,
	trailingFiles: string[],
	category: string,
	rawFile: string
];


export interface LoggingWindow extends ApiWindow
{
	lineCount?: number;
	originalConsole?: {
		log: typeof console.log,
		warn: typeof console.warn,
		error: typeof console.error,
		info: typeof console.info;
	};

	compilerDiagnostics?: {
		log: (msg: string) => void;
		clear: () => void;
		getBridge: () => {
			refreshActiveEditorView: (session: AceSession) => void;
		};
	};

	terminalLog?: TerminalLogEntry[];
	terminalWrite?: typeof terminalWrite;
	CWD?: string;
	runningCommand?: boolean;
	detachedConsole?: boolean;
	alreadyWroteDetached?: boolean;
	specialWrite?: typeof specialWrite;
}

declare var self: Window & LoggingWindow & typeof globalThis;
