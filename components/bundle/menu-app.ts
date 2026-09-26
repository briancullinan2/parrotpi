import { CommandRegistry } from "@lumino/commands";
import { DockPanel, Widget } from "@lumino/widgets";
import { triggerPanelRoute } from "./menu";
import { SettingsManager } from "./settings";
import { loadAndInstantiate } from "./babel-compile";
import { LayoutAdjuster } from "./lumino-widget";
import { LuminoLayoutNode, serializeDockLayout } from "./lumino-resize";
import type { GlobalToolbarsWindow } from "./menu.d";
import type { LuminoLayoutWindow } from "./lumino.d";

const menuSelf: GlobalToolbarsWindow & LuminoLayoutWindow = self as unknown as any;

export class ApplicationToolbar extends Widget
{
	private static _instance: ApplicationToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'application-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): ApplicationToolbar
	{
		if(!ApplicationToolbar._instance)
		{
			ApplicationToolbar._instance = new ApplicationToolbar();
			menuSelf.appToolbar = ApplicationToolbar._instance;
		}
		return ApplicationToolbar._instance;
	}

	public initialize(commands: CommandRegistry): ApplicationToolbar
	{
		this._commands = commands;
		this._registerCommands();
		return this;
	}

	private _registerCommands()
	{
		if(!this._commands)
		{
			return;
		}

		if(!this._commands.hasCommand('app-fullscreen'))
		{
			this._commands.addCommand('app-fullscreen', {
				label: 'Fullscreen Mode',
				iconClass: 'bx bx-fullscreen',
				execute: () =>
				{
					if(document.fullscreenElement === document.body)
					{
						document.exitFullscreen();
					} else
					{
						document.body.requestFullscreen();
					}
				}
			});
		}

		if(!this._commands.hasCommand('app-github-login'))
		{
			this._commands.addCommand('app-github-login', {
				label: 'Github Login',
				iconClass: 'bx bx-key',
				execute: async () =>
				{
					window.open('https://github.com/settings/tokens?type=beta', '_blank');
					const modal = await loadAndInstantiate({
						label: 'Enter Github Token',
						url: './components/layout/token-modal.ts',
						className: 'TokenModal',
						iconClass: 'bx bx-key'
					});
					modal.updatePlaceholder();
				}
			});
		}

		if(!this._commands.hasCommand('app-toggle-console'))
		{
			this._commands.addCommand('app-toggle-console', {
				label: 'Console',
				iconClass: 'bx bx-terminal',
				execute: async () =>
				{
					if(menuSelf.mainDock)
					{
						await triggerPanelRoute('terminal-container', menuSelf.mainDock);
					}
				}
			});
		}

		if(!this._commands.hasCommand('app-edit-settings'))
		{
			this._commands.addCommand('app-edit-settings', {
				label: 'Edit Settings',
				iconClass: 'bx bx-gear',
				execute: async () =>
				{
					const [fileId, fileName, settingsJson] = await SettingsManager.settings();
					menuSelf.AceEditorWidget?.openFileInNewTab(fileId ?? 'settings.json', fileName ?? 'settings.json', settingsJson ?? '');
				}
			});
		}

		if(!this._commands.hasCommand('app-share-link'))
		{
			this._commands.addCommand('app-share-link', {
				label: 'Shareable Link',
				iconClass: 'bx bx-share',
				execute: () =>
				{
					// TODO: reverse proxy setup
					navigator.clipboard.writeText(window.location.href);
				}
			});
		}

		if(!this._commands.hasCommand('app-toggle-layout'))
		{
			this._commands.addCommand('app-toggle-layout', {
				label: 'Toggle Layout',
				iconClass: 'bx bx-iframe',
				execute: rotateLayout
			});
		}
	}

	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <button id="top-bar-btn-github" title="Github Login" class="bx bx-key"></button>
            <button id="top-bar-btn-console" title="Console" class="bx bx-terminal"></button>
            <button id="top-bar-btn-settings" title="Edit Settings" class="bx bx-gear"></button>
            <button id="top-bar-btn-link" title="Sharable Link" class="bx bx-share"></button>
            <button id="top-bar-btn-layout" title="Toggle Layout" class="bx bx-iframe"></button>
            <button id="top-bar-btn-fullscreen" title="Fullscreen Mode" class="bx bx-fullscreen"></button>
        `;

		this.node.querySelector('#top-bar-btn-github')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-github-login');
		});

		this.node.querySelector('#top-bar-btn-console')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-toggle-console');
		});

		this.node.querySelector('#top-bar-btn-settings')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-edit-settings');
		});

		this.node.querySelector('#top-bar-btn-link')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-share-link');
		});

		this.node.querySelector('#top-bar-btn-layout')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-toggle-layout');
		});

		this.node.querySelector('#top-bar-btn-fullscreen')?.addEventListener('click', () =>
		{
			this._commands?.execute('app-fullscreen');
		});
	}
}

menuSelf.ApplicationToolbar = ApplicationToolbar;


// TODO: lumino-resize and lumino-widget will adjust their behavior based on the selected layout
//   switching split-left and split-right

export type LayoutState = {
	panels: 'left-hand-files' | 'right-hand-files';
	order: 'normal-order' | 'reverse-order';
	terminal: 'terminal' | 'no-terminal';
	mode: 'full-mode' | 'focus-mode';
};

export type AXES = keyof LayoutState; // Automatically stays in sync!

// Each key MUST be an array containing ONLY its valid LayoutState values
export type LayoutAxesMap = {
	[K in keyof LayoutState]: LayoutState[K][];
};

export const LAYOUT_AXES: LayoutAxesMap = {
	panels: ['left-hand-files', 'right-hand-files'],
	order: ['normal-order', 'reverse-order'],
	terminal: ['terminal', 'no-terminal'],
	mode: ['full-mode', 'focus-mode']
};



function rotateLayout()
{
	if(!menuSelf.layoutState)
	{
		return;
	}

	(Object.keys(LAYOUT_AXES) as AXES[]).forEach((axis) =>
	{
		if(!menuSelf.layoutState)
		{
			return;
		}

		// Now 'axis' is typed as AXES ('panels' | 'order' | 'terminal' | 'mode')
		const variants = LAYOUT_AXES[axis];
		const matchedClass = variants.find(variant => document.body.classList.contains(`layout-${variant}`));

		if(matchedClass && menuSelf.layoutState)
		{
			(menuSelf.layoutState as Record<AXES, any>)[axis] = matchedClass;
			document.body.classList.remove(`layout-${matchedClass}`);
		}
	});

	const oldState = Object.assign({}, menuSelf.layoutState);

	const currentLayoutClass = `layout-${menuSelf.layoutState.panels} layout-${menuSelf.layoutState.order} layout-${menuSelf.layoutState.terminal} layout-${menuSelf.layoutState.mode}`;

	// Find where it lives in your 16-element permutation list
	const currentIndex = ALL_LAYOUTS.indexOf(currentLayoutClass);

	// Step forward by exactly +1, wrapping cleanly back to 0 when hitting the end boundary
	const nextIndex = (currentIndex + 1) % ALL_LAYOUTS.length;
	const newLayoutClass = ALL_LAYOUTS[nextIndex].split(' ');

	// 5. Inject it back onto the target DOM node element
	document.body.classList.add(...newLayoutClass);
	console.log(`🔄 Layout rotated from [${currentLayoutClass || 'None'}] ➡️ [${newLayoutClass}] (Index: ${nextIndex})`);
	(Object.keys(LAYOUT_AXES) as AXES[]).forEach((axis) =>
	{
		if(!menuSelf.layoutState)
		{
			return;
		}

		const matchedClass = LAYOUT_AXES[axis].find(variant => document.body.classList.contains(`layout-${variant}`));

		if(matchedClass)
		{
			(menuSelf.layoutState as Record<AXES, any>)[axis] = matchedClass;
		}
	});

	localStorage.setItem('layout', JSON.stringify(menuSelf.layoutState));
	// 6. Rearrange panels based on layout controls
	rearrangePanels(menuSelf.layoutState, oldState);

	return newLayoutClass;
}


async function rearrangePanels(state: LayoutState, oldState: LayoutState): Promise<void>
{
	const dockPanel = menuSelf.mainDock;
	if(!dockPanel) return;

	// ---------------------------------------------------------------------
	// 1. TERMINAL AXIS: Show/Hide Terminals
	// ---------------------------------------------------------------------
	if(state.terminal === 'terminal' && oldState.terminal === 'no-terminal')
	{
		if(!LayoutAdjuster._findBestEditorForProject(dockPanel, 'TerminalWidget', 'terminal'))
		{
			await triggerPanelRoute('terminal', dockPanel);
		}

		if(menuSelf.terminalWidgets)
		{
			for(let widget of menuSelf.terminalWidgets)
			{
				widget.show();
				LayoutAdjuster.addOptimalWidgetLayout(dockPanel, widget, {
					type: 'terminal',
					projectId: widget.constructor.name
				});
			}
		}
	}
	else if(state.terminal === 'no-terminal' && oldState.terminal === 'terminal')
	{
		if(menuSelf.terminalWidgets)
		{
			for(let widget of menuSelf.terminalWidgets)
			{
				widget.hide();
				widget.parent = null; // Detaches cleanly from the Lumino tree
			}
		}
	}

	// ---------------------------------------------------------------------
	// 2. PANELS AXIS: Move File Trees / Outlines (Left <-> Right)
	// ---------------------------------------------------------------------
	if(menuSelf.fileListWidgets && state.panels !== oldState.panels)
	{
		const isRightHand = state.panels === 'right-hand-files';
		const targetSide = isRightHand ? 'right' : 'left';
		const splitMode = isRightHand ? 'split-right' : 'split-left';

		// 1. Find the outermost widget on the target side (e.g. far-right paint tool or far-left outline)
		const outermostTarget = findOutermostWidget(dockPanel, targetSide)?.widget
			?? LayoutAdjuster._findNonOutline(dockPanel);

		let firstOutline: Widget | null = null;

		for(let widget of menuSelf.fileListWidgets)
		{
			if(!firstOutline)
			{
				firstOutline = widget;
				/*if(outermostTarget && outermostTarget !== widget)
				{
					// Dock directly on the outermost edge relative to the boundary widget
					dockPanel.addWidget(widget, { mode: splitMode, ref: outermostTarget });
				}
				else*/
				{
					// Fallback: omit 'ref' to split relative to the root dock container
					dockPanel.addWidget(widget, { mode: splitMode });
				}
			}
			else
			{
				// Stack any additional file list widgets as tabs inside the newly placed file panel
				dockPanel.addWidget(widget, { mode: 'tab-after', ref: firstOutline });
			}
		}
	}

	// ---------------------------------------------------------------------
	// 3. ORDER AXIS: Invert Editor & Terminal Vertical Split (Normal <-> Reverse)
	// ---------------------------------------------------------------------
	if(state.order !== oldState.order)
	{
		const primaryEditor = LayoutAdjuster._findNonOutlineOrTerminal(dockPanel);
		const terminals = menuSelf.terminalWidgets?.filter(w => w.isVisible && w.isAttached) || [];

		if(primaryEditor && terminals.length > 0)
		{
			const firstTerminal = terminals[0];

			if(state.order === 'reverse-order')
			{
				// Terminal on TOP, Editor on BOTTOM
				dockPanel.addWidget(firstTerminal, { mode: 'split-top', ref: primaryEditor });
			}
			else
			{
				// Normal order: Terminal on BOTTOM, Editor on TOP
				dockPanel.addWidget(firstTerminal, { mode: 'split-bottom', ref: primaryEditor });
			}

			// Stack remaining terminals inside the primary terminal's tab group
			for(let i = 1; i < terminals.length; i++)
			{
				dockPanel.addWidget(terminals[i], { mode: 'tab-after', ref: firstTerminal });
			}
		}
	}

	// ---------------------------------------------------------------------
	// 4. MODE AXIS: Focus Mode vs Full Mode
	// ---------------------------------------------------------------------
	if(state.mode !== oldState.mode)
	{
		if(state.mode === 'focus-mode')
		{
			// HIDE all File Lists
			if(menuSelf.fileListWidgets)
			{
				for(let widget of menuSelf.fileListWidgets)
				{
					widget.hide();
					widget.parent = null;
				}
			}

			// HIDE all Terminals
			if(menuSelf.terminalWidgets)
			{
				for(let widget of menuSelf.terminalWidgets)
				{
					widget.hide();
					widget.parent = null;
				}
			}
		}
		else if(state.mode === 'full-mode')
		{
			// RESTORE File Lists
			if(menuSelf.fileListWidgets)
			{
				for(let widget of menuSelf.fileListWidgets)
				{
					widget.show();
					LayoutAdjuster.addOptimalWidgetLayout(dockPanel, widget, {
						type: 'outline',
						projectId: widget.constructor.name
					});
				}
			}

			// RESTORE Terminals (only if state allows)
			if(state.terminal === 'terminal' && menuSelf.terminalWidgets)
			{
				for(let widget of menuSelf.terminalWidgets)
				{
					widget.show();
					LayoutAdjuster.addOptimalWidgetLayout(dockPanel, widget, {
						type: 'terminal',
						projectId: widget.constructor.name
					});
				}
			}
		}
	}

	// Force Lumino to compute the updated DOM geometry across all splits
	dockPanel.update();

	window.requestAnimationFrame(() =>
	{
		menuSelf.resizeHandler?.();
		const layout = menuSelf.mainDock?.saveLayout();
		localStorage.setItem('layout_config', JSON.stringify(serializeDockLayout(layout)));

		setTimeout(() =>
		{
			menuSelf.resizeHandler?.();
		}, 200);
	});
}

export interface BoundaryTarget
{
	/** Outermost leaf widget at the specified boundary */
	widget: Widget;
	/** The parent split-area node containing the boundary */
	parentSplit: LuminoLayoutNode | null;
	/** Total number of sibling splits in this boundary branch */
	siblingCount: number;
}

/**
 * Traverses the Lumino layout tree to find the outermost leaf widget and its
 * parent split-area container across any boundary edge ('left' | 'right' | 'top' | 'bottom').
 */
function findOutermostWidget(
	dockPanel: DockPanel,
	edge: 'left' | 'right' | 'top' | 'bottom'
): BoundaryTarget | null
{
	const layout = dockPanel.saveLayout() as unknown as { main: LuminoLayoutNode | null; };
	if(!layout || !layout.main) return null;

	let currentNode: LuminoLayoutNode | null = layout.main;
	let parentSplit: LuminoLayoutNode | null = null;

	while(currentNode)
	{
		if(currentNode.type === 'tab-area' && currentNode.widgets && currentNode.widgets.length > 0)
		{
			const firstRef = currentNode.widgets[0];
			const widgetId = typeof firstRef === 'string' ? firstRef : firstRef.id;

			const targetWidget = Array.from(dockPanel.widgets()).find(w => w.id === widgetId) || null;

			if(targetWidget)
			{
				return {
					widget: targetWidget,
					parentSplit: parentSplit,
					siblingCount: parentSplit?.children?.length || 1
				};
			}
			return null;
		}

		if(currentNode.type === 'split-area' && currentNode.children && currentNode.children.length > 0)
		{
			parentSplit = currentNode; // Track parent split node

			const isFirst = edge === 'left' || edge === 'top';
			const targetIndex: number = isFirst ? 0 : currentNode.children.length - 1;

			currentNode = currentNode.children[targetIndex];
		} else if(currentNode.children && currentNode.children.length > 0)
		{
			const isFirst = edge === 'left' || edge === 'top';
			const targetIndex: number = isFirst ? 0 : currentNode.children.length - 1;

			currentNode = currentNode.children[targetIndex];
		} else
		{
			break;
		}
	}

	return null;
}


const ALL_LAYOUTS = Object.values(LAYOUT_AXES).reduce((combinations: string[], currentAxisVariants) =>
{
	// If it's the first axis (panels), initialize the array with its base variants
	if(combinations.length === 0) return currentAxisVariants;

	// Cross-multiply the existing strings with the variants of the next axis
	return combinations.flatMap(existingString =>
		currentAxisVariants.map(variant => `${existingString} layout-${variant}`)
	);
}, []).map(combinedString => `layout-${combinedString}`);

/**
 * Type-safe property setter helper that correlates key K with value LayoutState[K].
 * Solves the TypeScript indexed assignment 'never' bug without needing `any`.
 */
function setLayoutValue<K extends AXES>(
	state: LayoutState,
	key: K,
	value: LayoutState[K]
): void
{
	state[key] = value;
}

/**
 * Type guard that checks if a string is a valid variant for a specific axis K.
 */
function isValidAxisVariant<K extends AXES>(
	axis: K,
	variant: string
): variant is LayoutState[K]
{
	const validVariants: string[] = LAYOUT_AXES[axis];
	return validVariants.includes(variant);
}

/**
 * Normalizes, validates, and orders layout inputs into body class names.
 * Accepts strings (e.g. "layout-focus-mode reverse-order"), arrays, or objects.
 */
function getValidatedLayoutClassNames(
	rawInput: string | string[] | Record<string, unknown> | null | undefined
): string[]
{
	// Clone current layoutState or fall back to default
	const resolvedState: LayoutState = {
		...(menuSelf.layoutState ?? { "panels": "left-hand-files", "order": "normal-order", "terminal": "terminal", "mode": "full-mode" })
	};

	if(typeof rawInput === 'string')
	{
		const tokens = rawInput.trim().split(/\s+/);
		tokens.forEach(token => processToken(token, resolvedState));
	} else if(Array.isArray(rawInput))
	{
		rawInput.forEach(token =>
		{
			if(typeof token === 'string')
			{
				processToken(token, resolvedState);
			}
		});
	} else if(rawInput && typeof rawInput === 'object')
	{
		const inputObj = rawInput as Record<string, unknown>;
		(Object.keys(LAYOUT_AXES) as AXES[]).forEach(axis =>
		{
			const rawVal = inputObj[axis];
			if(typeof rawVal === 'string')
			{
				const cleanValue = rawVal.replace(/^layout-/, '');
				if(isValidAxisVariant(axis, cleanValue))
				{
					setLayoutValue(resolvedState, axis, cleanValue);
				}
			}
		});
	}

	// Return mapped array preserving strict order: panels -> order -> terminal -> mode
	return (Object.keys(LAYOUT_AXES) as AXES[]).map(
		axis => `layout-${resolvedState[axis]}`
	);
}

/**
 * Helper to match a single string token against valid LAYOUT_AXES options.
 */
function processToken(token: string, targetState: LayoutState): void
{
	const cleanToken = token.replace(/^layout-/, '');

	(Object.keys(LAYOUT_AXES) as AXES[]).forEach(axis =>
	{
		if(isValidAxisVariant(axis, cleanToken))
		{
			setLayoutValue(targetState, axis, cleanToken);
		}
	});
}

export function applyInitialLayout(
	storedInput: string | string[] | Record<string, unknown> | null | undefined
): string[]
{
	// 1. Get validated class list in the exact required order
	const validatedClasses = getValidatedLayoutClassNames(storedInput);

	// 2. Update menuSelf.layoutState from validated output
	if(menuSelf.layoutState)
	{
		const targetState = menuSelf.layoutState;
		(Object.keys(LAYOUT_AXES) as AXES[]).forEach(axis =>
		{
			const rawClass = validatedClasses.find(cls =>
			{
				const clean = cls.replace(/^layout-/, '');
				return isValidAxisVariant(axis, clean);
			});

			if(rawClass)
			{
				const cleanValue = rawClass.replace(/^layout-/, '');
				if(isValidAxisVariant(axis, cleanValue))
				{
					setLayoutValue(targetState, axis, cleanValue);
				}
			}
		});
	}

	// 3. Remove any existing layout-* classes from body to avoid collisions
	const existingLayoutClasses = Array.from(document.body.classList).filter(
		className => className.startsWith('layout-')
	);

	if(existingLayoutClasses.length > 0)
	{
		document.body.classList.remove(...existingLayoutClasses);
	}

	// 4. Inject clean layout classes onto body
	document.body.classList.add(...validatedClasses);

	return validatedClasses;
}

