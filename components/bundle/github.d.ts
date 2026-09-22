import type { ApiWindow } from "../bundle/worker.d";
import type { NestedTreeNode } from "./github-tools";
import type { GitHubBranch, GitHubFileEntry } from "./github-types";
import type { LocalWindow } from "./local.d";
import type { RepositorySettingsWindow } from "./menu.d";


export interface ProgressDetails
{
	loaded: number;
	total: number;
	percent: number;
	stage?: string;
}

export type ProgressFunction = (progress: ProgressDetails) => void;


export interface GithubWindow extends RepositorySettingsWindow, LocalWindow, ApiWindow
{
	downloadRepoZip?: (ownerName: string, repo: string, branch = 'master', database: string | null = null, onProgress?: ProgressFunction) => Promise<string | undefined | null>;
	getBranchVersion?: (ownerName: string, repo: string, branch?: string) => Promise<Date>;
	githubRequest?: (ownerName: string, repoName: string, url: string, authorize?: boolean, buffer?: boolean) => Promise<any | ArrayBuffer>;
	loadGitHubTree?: (repoOwner: string, repoName: string, branch: string, path?: string) => Promise<Record<string, GitHubFileEntry> | undefined>;
	getBranches?: (repoOwner: string | undefined, repoName: string | undefined) => Promise<GitHubBranch[]>;
	getDefaultBranch?: (ownerName: string, repo: string) => Promise<string>;
	searchGitHubCode?: (query: string, activeRepositories: string[], token: string | null) => Promise<any[]>;
	sortNodes?: (nodes: NestedTreeNode[]) => NestedTreeNode[];
	convertFlatToNested?: (data: FlatFileNode[]) => NestedTreeNode[];
	getGitShaBrowser?: (content: string | Uint8Array | ArrayBuffer) => Promise<string>;
	getGitSha256Browser?: (content: string | Uint8Array | ArrayBuffer) => Promise<string>;
	getAuthenticatedUser?: () => Promise<any>;

	downloadRepoNew(
		owner: string,
		repo: string,
		branch: string = 'master',
		database: string | null = null,
		onProgress?: ProgressFunction | null
	): Promise<number>;

	cacheFile?: (
		storeName: string,
		repoOwner: string,
		repoName: string,
		filePath: string,
		sha?: string | null,
		forceReload?: boolean
	) => Promise<ArrayBuffer | Uint8Array | FileSystemDirectoryHandle | FileSystemFileHandle | null | undefined>;

	// Direct IndexedDB / GitHub Worker Network Methods
	cacheFileInternal?: (
		storeName: string,
		repoOwner: string,
		repoName: string,
		localPath: string,
		sha?: string | null,
		forceReload?: boolean
	) => Promise<ArrayBuffer | Uint8Array | FileSystemDirectoryHandle | FileSystemFileHandle | null | undefined>;

	trees?: Record<string, any>;
	filesRepo?: Record<string, Record<string, GitHubFileEntry> | undefined>;
	mapFiles?: Record<string, string>;
	githubToken?: string;
}
