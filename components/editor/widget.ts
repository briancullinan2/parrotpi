import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { Ace } from 'ace-builds';
import { AceEventManager, bindBlockTrackerToSession, onBlockTrackerCursorChange } from "./events";
import { EXTENSION_TO_MODE, getModeByFilename } from './widget-modes';
import { ACE_MODULES, VSCODE_ACE_MENUS } from './widget-menu';
import type { MenuModules } from '../bundle/menu-manager';
import { LOCAL_SETTINGS } from '../filelist/widget-local';
import type { OptGroup } from '../bundle/menu-settings';
import type { AceSession, EditorWindow } from './widget.d';
import type { GithubWindow } from '../bundle/github.d';
import type { GlobalToolbarsWindow, LuminoMenuWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { TerminalWindow } from '../terminal/widget.d';


const editorSelf: EditorWindow & GithubWindow & GlobalToolbarsWindow & LuminoLayoutWindow & LuminoMenuWindow & TerminalWindow = self as unknown as any;


interface ISessionCache
{
	[fileId: string]: AceSession;
}

declare module "ace-builds" {
	interface Editor
	{
		getSession(): AceSession;
	}
}


/**
 * Global static coordinator managing pool instances to facilitate cross-widget reuse.
 */
export class AceEditorPool
{
	static instances: Array<{ editor: Ace.Editor; inUse: boolean; }> = [];
	public static sessionCache: ISessionCache = {};

	public static getOrCreateAceSession(fileId: string, content: string, editor: Ace.Editor): AceSession | undefined | void
	{
		const updateSessions = (session: AceSession) =>
		{
			bindBlockTrackerToSession(session, editor);
			onBlockTrackerCursorChange(session, editor);

			editor.setSession(session);
			editor.resize();
			editor.renderer.updateFull();
			tryLoadingTerminalEditorBridge(editor);
			editorSelf.ace?.require(["ace/mode/antlr_worker"], (antlrWorkerModule) =>
			{
				if(antlrWorkerModule && antlrWorkerModule.switchActiveSession)
				{
					antlrWorkerModule.switchActiveSession(session);
				}
			});

		};


		if(this.sessionCache[fileId])
		{
			updateSessions(this.sessionCache[fileId]);
			return this.sessionCache[fileId];
		}

		const session = editorSelf.ace?.createEditSession(content) as AceSession;
		if(!session) return;

		session.workspaceFileId = fileId;

		if(typeof editorSelf.getGitShaBrowser === 'function')
		{
			editorSelf.getGitShaBrowser(content).then((sha: string) =>
			{
				this.sessionCache[sha] = session;
			});
		}

		const mode = getModeByFilename(fileId);
		console.warn('Setting ace9 language highlighter: ' + mode + ' from ' + fileId);
		session.setMode(mode);

		if(fileId.endsWith('.c') || fileId.endsWith('.h'))
		{
			session.setTabSize(4);
		}

		this.sessionCache[fileId] = session;
		updateSessions(session);

		return session;
	}

	public static acquireEditor(): Ace.Editor
	{
		// Find an editor instance that is not currently bound to an active DOM layout
		let item = this.instances.find(inst => !inst.inUse);
		if(!item)
		{
			const container = document.createElement('div');
			container.className = 'ace-shared-pool-element';
			container.style.width = '100%';
			container.style.height = '100%';
			//ace.config.set("extPath", "/ace");
			editorSelf.ace?.config.setModuleUrl(
				"ace/ext/keybinding_menu",
				"/ace/ext-keybinding_menu.js"
			);
			editorSelf.ace?.config.set('basePath', '/ace');
			editorSelf.ace?.config.set('modePath', '/ace');
			editorSelf.ace?.config.set('workerPath', '/ace');
			editorSelf.ace?.config.set('themePath', '/ace');

			const editor: Ace.Editor = editorSelf.ace?.edit(container);
			const theme = editorSelf.settingsManager?.get('editor', 'savedTheme');
			if(theme)
			{
				editor.setTheme(theme);
			}
			const renderer = editor.renderer as Ace.VirtualRenderer & {
				$gutterLayer: { setShowLineNumbers(show: boolean): void; };
				$loop: { schedule(command: any): void; };
				CHANGE_GUTTER: any;
			};
			renderer.setShowGutter(true);
			renderer.$gutterLayer.setShowLineNumbers(true);
			renderer.$loop.schedule(renderer.CHANGE_GUTTER);
			editor.setOptions({
				scrollPastEnd: 0.9,
				showPrintMargin: true,
				navigateWithinSoftTabs: true,
				printMarginColumn: 80,
				foldStyle: 'markbegin',
				showFoldWidgets: true,
				fadeFoldWidgets: false
			});

			editor.commands.addCommand({
				name: "save",
				bindKey: { win: "Ctrl-S", mac: "Command-S" },
				exec: function (ed: any)
				{
					if(typeof (window as any).saveFile === 'function')
					{
						(window as any).saveFile();
					}
				}
			});
			editor.on('change', AceEditorPool.recordChanges.bind(editor, editor));

			item = { editor, inUse: true };
			this.instances.push(item);
		} else
		{
			item.inUse = true;
		}
		return item.editor;
	}


	static recordChanges(editor: Ace.Editor, delta: Ace.Delta)
	{
		// 1. Get the real-time position from the editor instance
		const pos = editor.getCursorPosition();

		// 2. Format a human-readable action description based on the event delta
		let changeType = "Code Modified";
		if(delta.action === "insert")
		{
			changeType = delta.lines.length > 1 ? "Lines added" : "Inserted text";
		} else if(delta.action === "remove")
		{
			changeType = delta.lines.length > 1 ? "Lines deleted" : "Removed text";
		}

		const fileName = editor.getSession().workspaceFileId;

		// 3. Match the structural payload requirements for extractAceMetadata
		const actionPayload = {
			action_id: "ace_edit_action",
			action_description: changeType,
			fileName: fileName,                  // Assumes 'fileName' is accessible in your scope
			filePath: fileName,                  // Keeps it compatible with file path extraction splitting
			row: pos?.row,                        // Pass raw index; extractAceMetadata adds +1 for display
			column: pos?.column,
			delta: delta
		};

		editorSelf.historyToolbar?.appendHistoryItem(actionPayload, 'editor');
	}

	public static releaseEditor(editor: any): void
	{
		const item = this.instances.find(inst => inst.editor === editor);
		if(item)
		{
			item.inUse = false;
			// Detach safely from the DOM parent node container to keep it free-floating
			if(editor.container && editor.container.parentNode)
			{
				editor.container.parentNode.removeChild(editor.container);
			}
		}
	}

	public static getNextTempName(): string
	{
		return 'temp-' + editorSelf.nextTemp?.() + '.c';
	}

	public static get keybinding(): HTMLSelectElement | null
	{
		return document.querySelector('top-bar-sel-keybinding');
	}

	public static get theme(): HTMLSelectElement | null
	{
		return document.querySelector('top-bar-sel-theme');
	}

}

/**
 * Lumino Widget encapsulating targeted tab lifecycle bindings to Ace singleton allocation layers.
 */
export class AceEditorWidget extends Widget implements MenuModules
{
	protected _fileId: string;
	protected _initialContent: string;
	public _editor: Ace.Editor | undefined = undefined;
	protected static _defaultContent: string = '#include <stdio.h>\n\n// this is a comment\n\nint main() {\n    printf("Hello, Lumino!\\n")\n    printf("WASI Compiler Check: SUCCESS\\n");\n    return 0;\n}\n';
	private _eventManager: AceEventManager;
	autoSaveEnabled: boolean = true;
	public modules?: Record<string, Record<string, Function>> = ACE_MODULES;


	constructor(fileId?: string, initialContent?: string)
	{
		super();
		this.addClass('lm-AceEditorWidget');

		// TODO: so it starts with .c
		this._fileId = AceEditorPool.getNextTempName();
		this.id = `ace-editor-${this.fileId.replace(/[^a-z0-9]/ig, '_')}`;
		this._initialContent = initialContent || AceEditorWidget._defaultContent;
		this._eventManager = new AceEventManager(this);

		// Ensure Lumino layout updates do not break text selection systems
		this.node.style.overflow = 'hidden';
		this.node.style.display = 'flex';
		this.node.style.flexDirection = 'column';

		this.title.label = fileId || this._fileId;
		this.title.closable = true;

		editorSelf.settingsManager?.hydrateAll(LOCAL_SETTINGS.editor);

		this.node.addEventListener('focusin', () =>
		{
			this._eventManager.attachListeners();
			editorSelf.injectMenus?.(AceEditorWidget.name, VSCODE_ACE_MENUS);
		});
		this.node.addEventListener('focusout', (e) =>
		{
			// Only remove if focus didn't move somewhere else inside this same panel
			if(!this.node.contains(e.relatedTarget as Node))
			{
				this._eventManager.detachListeners();
				//window.removeMenus(AceEditorWidget.name);
			}
		});

	}

	public get fileId(): string
	{
		return this._fileId;
	}


	protected onBeforeHide(msg: Message): void
	{
		editorSelf.removeMenus?.(AceEditorWidget.name);
		super.onBeforeHide(msg);
	}

	/**
	 * Fired when the Widget is being injected directly into the active browser DOM.
	 */
	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);

		// Claim or initialize an instance allocated within the singleton pool structures
		this._editor = AceEditorPool.acquireEditor();

		// Wire up structural DOM attachments cleanly
		this.node.appendChild(this._editor?.container);

		// Fetch original or structural cache descriptors targeting tracking layers
		const session = AceEditorPool.getOrCreateAceSession(this._fileId, this._initialContent, this._editor);
		tryLoadingTerminalEditorBridge(this._editor);
		editorSelf.registerAllCommands?.(VSCODE_ACE_MENUS);
		editorSelf.injectMenus?.(AceEditorWidget.name, VSCODE_ACE_MENUS);

		editorSelf.ace?.config.loadModule(['ext', "ace/ext/themelist"], (...args: any[]) =>
		{
			if(args[0] && args[0].themes instanceof Array)
			{
				const themeSetting = editorSelf.SETTINGS_CONTROLS?.find(s => s.name === 'theme');
				if(themeSetting)
				{

					for(let option of themeSetting.options ?? [])
					{
						const options = (option as OptGroup)?.options ?? [option];
						for(let suboption of options)
						{
							const name = suboption.value.split('/').pop() ?? suboption.value;
							if(!args[0].themesByName[name])
							{
								const newTheme = {
									caption: suboption.label,      // Display label in the dropdown
									theme: suboption.value,   // The full module ID or path
									isDark: suboption.isDark,
									name: name
								};
								args[0].themes.push(newTheme);
								args[0].themesByName[name] = newTheme;
							}
						}
					}
				}
			}
		});



		editorSelf.ace?.config.loadModule(['ext', "ace/ext/modelist"], (...args: any[]) =>
		{
			const getExtensionsForMode = (targetMode: string) =>
				Object.entries(EXTENSION_TO_MODE)
					.filter(([_, mode]) => mode === targetMode)
					.map(([ext]) => ext)
					.join('|');

			const extensions = getExtensionsForMode('antlr_worker');

			if(args[0] && args[0].modes instanceof Array)
			{
				const antlrMode = {
					name: "antlr_worker",
					caption: "ANTLR (Auto Detect)",        // Display label in the dropdown
					mode: "ace/mode/antlr_worker",     // The module path
					extensions: extensions,                 // File extensions associated with it
					supportsFile: (filename: string) =>
					{
						const ext = filename.split('.').pop();
						return ext ? EXTENSION_TO_MODE[ext.toLowerCase()] === 'antlr_worker' : false;
					}
				};

				// Add to mode arrays used by OptionPanel
				args[0].modes.unshift(antlrMode);
				args[0].modesByName["antlr_worker"] = antlrMode;
			}
		});



		editorSelf.ace?.config.loadModule(['ext', "ace/ext/options"], (...args: any[]) =>
		{
			if(args[0] && args[0].OptionPanel)
			{
				const originalRenderControl = args[0].OptionPanel.prototype.renderOptionControl;

				args[0].OptionPanel.prototype.renderOptionControl = function (id: string, option: any)
				{
					// Check if Ace is rendering the keyboardHandler control
					if(option && option.path === "keyboardHandler" && option.items)
					{
						const exists = option.items.some((item: any) =>
							(typeof item === 'object' ? item.value : item) === "ace/keyboard/combined"
						);

						if(!exists)
						{
							option.items.push({
								caption: "Combined",
								value: "ace/keyboard/combined"
							});
						}
					}

					// Let original function render the <select> with your new option appended
					return originalRenderControl.apply(this, arguments);
				};
			}
		});

		this._eventManager.attachListeners();
	}

	/**
	 * Fired when Lumino swaps tabs out of layout visibility scope.
	 */
	protected onBeforeDetach(msg: Message): void
	{
		if(this._editor)
		{
			AceEditorPool.releaseEditor(this._editor);
			this._editor = undefined;
		}
		this._eventManager.detachListeners();
		super.onBeforeDetach(msg);
	}

	/**
	 * Invoked when layouts change container dimensions or parent components shift sizes.
	 */
	protected onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		if(this._editor)
		{
			this._editor.resize();
		}
	}

	/**
	 * Invoked by Lumino tracking stacks to shift programmatic interaction capture target states.
	 */
	protected onActivateRequest(msg: Message): void
	{
		super.onActivateRequest(msg);
		if(this._editor)
		{
			this._editor.focus();
		}
		editorSelf.injectMenus?.(AceEditorWidget.name, VSCODE_ACE_MENUS);
	}

	// Call this function inside your file tree selection/click event listener
	static openFileInNewTab(fileId: string, fileName: string, fileContent: string | ArrayBuffer | Uint8Array)
	{
		if(fileContent instanceof ArrayBuffer || fileContent instanceof Uint8Array)
		{
			fileContent = new TextDecoder().decode(fileContent);
		}
		// 1. Optional Check: Look for an existing open tab matching this file ID to prevent duplicates
		const tabs = Array.from(editorSelf.mainDock?.widgets() ?? []);
		const existingTab = tabs.find(t => t.constructor.name === AceEditorWidget.name
			&& (t as AceEditorWidget).fileId === fileId);

		if(existingTab)
		{
			// If it's already open, just activate it and bring it to focus
			editorSelf.mainDock?.activateWidget(existingTab);
			return;
		}

		// take over the default tab instead of creating a new one
		const existingDefault = tabs.find(t => t.constructor.name === AceEditorWidget.name
			&& ((t as AceEditorWidget)._editor?.getValue() === AceEditorWidget._defaultContent
				|| (t as AceEditorWidget)._editor?.getValue().trim() === '')
		) as AceEditorWidget;
		if(existingDefault && typeof existingDefault._editor !== 'undefined')
		{
			existingDefault.title.label = fileName.split('/').pop() ?? fileName;
			existingDefault._fileId = fileId;
			existingDefault._initialContent = fileContent;
			const session = AceEditorPool.getOrCreateAceSession(fileId, fileContent, existingDefault._editor);
			editorSelf.mainDock?.activateWidget(existingDefault);
			return;
		}

		// 2. Create the new custom Ace Lumino widget instance
		const newTab = new AceEditorWidget(fileId, fileContent);
		newTab._fileId = fileId;
		newTab._initialContent = fileContent;

		newTab.title.label = fileName.split('/').pop() ?? fileName;
		newTab.title.closable = true;

		if(editorSelf.mainDock)
		{
			editorSelf.LayoutAdjuster?.addOptimalWidgetLayout(editorSelf.mainDock, newTab, {
				type: 'editor',
				projectId: newTab.constructor.name
			});
		}
	}
}

editorSelf.AceEditorWidget = AceEditorWidget;


// Define declarations for Ace and missing global window bindings


function tryLoadingTerminalEditorBridge(aceEditor: Ace.Editor | null | undefined): void
{
	if(!aceEditor)
	{
		return;
	}

	if(editorSelf.compilerDiagnostics /* already setup */)
	{
		editorSelf.compilerDiagnostics.getBridge().refreshActiveEditorView(aceEditor?.getSession());
		return;
	}

	// Force Ace to locate, download, and compile the extension module asynchronously
	editorSelf.ace?.config.loadModule(["ext", "compiler_diagnostics"], function ()
	{
		editorSelf.ace?.require(["ace/ext/compiler_diagnostics"], function (moduleExports: any)
		{
			if(!moduleExports)
			{
				console.error("[Ace Lazy] Failed to initialize compiler_diagnostics extension.");
				return;
			}

			editorSelf.compilerDiagnostics = moduleExports;
			editorSelf.diagnosticsBridge = moduleExports.getBridge(aceEditor?.getSession());

			if(editorSelf.diagnosticsBridge)
			{
				// TODO: the bridge takes errors from parsing and displays little squigglies and gutter exclaimnations
				//   this on the other hand, takes error from actually compiling with clang and adds them to the bridge
				editorSelf.diagnosticsBridge.collectedLogLines = editorSelf.terminalLog?.map(log =>
					typeof log === 'object' && log !== null ? (log.text || '') : log
				);
				editorSelf.diagnosticsBridge.triggerBridgeRefresh(aceEditor.getSession());
			}

			console.log("[Ace Lazy] Compiler diagnostics overlay successfully linked.");
		});
	});
}
