/// <reference path="./logging.d.ts" />

import type { TerminalWidget } from '../terminal/widget';
import type { SourceMetadata, ParsedStackFrame, CalleeInfo, LoggingWindow } from './logging.d';
import type { LuminoLayoutWindow } from './lumino.d';

const loggingSelf: LoggingWindow & LuminoLayoutWindow = self as unknown as any;

export const LINES_TO_SAVE = 1000;


// --- CONSTANTS & CONFIGURATION ---
const colors: Record<string, string> = {
	reset: "\x1b[0m",
	log: "\x1b[32m",   // Green
	warn: "\x1b[33m",  // Yellow
	error: "\x1b[31m", // Red
	info: "\x1b[36m",  // Cyan
	gray: "\x1b[90m"   // Gray for timestamps/meta
};

loggingSelf.lineCount = 0;
let lastPartialLine = '';

const PIPELINE_CATEGORIES: Record<string, string> = {
	'make': 'build',
	'compiler': 'build',
	'linker': 'build',
	'github': 'network',
	'p2p': 'network',
	'worker': 'worker',
	'shared': 'build'
};

const originalConsole = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	info: console.info.bind(console)
};

loggingSelf.originalConsole = originalConsole;

// --- CORE UTILITIES ---

/**
 * Safely inspects and extracts properties from complex engine objects,
 * walking up prototype chains without invoking dangerous getters.
 */
export function rebuildComplexObjectAsText(
	obj: unknown,
	maxDepth: number = 3,
	currentDepth: number = 0,
	cache: Set<unknown> = new Set()
): string
{
	if(obj === null || obj === undefined) return String(obj);
	if(typeof obj !== 'object' && typeof obj !== 'function') return String(obj);

	// Prevent infinite cyclic loops
	if(cache.has(obj)) return '[Circular]';
	cache.add(obj);

	if(currentDepth >= maxDepth) return '[Max Depth Reached]';

	// Handle array configurations immediately
	if(Array.isArray(obj))
	{
		if(obj.length === 0) return '[]';
		return '[' + obj.map(item => rebuildComplexObjectAsText(item, maxDepth, currentDepth + 1, cache)).join(', ') + ']';
	}

	const lines: string[] = [];
	const targetObj = obj as Record<string, unknown>;
	const className = targetObj.constructor ? targetObj.constructor.name : 'Object';

	let currentTarget: object | null = targetObj;
	const visitedProps = new Set<string>();

	while(currentTarget && currentTarget !== Object.prototype)
	{
		const props = Object.getOwnPropertyNames(currentTarget);

		for(const prop of props)
		{
			if(visitedProps.has(prop)) continue;
			visitedProps.add(prop);

			try
			{
				const descriptor = Object.getOwnPropertyDescriptor(currentTarget, prop);

				// CRITICAL: If it's an active getter, do NOT invoke it
				if(descriptor && descriptor.get && !descriptor.value)
				{
					lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: [Getter]`);
					continue;
				}

				const val = targetObj[prop];

				if(typeof val === 'function')
				{
					// Omit functions cleanly
				} else if(typeof val === 'object' && val !== null)
				{
					lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: ${rebuildComplexObjectAsText(val, maxDepth, currentDepth + 1, cache)}`);
				} else
				{
					lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: ${String(val)}`);
				}
			} catch(e)
			{
				const errMessage = e instanceof Error ? e.message : String(e);
				lines.push(`${'  '.repeat(currentDepth + 1)}${prop}: [Unreadable Property: ${errMessage}]`);
			}
		}
		currentTarget = Object.getPrototypeOf(currentTarget);
	}

	cache.delete(obj);

	if(lines.length === 0) return `${className} {}`;
	return `${className} {\n${lines.join('\n')}\n${'  '.repeat(currentDepth)}}`;
}

export function formatMessageItem(arg: unknown): string
{
	if(typeof arg === 'string')
	{
		return arg.trim();
	}

	if(arg instanceof Error)
	{
		return `${arg.name}: ${arg.message}\n\r${arg.stack || ''}\n\r[Context State Dump]:\n\r${rebuildComplexObjectAsText(arg)}`;
	}

	if(typeof arg === 'object' && arg !== null)
	{
		const obj = arg as Record<string, unknown>;
		if(Object.keys(obj).length === 0)
		{
			return ((obj.name as string) || obj.constructor.name || typeof arg) + ' {empty}';
		}

		try
		{
			const stringifyCache = new Set<unknown>();
			return ((obj.name as string) || obj.constructor.name || typeof arg) + ' ' + JSON.stringify(arg, (key, value) =>
			{
				if(typeof value === 'object' && value !== null)
				{
					if(stringifyCache.has(value)) return '[Circular]';
					stringifyCache.add(value);
				}
				return value;
			}, 4);
		} catch(jsonCrash)
		{
			const errMessage = jsonCrash instanceof Error ? jsonCrash.message : String(jsonCrash);
			return `[Rebuilt Object Asset Dump due to serialization crash: ${errMessage}]\n` + rebuildComplexObjectAsText(arg);
		}
	}

	return String(arg);
}

export const formatMessage = (level: string, args: unknown[]): string =>
{
	const timestamp = new Date().toLocaleTimeString();
	const LOCAL_PREAMBLE = level.includes('\x1b')
		? level
		: `${colors[level] || colors.gray}[${level.toUpperCase()}]${colors.reset} `;
	const prefix = `${colors.gray}[${timestamp}]${LOCAL_PREAMBLE}${colors.reset}`;

	const processed = args.map(formatMessageItem);
	return `${prefix}${processed.join('\n\r')}\r\n`;
};

export function getCalleeInfoFromStackTrace(): CalleeInfo
{
	try
	{
		throw new Error();
	} catch(error)
	{
		const err = error as Error;
		if(!err.stack) return ['unknown', [], 'unknown', 'unknown'];
		const stackLines = err.stack.split('\n');

		const parseLine = (line: string): ParsedStackFrame | null =>
		{
			let match = line.match(/at\s+([^\s(]+)\s+\((.+):[0-9]+:[0-9]+\)/);
			if(match) return { func: match[1], file: match[2] };

			match = line.match(/at\s+(.+):[0-9]+:[0-9]+/);
			if(match) return { func: 'global', file: match[1] };

			return null;
		};

		let currentFile: string | null = null;
		for(let i = 0; i < stackLines.length; i++)
		{
			const parsed = parseLine(stackLines[i]);
			if(parsed)
			{
				currentFile = parsed.file;
				break;
			}
		}

		let immediateCalleeFunc: string | null = null;
		let immediateCalleeFile: string | null = null;
		const trailingFiles: string[] = [];
		const uniqueNames = new Set<string>();

		for(let i = 0; i < stackLines.length; i++)
		{
			const parsed = parseLine(stackLines[i]);
			if(!parsed) continue;

			if(parsed.file === currentFile) continue;

			if(!immediateCalleeFunc)
			{
				immediateCalleeFunc = parsed.func;
				immediateCalleeFile = parsed.file;
			}

			const rawFileName = parsed.file.split('/').pop() || '';
			const scriptName = rawFileName.replace('.js', '').replace('.ts', '');

			if(!uniqueNames.has(scriptName))
			{
				uniqueNames.add(scriptName);
				trailingFiles.push(scriptName);
			}
		}

		let matchedCategory = 'unknown';
		for(const name of trailingFiles)
		{
			if(PIPELINE_CATEGORIES[name])
			{
				matchedCategory = PIPELINE_CATEGORIES[name];
				break;
			}
		}

		return [
			immediateCalleeFunc || 'global',
			trailingFiles,
			matchedCategory,
			immediateCalleeFile || 'unknown'
		];
	}
}

export function forceLineWrap(text: string, maxCharsPerRow: number = 80): string
{
	const rows: string[] = [];
	let currentLine = '';
	let visibleCount = 0;

	const tokenRegex = /(\x1b\[[0-9;]*[a-zA-Z])|([\s\S])/g;
	let match: RegExpExecArray | null;

	while((match = tokenRegex.exec(text)) !== null)
	{
		const [, ansiCode, printableChar] = match;

		if(ansiCode)
		{
			currentLine += ansiCode;
		} else
		{
			if(printableChar === '\n')
			{
				rows.push(currentLine);
				currentLine = '';
				visibleCount = 0;
			} else
			{
				currentLine += printableChar;
				visibleCount++;

				if(visibleCount >= maxCharsPerRow)
				{
					rows.push(currentLine);
					currentLine = '';
					visibleCount = 0;
				}
			}
		}
	}

	if(currentLine.length > 0)
	{
		rows.push(currentLine);
	}

	return rows.join('\n\r');
}


export function terminalWrite(message: string, source?: SourceMetadata | string, skipActualWrite: boolean = false): void
{
	if(!message) return;
	if(message.includes('Array "[Circular]"')) debugger;

	let render = message;
	if(!message.endsWith('\n\r') && !message.endsWith('\n'))
	{
		const parts = message.split(/\n\r*/);
		lastPartialLine = parts.pop() || '';
		render = parts.join('\n\r');
	}

	if(lastPartialLine)
	{
		render = lastPartialLine + render;
		lastPartialLine = '';
	}

	if(typeof window !== 'undefined')
	{
		loggingSelf.lineCount = (loggingSelf.lineCount || 0) + (message.match(/\n/g) || []).length;

		if(loggingSelf.compilerDiagnostics)
		{
			loggingSelf.compilerDiagnostics.log(message);
		}

		if(!source || typeof source === 'string')
		{
			const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
			const rawFileName = rawFile.split('/').pop()?.replace(/\.(js|ts)$/, '') || '';
			source = [category, source ?? 'log', ...trailingFiles, func, rawFileName, rawFile];
		}

		if(loggingSelf.terminalLog)
		{
			loggingSelf.terminalLog.push({
				render: render.includes('\n') ? forceLineWrap(render, 120) : '',
				source: source,
				text: message,
				index: loggingSelf.terminalLog.length,
				line: loggingSelf.lineCount
			});

			const MAX_CHARS = 1024 * 1024; // 1 MB limit (fits safely within localStorage limits)

			// 1. Get up to LINES_TO_SAVE, working backwards from newest to oldest
			const sourceLogs = loggingSelf.terminalLog.slice(-LINES_TO_SAVE);
			const stringifiedEntries: string[] = [];
			let currentLength = 2; // For outer brackets '[' and ']'

			for(let i = sourceLogs.length - 1; i >= 0; i--)
			{
				const entryString = JSON.stringify(sourceLogs[i]);

				// Account for comma separator if this isn't the first item added
				const addedLength = entryString.length + (stringifiedEntries.length > 0 ? 1 : 0);

				if(currentLength + addedLength > MAX_CHARS)
				{
					break; // Stop including older entries once budget is exceeded
				}

				stringifiedEntries.push(entryString);
				currentLength += addedLength;
			}

			// 2. Un-reverse so entries remain in chronological order
			stringifiedEntries.reverse();

			// 3. Assemble and save in one pass
			const serialized = '[' + stringifiedEntries.join(',') + ']';

			try
			{
				localStorage.setItem('terminal_log', serialized);
			} catch(err)
			{
				originalConsole.error(err);
			}
		}
	}

	if(!loggingSelf.mainDock)
	{
		return;
	}

	const terms = Array.from(loggingSelf.mainDock.widgets()).filter(w => w.constructor.name === 'TerminalWidget') as TerminalWidget[];
	if(terms.length > 0 && !skipActualWrite)
	{
		terms.forEach(term =>
		{
			if(loggingSelf.lastInteractedWidget === term
				|| term.filterId === source || source?.includes(term.filterId))
			{
				term.currentTerminalCtx?.term.write(message);
			}
		});
	}
}

loggingSelf.terminalWrite = terminalWrite;

export function specialWrite(msg: string, source: SourceMetadata): void
{
	if(!msg) return;

	if(msg.includes('Array "[Circular]"')) debugger;

	if(msg.includes('q3lcc -v') && typeof window !== 'undefined' && loggingSelf.compilerDiagnostics)
	{
		loggingSelf.compilerDiagnostics.clear();
	}

	if(typeof window !== 'undefined' && !loggingSelf.runningCommand)
	{
		loggingSelf.runningCommand = true;
		if(!loggingSelf.detachedConsole && !loggingSelf.alreadyWroteDetached)
		{
			loggingSelf.detachedConsole = true;
			debugger;
			console.warn('\n\rDetached console, awaiting terminate...');
		}
	}

	let skipTerminal = false;
	if(msg.includes('Assertion failed: lookup.node'))
	{
		skipTerminal = true;
	}
	if(!skipTerminal && typeof window !== 'undefined' && terminalWrite)
	{
		terminalWrite(msg, source);
	}
}


loggingSelf.specialWrite = specialWrite;


// --- CONSOLE INTERCEPTION INITIALIZER ---

export function initConsoleIntercept(): void
{
	const globalTarget = typeof self !== 'undefined' ? self : window;

	globalTarget.console.log = (...args: unknown[]) =>
	{
		const formatted = formatMessage('log', args);
		const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
		const rawFileName = rawFile.split('/').pop()?.replace(/\.(js|ts)$/, '') || '';
		const source: SourceMetadata = [category, 'log', ...trailingFiles, func, rawFileName, rawFile];

		if(typeof window !== 'undefined' && terminalWrite) terminalWrite(formatted, source);
		if(typeof loggingSelf.api !== 'undefined' && typeof loggingSelf.api.hostWrite !== 'undefined' && !loggingSelf.api.worker) loggingSelf.api.hostWrite(formatted, source);
		originalConsole.log(...args);
	};

	globalTarget.console.warn = (...args: unknown[]) =>
	{
		const formatted = formatMessage('warn', args);
		const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
		const rawFileName = rawFile.split('/').pop()?.replace(/\.(js|ts)$/, '') || '';
		const source: SourceMetadata = [category, 'warn', ...trailingFiles, func, rawFileName, rawFile];

		if(typeof window !== 'undefined' && terminalWrite) terminalWrite(formatted, source);
		if(typeof loggingSelf.api !== 'undefined' && typeof loggingSelf.api.hostWrite !== 'undefined' && !loggingSelf.api.worker) loggingSelf.api.hostWrite(formatted, source);
		originalConsole.warn(...args);
	};

	globalTarget.console.error = (...args: unknown[]) =>
	{
		const formatted = formatMessage('error', args);
		const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
		const rawFileName = rawFile.split('/').pop()?.replace(/\.(js|ts)$/, '') || '';
		const source: SourceMetadata = [category, 'error', ...trailingFiles, func, rawFileName, rawFile];

		if(typeof window !== 'undefined' && terminalWrite) terminalWrite(formatted, source);
		if(typeof loggingSelf.api !== 'undefined' && typeof loggingSelf.api.hostWrite !== 'undefined' && !loggingSelf.api.worker) loggingSelf.api.hostWrite(formatted, source);
		originalConsole.error(...args);
	};

	globalTarget.console.info = (...args: unknown[]) =>
	{
		const formatted = formatMessage('info', args);
		const [func, trailingFiles, category, rawFile] = getCalleeInfoFromStackTrace();
		const rawFileName = rawFile.split('/').pop()?.replace(/\.(js|ts)$/, '') || '';
		const source: SourceMetadata = [category, 'info', ...trailingFiles, func, rawFileName, rawFile];

		if(typeof window !== 'undefined' && terminalWrite) terminalWrite(formatted, source);
		if(typeof loggingSelf.api !== 'undefined' && typeof loggingSelf.api.hostWrite !== 'undefined' && !loggingSelf.api.worker) loggingSelf.api.hostWrite(formatted, source);
		originalConsole.info(...args);
	};
}

initConsoleIntercept();


