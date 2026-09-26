import { RepositorySettingsWindow, GlobalToolbarsWindow } from "../bundle/menu.d";
import type { SettingConfig } from "../bundle/settings";
import { AceEditorPool, AceEditorWidget } from "./widget";


const editorSelf: GlobalToolbarsWindow & RepositorySettingsWindow = self as unknown as any;


export class SettingsWidget extends AceEditorWidget
{
	constructor(fileId?: string, initialContent?: string)
	{
		super(fileId, initialContent);
		const self = this;
		editorSelf.settingsManager?.settings().then(settings =>
		{
			self._fileId = settings[0] ?? self._fileId;
			self._initialContent = settings[2] ?? self._initialContent;

			if(self._editor)
			{
				const session = AceEditorPool.getOrCreateAceSession(self._fileId, self._initialContent, self._editor);
			}
		});
	}

	// TODO: on save, also call window.SettingsManager.saveSettings
}



const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	editor: {
		savedTheme: {
			key: 'theme',
			default: 'ace/theme/monokai',
			elementId: 'theme',
			description: 'The visual theme layout package used to style the interactive Ace code editor window background and syntax colors.',
			set: (val) =>
			{
				for(let instance of AceEditorPool.instances)
				{
					instance.editor.setTheme(val);
				}
				if(AceEditorPool.theme)
				{
					AceEditorPool.theme.value = val;
				}
			}
		},
		savedKeyBinding: {
			key: 'keybinding',
			default: 'ace/keybinding/vim',
			elementId: 'keybinding',
			description: 'Defines the keyboard mapping protocol (e.g., standard, Vim, or Emacs configurations) utilized inside the script editor workspace.',
			set: (val) =>
			{
				for(let instance of AceEditorPool.instances)
				{
					if(!val || val === 'null')
					{
						instance.editor.setKeyboardHandler(val);
					} else
					{
						instance.editor.setKeyboardHandler(val);
					}
				}

				if(AceEditorPool.keybinding)
				{
					if(!val || val === 'null')
					{
						AceEditorPool.keybinding.value = '';
					}
					else
					{
						AceEditorPool.keybinding.value = val;
					}
				}
			}
		}
	},
};


if(!editorSelf.IMPORT_SETTINGS)
{
	editorSelf.IMPORT_SETTINGS = {};
}

for(const [moduleKey, configs] of Object.entries(LOCAL_SETTINGS))
{
	editorSelf.IMPORT_SETTINGS[moduleKey] = {
		...(editorSelf.IMPORT_SETTINGS[moduleKey] || {}),
		...configs
	};
}

// 4. Export the unified reference for standard module compilation tracking
export const IMPORT_SETTINGS = editorSelf.IMPORT_SETTINGS;
