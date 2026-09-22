import type { GithubWindow } from "../bundle/github.d";
import { config, dirs, path } from "../bundle/global";
import type { FileRecord } from "../bundle/local.d";
import type { LoggingWindow } from "../bundle/logging.d";
import type { GlobalToolbarsWindow, RepositorySettingsWindow } from "../bundle/menu.d";
import type { TerminalWindow } from "../terminal/widget.d";
import type { ApiWindow, MockAPI, WorkerWindow } from "./worker.d";


export interface MakeWindow
{
	mkdirp?: (path: string, database: string) => Promise<void>;
	buildLBurg?: (database?: string | null, forceChanged?: boolean, noLinking?: boolean) => Promise<void>;
	linkLburg?: (database?: string | null, forceChanged?: boolean, noBuild?: boolean) => Promise<void>;
	buildRCC?: (database?: string | null, skipTool?: boolean, forceChanged?: boolean, noLinking?: boolean) => Promise<void>;
	linkRCC?: (database?: string | null, forceChanged?: boolean, noBuild?: boolean) => Promise<void>;
	buildCPP?: (database?: string | null, forceChanged?: boolean, noLinking?: boolean) => Promise<void>;
	linkCPP?: (database?: string | null, forceChanged?: boolean, noBuild?: boolean) => Promise<void>;
	buildLCC?: (database?: string | null, forceChanged?: boolean, noLinking?: boolean) => Promise<void>;
	linkLCC?: (database?: string | null, forceChanged?: boolean, noBuild?: boolean) => Promise<void>;
	buildAsmTool?: (database?: string | null, forceChanged?: boolean, noLinking?: boolean) => Promise<void>;
	linkAsm?: (database?: string | null, forceChanged?: boolean, noBuild?: boolean) => Promise<void>;
	buildTools?: (database?: string | null, toolName?: string, forceChanged?: boolean, noBounce?: boolean) => Promise<void>;
	buildQVM?: (database?: string | null, forceChanged?: boolean, noBounce?: boolean) => Promise<void>;
	buildClient?: (database?: string | null, forceChanged?: boolean, noLinking?: boolean, noBounce?: boolean) => Promise<void>;
	buildShaders?: (database?: string | null, forceChanged?: boolean) => Promise<boolean | void>;
	downloadHeaders?: (headers: any, batchSize?: number, database?: string | null) => Promise<void>;
	buildStringify?: (database?: string | null, forceChanged?: boolean, noLinking?: boolean) => Promise<void>;
	buildModule?: (name?: string, sourceDir: string, filesList: string[], database?: string | null, extraDefines?: string[], forceChanged?: boolean, noLinking?: boolean, noBounce?: boolean) => Promise<void>;
	linkStringify?: (database?: string | null, forceChanged?: boolean, noBuild?: boolean) => Promise<void>;
	linkEngine?: (database?: string | null, forceChanged?: boolean, noBuild?: boolean) => Promise<void>;
	prepInputOutput?: (file: string, obj?: string | null, database?: string | null, makeDirs?: boolean) => Promise<void>;
	linkModule?: (database?: string | null, name?: string, sourceDir?: string, filesList?: string[], forceChanged?: boolean, noModule?: boolean, noBounce?: boolean) => Promise<void>;
	updateGlobalBufferAndViews?: () => void;
	BUILDCFLAGS?: (config?: string | null) => string[];

}

export interface MakeSystemGlobals
{
	BUILD_SCRIPTS?: string[];
	TERMINATE?: boolean;
	needsHeaders?: boolean;
	q3asmFiles?: string[];
	q3uiFiles?: string[];
	uiFiles?: string[];
	gameFiles?: string[];
	cgameFiles?: string[];
	qvmHeaders?: string[];
	asmToolHeaders?: string[];
	lccToolHeaders?: string[];
	q3eCommonHeaders?: string[];
	undefinedFlags?: string[];
	includeFlags?: string[];
	toolLdFlags?: string[];
	CFLAGS?: string[];
	LDFLAGS?: string[];
	QVMLIB_CFLAGS?: string[];
	LCC_CFLAGS?: string[];
	building?: boolean;
	buildDebounce?: ReturnType<typeof setTimeout> | undefined;
	runningWorker?: boolean;
}

export interface BuildWindow
{
	SYS?: any;
	FILED?: any;
	FS: {
		virtual: Record<string, FileRecord | null | undefined>;
		pointers?: ([number, string, FileRecord, string, number, number])[];
	};
	path: typeof path;
	config: typeof config;
	dirs: typeof dirs;
	ENGINE_MEMORY_BASE?: number;
	UI_MEMORY_BASE?: number;
	CGAME_MEMORY_BASE?: number;
	GAME_MEMORY_BASE?: number;
	COMPILE_PLATFORM?: string;
	COMPILE_ARCH?: string;
	GAME_PLATFORM?: string;
	GAME_ARCH?: string;
}


export interface CompilerWindow extends
	RepositorySettingsWindow,
	GithubWindow,
	GlobalToolbarsWindow,
	LoggingWindow,
	MakeSystemGlobals,
	TerminalWindow
{

}

export interface JavascriptLogger extends
	LoggingWindow,
	MakeSystemGlobals,
	ApiWindow
{

}

export interface MakeQVMWindow extends
	BuildWindow,
	MakeWindow,
	ApiWindow,
	MakeSystemGlobals,
	RepositorySettingsWindow,
	GlobalToolbarsWindow,
	GithubWindow
{

}


export interface SharedWindow extends
	MakeQVMWindow,
	WorkerWindow,
	LoggingWindow
{

}

