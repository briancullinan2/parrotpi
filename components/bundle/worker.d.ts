

import JSZip from "jszip";
import type { BuildWindow, MakeSystemGlobals, MakeWindow } from "./make.d";
import type { LocalWindow } from "../bundle/local.d";
import type { GithubWindow } from "../bundle/github.d";


export interface MockAPI
{
	github_token?: string | null;
	worker?: Worker;
	memfs?: any;
	configuration?: string | null;
	database?: string | null;
	width?: number | null;
	toolsRepo?: string;
	toolsRepo2?: string;
	engineRepo?: string;
	gameRepo?: string;
	assetRepo?: string;
	environmentRepository?: string;
	ready?: boolean;
	build?: (database?: string, action?: string) => Promise<any>;
	run?: (options?: WorkerCommandOptions) => Promise<any>;
	link?: (options?: WorkerCommandOptions) => Promise<any>;
	header?: (owner: string, repo: string, header: any, database?: string) => Promise<any>;
	hostWrite?: (text: any, source?: any) => void;
	compile?: (options?: WorkerCommandOptions) => Promise<any>;
	remove?: (filename: string) => Promise<any>;
	terminate?: () => void;
}

/** Callback registry internal state */
interface ResponseCallback
{
	resolve: (value: any) => void;
	reject: (reason?: any) => void;
	timeoutId: ReturnType<typeof setTimeout>;
}

/** Options passed into the WorkerAPI constructor */
interface WorkerAPIOptions
{
	configuration?: 'release' | 'debug' | string;
	hostWrite?: (text: any, source?: any) => void;
	[key: string]: any;
}

/** Configuration/Repo options accepted by inject and worker execution methods */
interface WorkerCommandOptions
{
	configuration?: 'release' | 'debug' | string;
	database?: string | null;
	width?: number;
	github_token?: string | null;
	toolsRepo?: string | null;
	toolsRepo2?: string | null;
	engineRepo?: string | null;
	gameRepo?: string | null;
	assetRepo?: string | null;
	environmentRepository?: string;
	[key: string]: any;
}

declare interface WorkerAPI extends MockAPI
{
	nextResponseId?: number;
	responseCBs?: Map<number, ResponseCallback>;
	worker?: Worker;
	port?: MessagePort;
	configuration?: string;
	width?: number;
	database?: string;
	width?: number;
	toolsRepo?: string;
	toolsRepo2?: string;
	engineRepo?: string;
	gameRepo?: string;
	assetRepo?: string;
	environmentRepository?: string;
	memfs?: any;
	ready?: boolean;
	ready?: Promise<any>;
	github_token?: string | null;

	hostWrite?: (text: any, source?: any) => void;

	setShowTiming?: (value: boolean | any) => void;
	terminate?: () => void;
	inject?: (options: WorkerCommandOptions) => void;

	runAsync?: (id: string, options?: any) => Promise<any>;
	compileToAssembly?: (options?: WorkerCommandOptions) => Promise<any>;
	compileTo6502?: (options?: WorkerCommandOptions) => Promise<any>;
	upload?: (options?: WorkerCommandOptions | string) => Promise<any>;
	download?: (options?: WorkerCommandOptions) => Promise<any>;
	header?: (owner: string, repo: string, header: any, database?: string | undefined) => Promise<any>;
	compile?: (options?: WorkerCommandOptions) => Promise<any>;
	build?: (database?: string, action?: string) => Promise<any>;
	run?: (options?: WorkerCommandOptions) => Promise<any>;
	link?: (options?: WorkerCommandOptions) => Promise<any>;

	compileLinkRun?: (contents: string, width?: number) => void;
	postCanvas?: (offscreenCanvas: OffscreenCanvas) => void;
	remove?: (filename: string) => Promise<any>;
	onmessage?: (event: MessageEvent) => void;
}


export interface ApiWindow
{
	api?: WorkerAPI | MockAPI;
}


export interface WorkerWindow extends
	ApiWindow,
	LocalWindow,
	BuildWindow,
	MakeSystemGlobals
{
	JSZip?: typeof JSZip;
	API?: typeof WorkerAPI;
	importScripts?: (...urls: (string | URL)[]) => void;
}

export interface ServiceWorkerEvent extends Event
{
	waitUntil: (promise: Promise<any>) => void;
}


export interface InstallEvent extends ServiceWorkerEvent
{
}

export interface ActivateEvent extends ServiceWorkerEvent
{

}

export interface ServiceWorkerEventMap
{
	"install": InstallEvent;
	"activate": ActivateEvent;
	"fetch": FetchEvent;
}


export interface ServiceWorkerWindow extends
	GithubWindow,
	LocalWindow,
	ApiWindow
{
	__assetsManifest: { path: string, size: number; }[];

	addEventListener<K extends keyof ServiceWorkerEventMap>(type: K, listener: (this: Worker, ev: ServiceWorkerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	skipWaiting: () => void;

	clients: {
		claim: () => void;
	};

	registration: {
		active?: {
			scriptURL: string;
		};
		unregister: () => void;
	};
}


