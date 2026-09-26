import type { GitHubBranchLike } from "../bundle/github-settings";
import type { RepositoryToolbar } from "../bundle/menu-repos";
import type { Settings } from "../bundle/settings";
import type { GlobalToolbars, GlobalToolbarsWindow, SettingsWindow } from '../bundle/menu.d';
import type { GithubWindow } from '../bundle/github.d';
import type { LocalWindow } from "../bundle/local.d";
import type { FileListWidget, GameListWidget } from "./widget";
import type { LuminoWindow } from '../bundle/lumino.d';
import type { ApiWindow, WorkerWindow } from "../bundle/worker.d";
import type { BuildWindow } from "../bundle/make.d";


type PermissionState = 'granted' | 'denied' | 'prompt';


interface FileSystemHandle extends FileSystemDirectoryHandle
{
	queryPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
	requestPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
}

export interface DirectoryPickerOptions
{
	/** An optional string identifier to remember the last opened directory */
	id?: string;
	/** Defaults to "read" for read-only access or "readwrite" for read/write access */
	mode?: 'read' | 'readwrite';
	/** A FileSystemHandle or a well-known directory name ("desktop", "documents", "downloads", "music", "pictures", "videos") */
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}


export interface FilelistWindow extends EditorUtilities, GlobalToolbars, SettingsWindow, GithubWindow, LocalWindow, LuminoWindow
{
	loadFileTree?: (repoOwner: string, repoName: string, branch: string, selector: string) => Promise<void>;
	fileListWidgets?: Array<FileListWidget>;
	showDirectoryPicker?: (
		options?: DirectoryPickerOptions
	) => Promise<FileSystemDirectoryHandle>;
	getRegistryIdFromWidget(widget: string | HTMLElement | FileListWidget): string | null | undefined | void;
	FileListWidget?: typeof FileListWidget;
	GameListWidget?: typeof GameListWidget;
}

declare var self: Window & FilelistWindow & typeof globalThis;

export interface GithubWorkerWindow extends ApiWindow, GithubWindow, GlobalToolbarsWindow, BuildWindow, WorkerWindow
{

}

export type GithubChanges = {
	modified: FileRecord[],
	added: FileRecord[],
	deleted: FileRecord[],
	treeEntries: FileRecord[];
};

export interface CommitWorkerWindow extends ApiWindow, GithubWindow, WorkerWindow
{

}


export interface WidgetErrorEventArgs
{
	source: Widget;
	error: Error | string;
	fallbackType?: string;
}


interface DriveFile
{
	id: string;
	name: string;
	mimeType: string;
	thumbnailLink?: string;
	webContentLink?: string;
}

