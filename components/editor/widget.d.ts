
import { Ace } from "ace-builds";
import type { AceEditorWidget } from "./widget";

export interface AceSession extends Ace.EditSession
{
	workspaceFileId?: string;
	$worker?: Worker;
}

export type AceEditor = typeof Ace & {
	edit(el: string | HTMLElement, options?: any): any;
	createEditSession(text: string | Ace.Document, mode?: any): AceSession;
	Range: new (startRow: number, startColumn: number, endRow: number, endColumn: number) => Ace.Range;
	config: {
		setModuleUrl: (name: string, subst: string) => string;
		loadModule: (module: [string, string], callback: () => void) => void;
		set: (key: string, value: string) => void;
	};
	require: (modules: string[], callback: (moduleExports: any) => void) => void;
};

export interface EditorWindow
{
	tempCount?: number;
	compilerDiagnostics?: {
		log: (msg: string) => void;
		clear: () => void;
		getBridge: () => {
			refreshActiveEditorView: (session: AceSession) => void;
		};
	};
	ace?: AceEditor;

	diagnosticsBridge?: any;
	AceEditorWidget?: typeof AceEditorWidget;
	previousHashLineNumber?: number | null;
}
