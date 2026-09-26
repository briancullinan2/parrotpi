import type { GitHubBranchLike } from "./github-settings";
import type { RepositoryToolbar } from "./menu-repos";
import type { Settings } from "./settings";

// Assuming external imports for referenced types
import type { CommandRegistry } from "@lumino/commands";
import type { BoxPanel, Menu, MenuBar, Widget } from "@lumino/widgets";
import type { AceEditorWidget } from "../editor/widget";
import type { ApplicationToolbar } from "./menu-app";
import type { FileListWidget } from "./file-list-widget";
import type { FileManager } from "./lumino-files";
import type { FileToolbar } from "./menu-file";
import type { HistoryToolbar } from "./menu-history";
import type { LayoutAdjuster, LayoutState } from "./lumino-widget";
import type { ControlConfig } from "./menu-settings";
import type { MenuConfig } from './menu-manager';
import type { SettingConfig } from './settings';
import type { ScriptToolbar } from "./menu-script";
import type { SearchService } from "./lumino-search";
import type { SettingsToolbar } from "./menu-settings";
import type { GithubService } from "./github-worker";

// ============================================================================
// 1. TOOLBARS & COMPONENT INSTANCES / CONSTRUCTORS
// ============================================================================
/**
 * Global UI Toolbars, Managers, and Component Constructors.
 * Follows the pattern: camelCase for live instances, PascalCase for constructors.
 */
export interface GlobalToolbarsWindow
{
	// Toolbars (Instances & Constructors)
	repositoryToolbar?: RepositoryToolbar;
	RepositoryToolbar?: typeof RepositoryToolbar;

	historyToolbar?: HistoryToolbar;
	HistoryToolbar?: typeof HistoryToolbar;

	settingsToolbar?: SettingsToolbar;
	SettingsToolbar?: typeof SettingsToolbar;

	scriptToolbar?: ScriptToolbar;
	ScriptToolbar?: typeof ScriptToolbar;

	appToolbar?: ApplicationToolbar;
	ApplicationToolbar?: typeof ApplicationToolbar;

	fileToolbar?: FileToolbar;
	FileToolbar?: typeof FileToolbar;

	// Managers & Widget Constructors
	settingsManager?: Settings;
	SettingsManager?: typeof Settings;

	fileManager?: FileManager;
	FileManager?: typeof FileManager;

	aceEditorWidget?: AceEditorWidget;
	AceEditorWidget?: typeof AceEditorWidget;

	spawnPoints: Record<string, string>;
	searchWorker?: Worker;

	searchService?: SearchService;
	SearchService?: typeof SearchService;

	githubService?: GithubService;
	GithubService?: typeof GithubService;

	layoutAdjuster?: LayoutAdjuster;
	LayoutAdjuster?: typeof LayoutAdjuster;
}

// ============================================================================
// 4. WORKSPACE REPOSITORIES & SETTINGS CONFIGURATION
// ============================================================================
/**
 * Workspace active repository bindings, dropdown select option sync, and settings controls.
 */
export interface RepositorySettingsWindow
{
	// Active Selected Workspace Repositories
	engineRepository?: string | null;
	gameRepository?: string | null;
	assetRepository?: string | null;
	toolsRepository?: string | null;
	tools2Repository?: string | null;
	environmentRepository?: string | null;

	// Configuration & Options Helpers
	SETTINGS_CONTROLS?: ControlConfig[];
	IMPORT_SETTINGS?: Record<string, Record<string, SettingConfig>>;
	MODULE_REGISTRY?: Record<string, ComponentRoute>;
	TERMINAL_REGISTRY?: TerminalFilter[];

	updateSelectOptions?: (
		elementId: string | Element | undefined | null,
		items: Record<string, string> | Array<string | GitHubBranchLike>,
		selectedValue?: string
	) => void;
	addRepoIfNotExists?: (newRepo: string) => void;
	addOwnerIfNotExists?: (newOwner: string) => void;
}

// ============================================================================
// 3. COMMAND REGISTRY & MENU SYSTEM
// ============================================================================
/**
 * Lumino CommandRegistry, MenuBars, and dynamic menu injection / registration hooks.
 */
export interface LuminoMenuWindow
{
	commandRegistry?: CommandRegistry;
	globalMenuBar?: MenuBar;
	tabsMenu?: Menu;

	triggerPanelRoute?: (panelId: string, mainDock: DockPanel, noHide?: boolean) => Promise<void>;
	registerAllCommands?: (menuItems: MenuConfig[] | MenuConfig, commands?: CommandRegistry) => void;
	injectMenus?: (ownerId: string, config: MenuConfig[] | MenuConfig) => void;
	removeMenus?: (ownerId: string) => void;
}
