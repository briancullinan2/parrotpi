import type { SettingConfig } from "../bundle/settings";
import type { FileListWidget } from "./widget";
import type { GitHubFileEntry } from "../bundle/github-types";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { FilelistWindow, FileSystemHandle } from "./widget.d";


const filelistSelf: LuminoLayoutWindow & GlobalToolbarsWindow & FilelistWindow & LuminoMenuWindow = self as unknown as any;

interface FileSystemHandlePermissionDescriptor
{
	mode?: 'read' | 'readwrite';
}


export const LOCAL_SETTINGS: Record<string, Record<string, SettingConfig>> = {
	filelist: {
		defaultLocation: {
			key: 'default_location',
			default: '',
			elementId: filelistSelf.RepositoryToolbar?.locations?.id,
			description: 'The fallback or preferred primary repository string formatted as "owner/repo" used when loading the workspace workspace initial state.',
			get: (storage: string | null, defaultLocation: string): string =>
			{
				return filelistSelf.RepositoryToolbar?.locations?.value
					? filelistSelf.RepositoryToolbar.locations.value
					: (storage || defaultLocation);
			},
		},
		engineLocation: {
			key: 'engine_location',
			default: '',
			description: 'The specific local folder designated for compiling the core Quake 3 WebAssembly engine architecture.',
		},
		gameLocation: {
			key: 'game_location',
			default: '',
			description: 'The local folder source housing the game logic mod components, including cgame, game, and ui modules.',
		},
		assetLocation: {
			key: 'asset_location',
			default: '',
			description: 'Optional local folder dedicated to static game assets, maps, texturing bundles, or audio assets required to run the game.',
		},
		toolsLocation: {
			key: 'tools_location',
			default: '',
			description: 'Primary compiler tooling local folder containing components such as q3lcc (the Quake 3 ANSI C compiler targeting virtual machine bytecode).',
		},
		tools2Location: {
			key: 'tools_location',
			default: '',
			description: 'Secondary toolchain local folder hosting utilities like q3asm to assemble the intermediate bytecode files into final .qvm files.',
		},
		rendererLocation: {
			key: 'renderer_location',
			default: '',
			description: 'Local folder handling the graphical subsystems and pipeline routines tasked with translating engine calculations to browser contexts.',
		},
		environmentLocation: {
			key: 'environment_location',
			default: '',
			description: 'Local folder for this workspace, the entire IDE, code editor and engine runner, for editing the environment inside the workspace.',
		},
	}
};


export async function verifyPermission(
	fileHandle: FileSystemHandle,
	readWrite: boolean = true
): Promise<boolean>
{
	const options: FileSystemHandlePermissionDescriptor = {
		mode: readWrite ? 'readwrite' : 'read'
	};

	// Check if permission was already granted
	if((await fileHandle.queryPermission(options)) === 'granted')
	{
		return true;
	}

	// Request permission from the user
	if((await fileHandle.requestPermission(options)) === 'granted')
	{
		return true;
	}

	return false;
}


export function getSettingFromRegistryId(widgetHandle?: string | null | undefined | void): string
{
	if(widgetHandle === 'filelist')
	{
		return 'engine_location';
	}
	else if(widgetHandle === 'gamelist')
	{
		return 'game_location';
	}
	else if(widgetHandle === 'assetlist')
	{
		return 'asset_location';
	}
	else
	{
		return 'default_location';
	}
}


export function getRegistryIdFromWidget(widget: string | HTMLElement | FileListWidget): string | null | undefined | void
{
	let selectedRespository: string | undefined;
	if(widget instanceof HTMLElement)
	{
		widget = (Array.from(filelistSelf.mainDock?.widgets() ?? []).find(w =>
			w.node === widget || (widget as HTMLElement).closest('.lm-Widget') === w.node
		) as FileListWidget);
	}

	if(widget instanceof filelistSelf.FileListWidget!)
	{
		if(widget instanceof filelistSelf.GameListWidget!)
		{
			return 'gamelist';
		}
		else if(widget.constructor.name === 'AssetListWidget')
		{
			return 'assetlist';
		}
		else if(widget.constructor.name === 'FileListWidget')
		{
			return 'filelist';
		}
		else if(widget.constructor.name === 'DatabaseListWidget')
		{
			return 'database';
		}
		else
		{
			selectedRespository = widget.defaultRepository;
		}
	}
	else if(typeof widget === 'string')
	{
		const entry = Object.entries(filelistSelf.IMPORT_SETTINGS?.github ?? {})
			.find(([propName, config]) =>
			{
				if(propName === widget)
				{
					return true;
				} else if(filelistSelf.settingsManager?.get('github', propName) === widget)
				{
					return true;
				}
			});
		if(entry)
		{
			selectedRespository = entry[0];
		}
	}

	if(!selectedRespository)
	{
		return;
	}

	if(selectedRespository === filelistSelf.settingsManager?.get('github', 'engineRepository'))
	{
		return 'filelist';
	}

	if(selectedRespository === filelistSelf.settingsManager?.get('github', 'gameRepository'))
	{
		return 'gamelist';
	}

	if(selectedRespository === filelistSelf.settingsManager?.get('github', 'assetRepository'))
	{
		return 'assetlist';
	}

}


filelistSelf.getRegistryIdFromWidget = getRegistryIdFromWidget;


export async function treeHandler(selector: string, e: Event): Promise<void>
{
	const target = e.target as HTMLElement | null;
	if(!target) return;

	const node = target.closest('.treejs-node') as HTMLElement | null;
	if(!node) return;

	const fileId = node.getAttribute('data-id');
	if(!fileId) return;

	// Fixed bug: changed .endsWith['...'] to .endsWith('...')
	if(fileId.endsWith('[Recursive]'))
	{
		return;
	}

	if(node.classList.contains('treejs-placeholder'))
	{
		const tree = filelistSelf.trees?.[selector];
		if(!tree || !tree.nodesById[fileId]) return;

		const filePath = tree.nodesById[fileId].path;

		await filelistSelf.FileManager?.navigateFile(filePath);
	}
}


export function configureFileHandle(newLocation: FileSystemDirectoryHandle, config?: SettingConfig): string | undefined
{
	if(!newLocation || typeof newLocation === 'string' || newLocation.name.includes('briancullinan2'))
	{
		return;
	}

	const handleValue = `${config?.key}/${newLocation.name}-${filelistSelf.nextTemp?.()}`;

	if(newLocation.name.trim().length > 0 && !filelistSelf.RepositoryToolbar?.locations?.querySelector(`option[value="${handleValue}"]`))
	{
		const option = document.createElement('option');

		option.value = handleValue;
		option.textContent = newLocation.name;

		filelistSelf.RepositoryToolbar?.locations?.appendChild(option);
	}

	return handleValue;
}

export async function listDirectory(
	dirHandle: FileSystemDirectoryHandle,
	relPath: string = ''
): Promise<Record<string, GitHubFileEntry>>
{
	const records: Record<string, GitHubFileEntry> = {};

	for await(const entry of dirHandle.values())
	{
		if(entry.kind === 'file')
		{
			const fileHandle = entry as FileSystemFileHandle;
			let size: number | undefined;
			let timestamp: Date | null = null;

			try
			{
				const file = await fileHandle.getFile();
				size = file.size;
				timestamp = new Date(file.lastModified);
			} catch
			{
				// If permission or handle access fails temporarily, fall back gracefully
			}

			records[entry.name] = {
				name: entry.name,
				path: entry.name,
				type: 'file',
				mode: filelistSelf.FS_FILE ?? (0o100000 | 0o666),
				size: size,
				timestamp: timestamp,
				contents: fileHandle,
				parent: relPath || null
			};
		} else if(entry.kind === 'directory')
		{
			const subDirHandle = entry as FileSystemDirectoryHandle;

			records[entry.name] = {
				name: entry.name,
				path: entry.name,
				type: 'dir',
				mode: filelistSelf.FS_DIR ?? (0o040000 | 0o755),
				contents: subDirHandle,
				parent: relPath || null
			};
		}
	}

	return records;
}

