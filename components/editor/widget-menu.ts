
import type { AceEditorWidget } from './widget';
import type { EditorWindow } from './widget.d';


const editorSelf: EditorWindow = self as unknown as any;

export interface MenuConfig
{
	name: string;
	iconClass?: string;
	shortcut?: string;
	ellipsis?: boolean;
	target?: string;
	parameter?: any;
	children?: MenuConfig[];
}


export const VSCODE_EDIT_MENU: MenuConfig = {
	name: "Edit",
	iconClass: "bx bx-edit",
	children: [{
		name: "Toggle Line Comment",
		shortcut: "Ctrl+/",
		target: "ace_edit.toggle_line_comment",
		iconClass: "bx bx-comment-detail"
	},
	{
		name: "Toggle Block Comment",
		shortcut: "Shift+Alt+A",
		target: "ace_edit.toggle_block_comment",
		iconClass: "bx bx-comment-add"
	},
	{
		name: "Indent Line",
		shortcut: "Ctrl+]",
		target: "ace_edit.indent",
		iconClass: "bx bx-right-indent"
	},
	{
		name: "Outdent Line",
		shortcut: "Ctrl+[",
		target: "ace_edit.outdent",
		iconClass: "bx bx-left-indent"
	},
	{
		name: "Transform to Uppercase",
		target: "ace_edit.uppercase",
		iconClass: "bx bx-font"
	},
	{
		name: "Transform to Lowercase",
		target: "ace_edit.lowercase",
		iconClass: "bx bx-font"
	}, {
		name: "Preferences",
		iconClass: "bx bx-cog",
		children: [
			{
				name: "Settings",
				shortcut: "Ctrl+,",
				target: "ace_file.open_settings",
				iconClass: "bx bx-slider-alt"
			},
			{
				name: "Keyboard Shortcuts",
				shortcut: "Ctrl+K Ctrl+S",
				target: "help/shortcuts.shortcuts",
				iconClass: "bx bx-key"
			},
			{
				name: "Color Theme",
				target: "ace_file.change_theme",
				iconClass: "bx bx-palette"
			}
		]
	}]
};

export const VSCODE_SELECTION_MENU: MenuConfig = {
	name: "Selection",
	iconClass: "bx bx-select-multiple",
	children: [{
		name: "Select All",
		shortcut: "Ctrl+A",
		target: "ace_selection.select_all",
		iconClass: "bx bx-checkbox-checked"
	},
	{
		name: "Expand Selection",
		shortcut: "Shift+Alt+Right",
		target: "ace_selection.expand_selection",
		iconClass: "bx bx-expand-alt"
	},
	{
		name: "Shrink Selection",
		shortcut: "Shift+Alt+Left",
		target: "ace_selection.shrink_selection",
		iconClass: "bx bx-collapse-alt"
	},
	{
		name: "Copy Line Up",
		shortcut: "Shift+Alt+Up",
		target: "ace_selection.copy_line_up",
		iconClass: "bx bx-up-arrow-alt"
	},
	{
		name: "Copy Line Down",
		shortcut: "Shift+Alt+Down",
		target: "ace_selection.copy_line_down",
		iconClass: "bx bx-down-arrow-alt"
	},
	{
		name: "Move Line Up",
		shortcut: "Alt+Up",
		target: "ace_selection.move_line_up",
		iconClass: "bx bx-up-arrow"
	},
	{
		name: "Move Line Down",
		shortcut: "Alt+Down",
		target: "ace_selection.move_line_down",
		iconClass: "bx bx-down-arrow"
	},
	{
		name: "Duplicate Selection",
		target: "ace_selection.duplicate_selection",
		iconClass: "bx bx-duplicate"
	},
	{
		name: "Add Cursor Above",
		shortcut: "Ctrl+Alt+Up",
		target: "ace_selection.add_cursor_above",
		iconClass: "bx bx-caret-up"
	},
	{
		name: "Add Cursor Below",
		shortcut: "Ctrl+Alt+Down",
		target: "ace_selection.add_cursor_below",
		iconClass: "bx bx-caret-down"
	},
	{
		name: "Select All Occurrences",
		shortcut: "Ctrl+F2",
		target: "ace_selection.select_all_matches",
		iconClass: "bx bx-list-check"
	}]
};

export const VSCODE_VIEW_MENU: MenuConfig = {
	name: "View",
	iconClass: "bx bx-show",
	children: [{
		name: "Command Palette...",
		shortcut: "Ctrl+Shift+P",
		ellipsis: true,
		target: "ace_view.command_palette",
		iconClass: "bx bx-terminal"
	},
	{
		name: "Toggle Word Wrap",
		shortcut: "Alt+Z",
		target: "ace_view.toggle_word_wrap",
		iconClass: "bx bx-wrap"
	},
	{
		name: "Toggle Line Numbers",
		target: "ace_view.toggle_line_numbers",
		iconClass: "bx bx-list-ol"
	},
	{
		name: "Toggle Print Margin",
		target: "ace_view.toggle_print_margin",
		iconClass: "bx bx-border-right"
	},
	{
		name: "Fold All",
		shortcut: "Ctrl+K Ctrl+0",
		target: "ace_view.fold_all",
		iconClass: "bx bx-folder-minus"
	},
	{
		name: "Unfold All",
		shortcut: "Ctrl+K Ctrl+J",
		target: "ace_view.unfold_all",
		iconClass: "bx bx-folder-plus"
	}]
};

export const VSCODE_GO_MENU: MenuConfig = {
	name: "Go",
	iconClass: "bx bx-right-arrow-circle",
	children: [
		{
			name: "Go to Line/Column...",
			shortcut: "Ctrl+G",
			ellipsis: true,
			target: "ace_go.goto_line",
			iconClass: "bx bx-move"
		},
		{
			name: "Go to Bracket",
			shortcut: "Ctrl+Shift+\\",
			target: "ace_go.goto_bracket",
			iconClass: "bx bx-code-curly"
		},
		{
			name: "Go to Definition",
			//shortcut: "F12",
			target: "ace_go.goto_definition",
			iconClass: "bx bx-link-external"
		},
		{
			name: "Next Problem",
			shortcut: "F8",
			target: "ace_go.next_error",
			iconClass: "bx bx-chevron-right-circle"
		},
		{
			name: "Previous Problem",
			shortcut: "Shift+F8",
			target: "ace_go.prev_error",
			iconClass: "bx bx-chevron-left-circle"
		}
	]
};

export const VSCODE_ACE_MENUS: MenuConfig[] = [
	VSCODE_EDIT_MENU,
	VSCODE_SELECTION_MENU,
	VSCODE_VIEW_MENU,
	VSCODE_GO_MENU
];

export const ACE_MODULES: Record<string, Record<string, Function>> = {};


ACE_MODULES['ace_file'] = {
	/*new_file: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			editor.setValue('', -1);
			editor.session.getUndoManager().reset();
		}
	},
	open_file: function (_: any, widget: AceEditorWidget)
	{
		const input = document.createElement('input');
		input.type = 'file';
		input.onchange = (e: any) =>
		{
			const file = e.target.files[0];
			if(!file) return;
			const reader = new FileReader();
			reader.onload = (evt) =>
			{
				const editor = widget._editor;
				if(editor && evt.target?.result)
				{
					editor.setValue(evt.target.result as string, -1);
				}
			};
			reader.readAsText(file);
		};
		input.click();
	},
	save_file: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(!editor) return;
		const content = editor.getValue();
		const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'document.txt';
		a.click();
		URL.revokeObjectURL(a.href);
	},
	save_as: function (_: any, widget: AceEditorWidget)
	{
		//ACE_MODULES['ace_file'].save_file();
	},*/
	toggle_auto_save: function (_: any, widget: AceEditorWidget)
	{
		if(widget)
		{
			widget.autoSaveEnabled = !widget.autoSaveEnabled;
			console.log(`Auto Save set to: ${widget.autoSaveEnabled}`);
		}
	},
	open_settings: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			editor.execCommand('showSettingsMenu');
		}
	},
	change_theme: function (themeName: string | undefined, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const theme = themeName ?? 'ace/theme/monokai';
			editor.setTheme(theme);
		}
	}
};

ACE_MODULES['edit/undo'] = {
	undo: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.undo();
	}
};


ACE_MODULES['edit/redo'] = {
	redo: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.redo();
	}
};


ACE_MODULES['edit/cut'] = {
	cut: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const text = editor.getCopyText();
			navigator.clipboard?.writeText(text);
			editor.insert('');
		}
	}
};


ACE_MODULES['edit/copy'] = {
	copy_to_clipboard: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const text = editor.getCopyText();
			navigator.clipboard?.writeText(text);
		}
	}
};


ACE_MODULES['edit/paste'] = {
	paste: async function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor && navigator.clipboard)
		{
			const text = await navigator.clipboard.readText();
			editor.insert(text);
		}
	}
};


ACE_MODULES['edit/find'] = {
	find: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('find');
	}
};


ACE_MODULES['edit/replace'] = {
	replace: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('replace');
	}
};


ACE_MODULES['edit/selection'] = {
	select_all: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.selectAll();
	}
};


ACE_MODULES['ace_edit'] = {
	toggle_line_comment: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.toggleCommentLines();
	},
	toggle_block_comment: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.toggleBlockComment();
	},
	indent: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.blockIndent();
	},
	outdent: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.blockOutdent();
	},
	uppercase: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.toUpperCase();
	},
	lowercase: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.toLowerCase();
	}
};

ACE_MODULES['ace_selection'] = {
	select_all: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.selectAll();
	},
	expand_selection: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('selectMoreAfter');
	},
	shrink_selection: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('selectLess');
	},
	copy_line_up: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('copylinesup');
	},
	copy_line_down: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('copylinesdown');
	},
	move_line_up: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('movelinesup');
	},
	move_line_down: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('movelinesdown');
	},
	duplicate_selection: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('duplicateSelection');
	},
	add_cursor_above: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('addCursorAbove');
	},
	add_cursor_below: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('addCursorBelow');
	},
	select_all_matches: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('selectallmatches');
	}
};


ACE_MODULES['view/zoom'] = {
	in: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const fontSize = editor.getFontSize();
			const size = typeof fontSize === 'string' ? parseInt(fontSize ?? '12', 10) : fontSize ?? 12;
			editor.setFontSize(size + 2);
		}
	},
	out: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const fontSize = editor.getFontSize();
			const size = Math.max(8, (typeof fontSize === 'string' ? parseInt(fontSize ?? '12', 10) : fontSize ?? 12) - 2);
			editor.setFontSize(size);
		}
	},
	original: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.setFontSize(12);
	}
};



ACE_MODULES['ace_view'] = {
	command_palette: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('openCommandPallete');
	},
	toggle_word_wrap: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const wrap = editor.session.getUseWrapMode();
			editor.session.setUseWrapMode(!wrap);
		}
	},
	toggle_line_numbers: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const show = editor.getOption('showLineNumbers');
			editor.setOption('showLineNumbers', !show);
		}
	},
	toggle_print_margin: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(editor)
		{
			const show = editor.getOption('showPrintMargin');
			editor.setOption('showPrintMargin', !show);
		}
	},
	fold_all: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.session.foldAll();
	},
	unfold_all: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.session.unfold();
	}
};

ACE_MODULES['ace_go'] = {
	goto_line: function (_: any, widget: AceEditorWidget)
	{
		if(!widget._editor) return;
		const lineStr = prompt('Go to Line:');
		if(lineStr)
		{
			const line = parseInt(lineStr, 10);
			if(!isNaN(line))
			{
				widget._editor.gotoLine(line, 0, true);
			}
		}
	},
	goto_bracket: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('jumpToMatching');
	},
	goto_definition: function (_: any, widget: AceEditorWidget)
	{
		const editor = widget._editor;
		if(!editor) return;
		const pos = editor.getCursorPosition();
		const token = editor.session.getTokenAt(pos.row, pos.column);
		if(token)
		{
			console.log(`Navigating to definition for token: ${token.value}`);
		}
	},
	next_error: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('goToNextError');
	},
	prev_error: function (_: any, widget: AceEditorWidget)
	{
		widget._editor?.execCommand('goToPreviousError');
	}
};

ACE_MODULES['help/shortcuts'] = {
	shortcuts: function (_: any, widget: AceEditorWidget)
	{
		if(widget._editor)
		{
			editorSelf.ace?.config.loadModule(["ext", "ace/ext/keybinding_menu"], function (...args: any[])
			{
				//if(widget._editor && typeof widget._editor.showKeyboardShortcuts === 'function')
				//{
				//	widget._editor.showKeyboardShortcuts();
				//}
				if(args[0])
				{
					if(typeof args[0] === "function")
					{
						args[0](widget._editor);
					} else if(args[0] && typeof args[0].init === "function")
					{
						args[0].init(widget._editor);
					}
				}

				if(widget._editor)
				{
					widget._editor.execCommand("showKeyboardShortcuts");
				}
			});
		}
	}
};


ACE_MODULES['help/about'] = {
	about: function (_: any, widget: AceEditorWidget)
	{
		window.open('https://github.com/ajaxorg/ace',);
	}
};
