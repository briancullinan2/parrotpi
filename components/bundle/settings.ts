import { getGitShaBrowser } from "./github";
import { filesRepo } from "./github-types";
import { FS_FILE } from "./local";
import { RepositoryToolbar } from "./menu-repos";
import { IMPORT_SETTINGS as LOCAL_SETTINGS } from "./settings-coalesced";
import type { LuminoLayoutWindow } from "./lumino.d";
import type { EditorWindow } from "../editor/widget.d";
import type { GlobalToolbarsWindow, RepositorySettingsWindow } from "./menu.d";


const luminoSelf: LuminoLayoutWindow & EditorWindow & RepositorySettingsWindow & GlobalToolbarsWindow & RepositorySettingsWindow & { [key: string]: any; } = self as unknown as any;


export interface SettingConfig
{
	key: string;
	type?: 'boolean' | 'csv' | 'json' | 'array' | string;
	default?: any;
	windowName?: string;
	description?: string;
	elementId?: string;
	edit?: boolean;
	currentValue?: any;
	set?(value: any, config?: SettingConfig): void;
	get?(storedValue: string | null, defaultValue: any, config: SettingConfig): any;
}


luminoSelf.tempCount = 0;


function nextTemp()
{
	if(typeof luminoSelf.tempCount !== 'undefined')
	{
		return ++luminoSelf.tempCount;
	}
	else
	{
		return Math.random() * 1000;
	}
}

luminoSelf.nextTemp = nextTemp;


if(!luminoSelf.IMPORT_SETTINGS)
{
	luminoSelf.IMPORT_SETTINGS = {};
}

for(const [moduleKey, configs] of Object.entries(LOCAL_SETTINGS))
{
	luminoSelf.IMPORT_SETTINGS[moduleKey] = {
		...configs,
		...(luminoSelf.IMPORT_SETTINGS[moduleKey] || {}),
	};
}


export const IMPORT_SETTINGS = luminoSelf.IMPORT_SETTINGS;


export type FileOpenTuple = [
	fileId: string | null,
	fileName: string | null,
	fileContents: string | null
];



export class Settings
{
	private static _instance: Settings | null = null;


	private previousSettings: any = null;


	private constructor() { }


	public static get instance(): Settings
	{
		if(!Settings._instance)
		{
			Settings._instance = new Settings();
			luminoSelf.settingsManager = Settings._instance;
		}
		return Settings._instance;
	}


	/**
	 * 1. Initial hydration loop running across local storage on boot
	 */
	public hydrateAll(): void;
	public hydrateAll(settings: Record<string, SettingConfig> | string): void;
	public hydrateAll(inputSettings?: Record<string, SettingConfig> | string): void
	{
		// 1. Establish our baseline configuration array
		let hydrationEntries: [string, Record<string, SettingConfig>][];

		if(inputSettings)
		{
			if(typeof inputSettings === 'string')
			{
				// Case A: Passed a specific module key string name
				const moduleKey = inputSettings;
				const moduleGroup = IMPORT_SETTINGS[moduleKey];
				hydrationEntries = moduleGroup ? [[moduleKey, moduleGroup]] : [];
			}
			else
			{
				// Case B: Passed an isolated, explicit Record runtime block
				hydrationEntries = [['explicit-context', inputSettings]];
			}
		}
		else
		{
			// Case C: No arguments passed on boot; hydrate every configuration globally
			hydrationEntries = Object.entries(IMPORT_SETTINGS);
		}

		// 2. Execute the iteration pipeline safely avoiding name shadow collisions
		for(const [moduleKey, groupConfig] of hydrationEntries)
		{
			for(const [camelKey, config] of Object.entries(groupConfig))
			{
				config.windowName = camelKey;
				let raw: any = localStorage.getItem(config.key);
				let finalValue: any = raw;

				if(raw === null)
				{
					raw = config.default;
				}

				if(config.type === 'boolean')
				{
					finalValue = raw === true || raw?.toLowerCase() === 'true';
				} else if(config.type === 'json')
				{
					try
					{
						if(typeof raw === 'string')
						{
							finalValue = JSON.parse(raw);
						} else
						{
							finalValue = raw;
						}
					} catch(e)
					{
						debugger;
						console.error(e);
						finalValue = config.default;
					}
				} else if(config.type === 'array')
				{
					try
					{
						if(typeof raw === 'string')
						{
							finalValue = JSON.parse(raw);
						}
						else if(raw instanceof Array)
						{
							finalValue = raw;
						} else
						{
							finalValue = Array.from(raw);
						}
						if(!Array.isArray(finalValue))
						{
							finalValue = [];
						}
					} catch(e)
					{
						debugger;
						console.error(e);
						finalValue = config.default;
					}
				} else if(config.type === 'csv')
				{
					finalValue = raw instanceof Array ? raw : raw?.split(';').filter(Boolean);
				}

				this.applyValue(config, finalValue);
			}
		}
	}

	public applyValue(moduleKey: string, settingKey: string | Element, value: any): void;
	public applyValue(config: SettingConfig, value: any): void;
	public applyValue(first: string | SettingConfig, second: any, third?: any): void
	{
		let targetConfig: SettingConfig | undefined;
		let finalValue: any;

		// Type guard step: Determine if we received a module key string or a raw config block
		if(typeof first === 'string')
		{
			const moduleKey = first;
			const settingKey = second as string; // or element lookup mapping
			finalValue = third;

			targetConfig = IMPORT_SETTINGS[moduleKey]?.[settingKey];
		}
		else
		{
			// First parameter is an object matching the SettingConfig schema
			targetConfig = first;
			finalValue = second;
		}

		// Safety fallback block if lookups fail
		if(!targetConfig)
		{
			console.warn("SettingsManager: target configuration block could not be resolved.");
			return;
		}

		// Apply mutations
		targetConfig.currentValue = finalValue;

		if(targetConfig.windowName)
		{
			luminoSelf[targetConfig.windowName] = finalValue;
		}

		if(typeof targetConfig.set === 'function')
		{
			targetConfig.set(finalValue, targetConfig);
		}
		else if(targetConfig.elementId)
		{
			const el = document.getElementById(targetConfig.elementId) as HTMLInputElement | HTMLSelectElement | null;
			if(el)
			{
				if(targetConfig.type === 'boolean' || (el as HTMLInputElement).type === 'checkbox')
				{
					(el as HTMLInputElement).checked = !!finalValue;
				} else if(el.tagName.toUpperCase() === 'SELECT')
				{
					if(el.querySelector(`[value*="${finalValue}"]`))
					{
						el.value = finalValue;
					} else
					{
						el.value = targetConfig.default;
					}
				} else
				{
					el.value = finalValue;
				}
			}
		}

		this.storeValue(targetConfig, finalValue);
	}

	/**
	 * 3. Gathers active settings configurations ordered by keys
	 */
	public exportPayload(): Record<string, any>
	{
		const payload: Record<string, any> = {};
		const flatConfigs: SettingConfig[] = [];

		for(const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS))
		{
			for(const [camelKey, config] of Object.entries(settings))
			{
				if(config.edit === false) continue;
				flatConfigs.push(config);
			}
		}

		flatConfigs.sort((a, b) => a.key.localeCompare(b.key));

		for(const config of flatConfigs)
		{
			let currentVal: any;
			if(typeof config.get === 'function')
			{
				currentVal = config.get(localStorage.getItem(config.key), config.default, config);
			} else if(config.elementId)
			{
				const el = document.getElementById(config.elementId);
				if(el)
				{
					if(config.type === 'csv' && el.nodeName.toUpperCase() === 'SELECT')
					{
						currentVal = Array.from(el.children).map(c => (c as HTMLOptionElement).value).join(';');
					} else
					{
						currentVal = (config.type === 'boolean' || (el as HTMLInputElement).type === 'checkbox')
							? (el as HTMLInputElement).checked
							: (el as HTMLInputElement | HTMLSelectElement).value;
					}
				}
			} else
			{
				currentVal = localStorage.getItem(config.key);
			}

			if(config.type === 'csv' && typeof currentVal === 'string')
			{
				currentVal = currentVal.split(';');
			}
			if((config.type === 'array' || config.type === 'json') && typeof currentVal === 'string')
			{
				try
				{
					currentVal = JSON.parse(currentVal);
				} catch(e)
				{
					currentVal = config.type === 'array' ? [] : {};
				}
			}

			currentVal = currentVal !== undefined && currentVal !== null ? currentVal : config.default;
			payload[config.key] = currentVal;
		}

		return payload;
	}

	/**
	 * 4. Safe lookup targeting a single config definition string or Element pointer
	 */
	public get(moduleKey: string, settingKey: string | Element): any
	{
		let config: SettingConfig | undefined = IMPORT_SETTINGS[moduleKey]?.[settingKey as string];
		if(!config)
		{
			config = Object.values(IMPORT_SETTINGS[moduleKey] || {})
				.find(c => c.key === settingKey)
				|| Object.values(IMPORT_SETTINGS[moduleKey] || {})
					.find(c => (settingKey instanceof Element && c.elementId === (settingKey as Element)?.getAttribute('name')) || c.elementId === settingKey);

			if(!config) return null;
		}

		const stored = localStorage.getItem(config.key);
		if(stored)
		{
			if(!config.type) return stored;
			if(config.type === 'boolean') return stored === 'true';
			if(config.type === 'csv') return stored.split(';').filter(Boolean);
			if(config.type === 'json' || config.type === 'array')
			{
				try
				{
					const parsed = JSON.parse(stored);
					if(config.type === 'array')
					{
						return Array.isArray(parsed) ? parsed : [];
					}
					return parsed;
				} catch(e)
				{
					console.error(e);
					debugger;
					return stored || config.default;
				}
			}
		}

		if(config.elementId)
		{
			const el = document.getElementById(config.elementId) as HTMLInputElement | null;
			if(el)
			{
				return (config.type === 'boolean' || el.type === 'checkbox') ? el.checked : el.value;
			}
		}

		return config.default;
	}

	/**
	 * 5. Spawns the in-memory filesystem changes and updates the target workspace editor
	 */
	public async settings(): Promise<FileOpenTuple>
	{
		const database = `${RepositoryToolbar.owner?.value}/${RepositoryToolbar.repository?.value}`;
		const filePath = `settings${nextTemp()}.json`;

		if(luminoSelf.engineRepository?.startsWith('Quake3e'))
		{
			console.error('Assertion owner set to Quake3e instead of briancullinan');
			debugger;
		}

		this.previousSettings = this.exportPayload();
		const settingsString = JSON.stringify(this.previousSettings, null, 4);
		const newSha = await getGitShaBrowser(settingsString);

		if(filesRepo[database])
		{
			filesRepo[database][filePath] = {
				timestamp: new Date(),
				mode: FS_FILE,
				contents: new TextEncoder().encode(settingsString),
				path: filePath,
				sha: newSha,
				parent: filePath.substring(0, filePath.lastIndexOf('/'))
			};
		}

		return [filePath, 'settings.json', settingsString];
	}


	private storeValue(config: SettingConfig, value: any)
	{
		if(config.type === 'array')
		{
			if(!Array.isArray(value)) localStorage.setItem(config.key, JSON.stringify([value]));
			else localStorage.setItem(config.key, JSON.stringify(value));
		} else if(config.type === 'csv')
		{
			if(typeof value === 'string') localStorage.setItem(config.key, value);
			else if(Array.isArray(value)) localStorage.setItem(config.key, value.join(';'));
			else localStorage.setItem(config.key, value.toString());
		} else if(config.type === 'json' || Array.isArray(value))
		{
			localStorage.setItem(config.key, JSON.stringify(value));
		} else
		{
			localStorage.setItem(config.key, value);
		}
	}

	/**
	 * 6. Processes incoming editor session content directly down to layout targets
	 */
	public saveSettings(content: string): void
	{
		try
		{
			const freshSettings = JSON.parse(content);

			for(const [moduleKey, settings] of Object.entries(IMPORT_SETTINGS))
			{
				for(const [camelKey, config] of Object.entries(settings))
				{
					if(freshSettings[config.key] !== undefined)
					{
						const value = freshSettings[config.key];

						this.storeValue(config, value);

						if(this.previousSettings && value !== this.previousSettings[config.key]?.currentValue)
						{
							this.applyValue(config, value);
						}
					}
				}
			}
		} catch(e: any)
		{
			console.warn(`${e.message}\n\r${e.stack || e.stacktrace}`);
		}
	}
}

export const SettingsManager = Settings.instance;

