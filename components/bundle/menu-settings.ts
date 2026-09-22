import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import { SettingsManager } from "./settings";
import type { GlobalToolbarsWindow, RepositorySettingsWindow } from "./menu.d";


const menuSelf: RepositorySettingsWindow & GlobalToolbarsWindow = self as unknown as any;

export type SelectOption = { value: string; label: string; selected?: boolean; isDark?: boolean; };
export type OptGroup = { label: string; options: SelectOption[]; };

export type ControlConfig = {
	id: string;
	placeholder: string;
	type: 'select' | 'checkbox';
	name: string;
	// For select types: mix of direct options and grouped options
	options?: (SelectOption | OptGroup)[];
	// For checkbox types:
	labelText?: string;
	checked?: boolean;
};

export const SETTINGS_CONTROLS: ControlConfig[] = [
	{
		id: 'keybinding',
		placeholder: 'Key Binding',
		type: 'select',
		name: 'keybinding',
		options: [
			{ value: '', label: 'Key Binding' },
			{ value: 'null', label: 'Ace' },
			{ value: 'ace/keybinding/combined', label: 'Combined', selected: true },
			{ value: 'ace/keybinding/vim', label: 'Vim' },
			{ value: 'ace/keybinding/emacs', label: 'Emacs' },
			{ value: 'ace/keybinding/sublime', label: 'Sublime' },
			{ value: 'ace/keybinding/vscode', label: 'VS Code' }
		]
	},
	{
		id: 'configuration',
		placeholder: 'Build Configuration',
		type: 'select',
		name: 'configuration',
		options: [
			{ value: '', label: 'Build Configuration' },
			{ value: 'debug', label: 'Debug' },
			{ value: 'release', label: 'Release' },
			{ value: 'pre', label: 'Preprocess' },
			{ value: 'qvms', label: 'Renderer Only' },
			{ value: 'qvms', label: 'Shared Libraries' },
			{ value: 'qvms', label: 'QVMs Only' },
			{ value: 'tools', label: 'QVM Tools Only' },
			{ value: 'assets', label: 'Assets Only' },
			{ value: 'publish', label: 'Publish' },
			{ value: 'sanitize', label: 'Sanitize' },
			{ value: 'analyze', label: 'Analyze' }
		]
	},
	{
		id: 'reload',
		placeholder: 'Automatically Reload',
		type: 'checkbox',
		name: 'reload',
		labelText: 'Hot Reload:&nbsp;',
		checked: true
	},
	{
		id: 'wasi',
		placeholder: 'Current WASI-SDK',
		type: 'select',
		name: 'wasi',
		options: [
			{ selected: true, value: '', label: 'WASI-SDK v33 (Not downloaded)' }
		]
	},
	{
		id: 'theme',
		placeholder: 'Current Theme',
		type: 'select',
		name: 'theme',
		options: [
			{ value: '', label: 'Current Theme' },
			{
				label: "The Coders' Heritage",
				options: [
					{ value: 'ace/theme/monokai', label: 'Monokai (OG High Contrast)', selected: true, isDark: true },
					{ value: 'ace/theme/textmate', label: 'TextMate (The Standard)', isDark: false },
					{ value: 'ace/theme/github', label: 'GitHub (Legacy Light)', isDark: false },
					{ value: 'ace/theme/eclipse', label: 'Eclipse (Java Classic)', isDark: false },
					{ value: 'ace/theme/xcode', label: 'XCode (Apple Classic)', isDark: false }
				]
			},
			{
				label: 'Sci-Fi Voids & Cyber Terminals',
				options: [
					{ value: 'ace/theme/terminal', label: 'Retro Terminal (Classic Amber/Green)', isDark: true },
					{ value: 'ace/theme/gob', label: 'Green on Black (The Matrix)', isDark: true },
					{ value: 'ace/theme/nightvision', label: 'Night Vision (Matrix Green)', isDark: true },
					{ value: 'ace/theme/invertedneon', label: 'Inverted Neon (vs Night Vision)', isDark: false },
					{ value: 'ace/theme/vibrant_ink', label: 'Vibrant Ink (Neon)', isDark: true },
					{ value: 'ace/theme/chaos', label: 'Chaos (Extreme Contrast)', isDark: true },
					{ value: 'ace/theme/midnightvoid', label: 'Midnight Void (vs Daybreak)', isDark: true }
				]
			},
			{
				label: 'Atmospheric Dawns & Sunsets',
				options: [
					{ value: 'ace/theme/daybreak', label: 'Daybreak (Classic Sunrise)', isDark: false },
					{ value: 'ace/theme/dawn', label: 'Dawn (Soft Sunrise)', isDark: false },
					{ value: 'ace/theme/desertsunset', label: 'Desert Sunset (Banded Gold)', isDark: false },
					{ value: 'ace/theme/arcticthaw', label: 'Arctic Thaw (vs Desert Sunset)', isDark: true },
					{ value: 'ace/theme/solarflare', label: 'Solar Flare (vs Dusk)', isDark: true },
					{ value: 'ace/theme/dusk', label: 'Dusk (Atmospheric Night)', isDark: true }
				]
			},
			{
				label: 'Deep Water & Organic Ecosystems',
				options: [
					{ value: 'ace/theme/cobalt', label: 'Cobalt (Deep Sea Blue)', isDark: true },
					{ value: 'ace/theme/oceanripple', label: 'Ocean Ripple (Deep Reflective)', isDark: true },
					{ value: 'ace/theme/abyssaltrench', label: 'Abyssal Trench (vs Ocean Ripple)', isDark: true },
					{ value: 'ace/theme/coralreef', label: 'Coral Reef (Tropical Cyan)', isDark: false },
					{ value: 'ace/theme/deepseakelp', label: 'Deep Sea Kelp (vs Coral Reef)', isDark: true },
					{ value: 'ace/theme/emeraldforest', label: 'Emerald Forest (Vibrant Green)', isDark: true },
					{ value: 'ace/theme/sourlime', label: 'Sour Lime (vs Berry Blast)', isDark: true },
					{ value: 'ace/theme/berryblast', label: 'Berry Blast (Candy Red/Blue)', isDark: true }
				]
			},
			{
				label: 'Industrial Foundry & Metallic Elements',
				options: [
					{ value: 'ace/theme/mono_industrial', label: 'Mono Industrial (Raw Slate)', isDark: true },
					{ value: 'ace/theme/darkslate', label: 'Dark Slate (vs Shale Life)', isDark: true },
					{ value: 'ace/theme/silverchrome', label: 'Silver Chrome (Metallic)', isDark: false },
					{ value: 'ace/theme/oxidizediron', label: 'Oxidized Iron (vs Silver Chrome)', isDark: true },
					{ value: 'ace/theme/leadfortress', label: 'Lead Fortress (vs Golden Gate)', isDark: true },
					{ value: 'ace/theme/goldengate', label: 'Golden Gate (Polished Gold)', isDark: false }
				]
			},
			{
				label: 'Academic Pages & Editorial Finishes',
				options: [
					{ value: 'ace/theme/ivory', label: 'Atrium Ivory (vs Default Purple)', isDark: false },
					{ value: 'ace/theme/parchment', label: 'Parchment (Academic Beige)', isDark: false },
					{ value: 'ace/theme/obsidianledger', label: 'Obsidian Ledger (vs Parchment)', isDark: true },
					{ value: 'ace/theme/kuroir', label: 'Paper White', isDark: false },
					{ value: 'ace/theme/crimson_editor', label: 'Crimson Editor', isDark: false },
					{ value: 'ace/theme/sqlserver', label: 'SQL Server Management Studio', isDark: false },
					{ value: 'ace/theme/dreamweaver', label: 'Dreamweaver Classic', isDark: false }
				]
			},
			{
				label: 'Cozy Studio Earth Tones',
				options: [
					{ value: 'ace/theme/dracula', label: 'Dracula (Vampire Mode)', isDark: true },
					{ value: 'ace/theme/one_dark', label: 'One Dark (Atom Style)', isDark: true },
					{ value: 'ace/theme/nord_dark', label: 'Nord Dark (Arctic Frost)', isDark: true },
					{ value: 'ace/theme/gruvbox', label: 'Gruvbox (Earth Tones)', isDark: true },
					{ value: 'ace/theme/pastel_on_dark', label: 'Pastel on Dark', isDark: true },
					{ value: 'ace/theme/twilight', label: 'Twilight (Warm Dark)', isDark: true },
					{ value: 'ace/theme/ambiance', label: 'Ambiance (Smooth Espresso)', isDark: true },
					{ value: 'ace/theme/idle_fingers', label: 'idle Fingers', isDark: true },
					{ value: 'ace/theme/merbivore_soft', label: 'Merbivore Soft', isDark: true },
					{ value: 'ace/theme/merbivore', label: 'Merbivore', isDark: true }
				]
			},
			{
				label: 'Prisms & Chromatic Experiments',
				options: [
					{ value: 'ace/theme/solarized_dark', label: 'Solarized Dark (Precision Calibrated)', isDark: true },
					{ value: 'ace/theme/solarized_light', label: 'Solarized Light (Precision Calibrated)', isDark: false },
					{ value: 'ace/theme/rainbowpeak', label: 'Rainbow Peak (Full Spectrum)', isDark: false },
					{ value: 'ace/theme/monochromematrix', label: 'Monochrome Matrix (vs Rainbow)', isDark: true },
					{ value: 'ace/theme/tomorrow_night_blue', label: 'Tomorrow Night Blue', isDark: true },
					{ value: 'ace/theme/tomorrow_night_bright', label: 'Tomorrow Night Bright', isDark: true },
					{ value: 'ace/theme/tomorrow_night_eighties', label: 'Tomorrow Night 80s', isDark: true },
					{ value: 'ace/theme/tomorrow_night', label: 'Tomorrow Night', isDark: true },
					{ value: 'ace/theme/tomorrow', label: 'Tomorrow Light', isDark: false },
					{ value: 'ace/theme/katzenmilch', label: 'KatzenMilch (Warm Gray)', isDark: false },
					{ value: 'ace/theme/iplastic', label: 'IPlastic', isDark: false },
					{ value: 'ace/theme/kr_theme', label: 'krTheme', isDark: true },
					{ value: 'ace/theme/clouds_midnight', label: 'Clouds Midnight', isDark: true },
					{ value: 'ace/theme/clouds', label: 'Clouds Light', isDark: false }
				]
			}
		]
	}
];

menuSelf.SETTINGS_CONTROLS = SETTINGS_CONTROLS;


export class SettingsToolbar extends Widget
{
	private static _instance: SettingsToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'settings-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): SettingsToolbar
	{
		if(!SettingsToolbar._instance)
		{
			SettingsToolbar._instance = new SettingsToolbar();
			menuSelf.settingsToolbar = SettingsToolbar._instance;
		}
		return SettingsToolbar._instance;
	}

	public initialize(commands: CommandRegistry): SettingsToolbar
	{
		this._commands = commands;
		this._registerCommands();
		this._bindChangeListeners();
		return this;
	}

	private _getCommandDefinitions(): Record<string, { label: string; action: (val: any) => void; }>
	{
		return {
			'keybinding': {
				label: 'Change Key Binding',
				action: (value) => console.log(`Keybinding updated: ${value}`)
			},
			'configuration': {
				label: 'Change Build Configuration',
				action: (value) => console.log(`Build configuration updated: ${value}`)
			},
			'reload': {
				label: 'Toggle Hot Reload',
				action: (value) => SettingsManager.applyValue('build', 'hotReload', value)
			},
			'wasi': {
				label: 'Change WASI SDK',
				action: (value) => console.log(`WASI SDK updated: ${value}`)
			},
			'theme': {
				label: 'Change Editor Theme',
				action: (value) =>
				{
					SettingsManager.applyValue('core', 'savedTheme', value);
					SettingsManager.applyValue('editor', 'savedTheme', value);
				}
			}
		};
	}

	private _registerCommands(): void
	{
		if(!this._commands) return;

		const defs = this._getCommandDefinitions();
		for(const [id, config] of Object.entries(defs))
		{
			const commandId = `settings-update-${id}`;
			if(!this._commands.hasCommand(commandId))
			{
				this._commands.addCommand(commandId, {
					label: config.label,
					execute: (args: any) => config.action(args.value)
				});
			}
		}
	}

	private _bindChangeListeners(): void
	{
		const defs = this._getCommandDefinitions();
		for(const id of Object.keys(defs))
		{
			const element = this.node.querySelector(`#${id}`);
			if(!element) continue;

			const isCheckbox = element.getAttribute('type') === 'checkbox';
			const eventType = isCheckbox ? 'change' : 'input';

			element.addEventListener(eventType, () =>
			{
				const value = isCheckbox ? (element as HTMLInputElement).checked : (element as HTMLSelectElement).value;
				this._commands?.execute(`settings-update-${id}`, { value });
			});
		}
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = '<ul>' + SETTINGS_CONTROLS.map(control =>
		{
			//const disabledAttr = (control.options?.[0] as SelectOption)?.value === '' || control.options?.length === 1 ? 'disabled' : '';

			if(control.type === 'select')
			{
				const innerContent = (control.options || []).map(opt =>
				{
					if('options' in opt)
					{
						const groupOptions = opt.options.map(o =>
							`<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`
						).join('');
						return `<optgroup label="${opt.label}">${groupOptions}</optgroup>`;
					}
					const isPlaceholder = opt.value === '';
					return `<option value="${opt.value}" ${isPlaceholder ? 'disabled' : ''} ${opt.selected ? 'selected' : ''}>${opt.label}</option>`;
				}).join('');

				return `
                <li id="${control.name}-container" class="setting" placeholder="${control.placeholder}">
                    <select required name="${control.name}" id="${control.id}">
                        ${innerContent}
                    </select>
                </li>`;
			} else
			{
				return `
                <li id="${control.name}-container" class="setting" placeholder="${control.placeholder}">
					<span>${control.labelText || ''}</span>
					<input type="checkbox" name="${control.name}" id="${control.id}" ${control.checked ? 'checked="checked"' : ''} />
                </li>`;
			}
		}).join('') + '</ul>';
	}

	public static get configuration(): HTMLSelectElement | null
	{
		return SettingsToolbar.getInstance().node.querySelector('#configuration');
	}
}

menuSelf.SettingsToolbar = SettingsToolbar;
