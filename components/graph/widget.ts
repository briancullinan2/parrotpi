import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { LGraph, LGraphCanvas, LGraphNode, LiteGraph } from 'litegraph.js';
import { populateDemoNodes } from './widget-nodes';

// Extend window scope for system-wide module/menu bindings
type LightGraphWindow = typeof globalThis & {
	mainDock?: any;
	LayoutAdjuster?: {
		addOptimalWidgetLayout(dock: any, widget: Widget, config: any): void;
	};
	registerAllCommands?: (menus: any) => void;
	injectMenus?: (name: string, menus: any) => void;
	removeMenus?: (name: string) => void;
	settingsManager?: {
		get(category: string, key: string): any;
		hydrateAll(settings: any): void;
	};
	historyToolbar?: {
		appendHistoryItem(payload: any, source: string): void;
	};
	nextTemp?: () => number;
	LightGraphWidget?: typeof LightGraphWidget;
};

const appSelf = globalThis as LightGraphWindow;

export interface IGraphSession
{
	graph: LGraph;
	graphId: string;
}

export interface IGraphSessionCache
{
	[graphId: string]: IGraphSession;
}

export interface IPooledCanvas
{
	_workspaceGraphId?: string;
	canvasElement: HTMLCanvasElement;
	graphCanvas: LGraphCanvas;
	inUse: boolean;
	session?: IGraphSession;

}

/**
 * Global static coordinator managing LightGraph instances & DOM Canvas resources.
 */
export class GraphPool
{
	public static instances: IPooledCanvas[] = [];
	public static sessionCache: IGraphSessionCache = {};

	/**
	 * Retrieves an existing LGraph model or instantiates a new one.
	 */
	public static getOrCreateGraphSession(
		graphId: string,
		contentJson?: string | object,
		graphCanvas?: LGraphCanvas
	): IGraphSession
	{
		let session = this.sessionCache[graphId];

		if(!session)
		{
			const graph = new LGraph();
			if(contentJson)
			{
				try
				{
					const parsed = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
					graph.configure(parsed);
				} catch(err)
				{
					console.error(`Failed to parse graph JSON for ${graphId}:`, err);
				}
			}
			session = { graph, graphId };
			this.sessionCache[graphId] = session;
		}

		if(graphCanvas && session.graph)
		{
			graphCanvas.setGraph(session.graph);
			session.graph.start();
			graphCanvas.draw(true, true);
		}

		return session;
	}

	/**
	 * Acquires an available HTML Canvas + LGraphCanvas container pair, creating one if needed.
	 */
	public static acquireCanvas(): IPooledCanvas
	{
		let item = this.instances.find((inst) => !inst.inUse);

		if(!item)
		{
			const canvasElement = document.createElement('canvas');
			canvasElement.className = 'lightgraph-shared-canvas';
			canvasElement.style.width = '100%';
			canvasElement.style.height = '100%';
			canvasElement.style.display = 'block';
			canvasElement.tabIndex = 1;

			// Instantiate LightGraph Canvas attached to the created DOM element
			const graphCanvas = new LGraphCanvas(canvasElement, undefined, {
				autoresize: true
			});

			// Bind node mutation listeners for tracking history changes
			if(graphCanvas.graph)
			{
				graphCanvas.graph.onNodeAdded = (node) =>
				{
					GraphPool.recordChanges(graphCanvas, 'Node Added', node.title ?? node.type);
					node.onRemoved = this.onNodeRemoved.bind(node, graphCanvas, node);
				};
			}

			item = { canvasElement, graphCanvas, inUse: true };
			this.instances.push(item);
		} else
		{
			item.inUse = true;
		}

		return item;
	}

	private static onNodeRemoved = (graphCanvas: LGraphCanvas, node: LGraphNode) =>
	{
		GraphPool.recordChanges(graphCanvas, 'Node Removed', node.title ?? node.type);
	};

	/**
	 * Records node manipulation events for workspace history tools.
	 */
	public static recordChanges(graphCanvas: LGraphCanvas, actionType: string, detail?: string): void
	{
		const graphId = (graphCanvas.graph as any)?._workspaceGraphId || 'unknown';

		const actionPayload = {
			action_id: 'lightgraph_edit_action',
			action_description: `${actionType}: ${detail || 'Graph modified'}`,
			graphId: graphId,
			timestamp: Date.now()
		};

		appSelf.historyToolbar?.appendHistoryItem(actionPayload, 'graph_editor');
	}

	/**
	 * Releases an active pooled element back to the dormant queue.
	 */
	public static releaseCanvas(graphCanvas: LGraphCanvas): void
	{
		const item = this.instances.find((inst) => inst.graphCanvas === graphCanvas);
		if(item)
		{
			item.inUse = false;

			if(item.graphCanvas.graph)
			{
				item.graphCanvas.graph.stop();
			}

			// Safely unmount from DOM hierarchy
			if(item.canvasElement && item.canvasElement.parentNode)
			{
				item.canvasElement.parentNode.removeChild(item.canvasElement);
			}
		}
	}

	public static getNextTempName(): string
	{
		const nextId = appSelf.nextTemp?.() ?? Math.floor(Math.random() * 10000);
		return `graph-${nextId}.json`;
	}
}

/**
 * Lumino Widget encapsulating lightgraph.js node editor instances.
 */
export class LightGraphWidget extends Widget
{
	protected _graphId: string;
	protected _initialContent: string | object;
	public _pooledCanvas: IPooledCanvas | undefined = undefined;
	protected static _defaultContent: object = {
		last_node_id: 2,
		last_link_id: 1,
		nodes: [
			{
				id: 1,
				type: 'basic/const',
				pos: [200, 200],
				size: [180, 60],
				flags: {},
				order: 0,
				mode: 0,
				outputs: [{ name: 'value', type: 'number', links: [1] }],
				properties: { value: 1.0 }
			},
			{
				id: 2,
				type: 'basic/watch',
				pos: [500, 200],
				size: [140, 80],
				flags: {},
				order: 1,
				mode: 0,
				inputs: [{ name: 'in', type: 0, link: 1 }],
				properties: {}
			}
		],
		links: [[1, 1, 0, 2, 0, 'number']],
		groups: [],
		config: {},
		extra: {},
		version: 0.4
	};

	constructor(graphId?: string, initialContent?: string | object)
	{
		super();
		this.addClass('lm-LightGraphWidget');

		this._graphId = graphId || GraphPool.getNextTempName();
		this.id = `lightgraph-${this._graphId.replace(/[^a-z0-9]/gi, '_')}`;
		this._initialContent = initialContent || LightGraphWidget._defaultContent;

		this.node.style.overflow = 'hidden';
		this.node.style.display = 'flex';
		this.node.style.flexDirection = 'column';
		this.node.style.width = '100%';
		this.node.style.height = '100%';

		this.title.label = this._graphId;
		this.title.closable = true;

		this.node.addEventListener('focusin', () =>
		{
			appSelf.injectMenus?.(LightGraphWidget.name, []);
		});

		this.node.addEventListener('focusout', (e) =>
		{
			if(!this.node.contains(e.relatedTarget as Node))
			{
				appSelf.removeMenus?.(LightGraphWidget.name);
			}
		});
	}


	static syncThemeWithAce(graphCanvas: LGraphCanvas): void
	{
		const style = getComputedStyle(document.body);
		const getAceVar = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

		// 1. Fetch Ace CSS Variable Values
		const background = getAceVar('--ace-bg', '#1e1e1e');
		const foreground = getAceVar('--ace-foreground', '#cccccc');
		const gutter = getAceVar('--ace-gutter-bg', '#252526');
		const pink = getAceVar('--ace-pink', '#ff79c6');
		const purple = getAceVar('--ace-purple', '#bd93f9');
		const blue = getAceVar('--ace-blue', '#8be9fd');
		const green = getAceVar('--ace-green', '#50fa7b');

		// 2. DOM Canvas Surface Setup
		if(graphCanvas.bgcanvas)
		{
			graphCanvas.bgcanvas.style.backgroundColor = background;
		}
		if(graphCanvas.canvas)
		{
			graphCanvas.canvas.style.backgroundColor = background;
		}
		graphCanvas.clear_background = true;

		// 3. Configure Link Wires & Active Connections
		// Set link colors to vibrant theme accents instead of grey gutter colors
		graphCanvas.default_link_color = blue;
		graphCanvas.default_connection_color = {
			input_off: gutter,
			input_on: green,
			output_off: gutter,
			output_on: green
		};

		(LiteGraph as any).LINK_COLOR = blue;
		(LiteGraph as any).EVENT_LINK_COLOR = purple;
		(LiteGraph as any).CONNECTING_LINK_COLOR = pink;

		// Map data types (number, string, boolean, etc.) to distinct colored wires
		LGraphCanvas.link_type_colors = {
			number: blue,
			string: green,
			boolean: pink,
			event: purple,
			action: purple
		};

		// 4. Override LiteGraph Text & Widget Constants
		(LiteGraph as any).NODE_TEXT_COLOR = foreground;
		(LiteGraph as any).NODE_TITLE_COLOR = foreground;
		(LiteGraph as any).NODE_SELECTED_TITLE_COLOR = pink;

		(LiteGraph as any).WIDGET_BGCOLOR = gutter;
		(LiteGraph as any).WIDGET_TEXT_COLOR = foreground;
		(LiteGraph as any).WIDGET_SECONDARY_TEXT_COLOR = foreground;

		// 5. Retheme Node Color Palettes
		LGraphCanvas.node_colors = {
			default: {
				color: gutter,
				bgcolor: background,
				groupcolor: gutter
			},
			blue: {
				color: blue,
				bgcolor: background,
				groupcolor: blue
			},
			purple: {
				color: purple,
				bgcolor: background,
				groupcolor: purple
			},
			green: {
				color: green,
				bgcolor: background,
				groupcolor: green
			},
			pink: {
				color: pink,
				bgcolor: background,
				groupcolor: pink
			}
		};

		// 6. Custom Background Painter with Responsive Grid Lines
		graphCanvas.onDrawBackground = (ctx: CanvasRenderingContext2D, visibleArea: number[]) =>
		{
			const [x, y, width, height] = visibleArea;

			ctx.save();

			// Fill background base
			ctx.fillStyle = background;
			ctx.fillRect(x, y, width, height);

			// Draw Subtle Grid Lines
			const gridSize = 20;
			const startX = Math.floor(x / gridSize) * gridSize;
			const startY = Math.floor(y / gridSize) * gridSize;

			ctx.strokeStyle = gutter;
			ctx.lineWidth = 1;
			ctx.globalAlpha = 0.35; // Soft opacity for background grid

			ctx.beginPath();
			for(let gx = startX; gx < x + width; gx += gridSize)
			{
				ctx.moveTo(gx, y);
				ctx.lineTo(gx, y + height);
			}
			for(let gy = startY; gy < y + height; gy += gridSize)
			{
				ctx.moveTo(x, gy);
				ctx.lineTo(x + width, gy);
			}
			ctx.stroke();

			ctx.restore();
		};

		// 7. Trigger Full Viewport Redraw
		graphCanvas.setDirty(true, true);
		graphCanvas.draw(true, true);
	}


	public get graphId(): string
	{
		return this._graphId;
	}

	public get graphCanvas(): LGraphCanvas | undefined
	{
		return this._pooledCanvas?.graphCanvas;
	}

	protected onBeforeHide(msg: Message): void
	{
		appSelf.removeMenus?.(LightGraphWidget.name);
		super.onBeforeHide(msg);
	}

	/**
	 * Invoked upon injecting the widget directly into the active browser DOM layout.
	 */
	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);

		// Acquire a canvas instance from the pooled allocation manager
		this._pooledCanvas = GraphPool.acquireCanvas();

		if(this._pooledCanvas)
		{
			this.node.appendChild(this._pooledCanvas.canvasElement);

			this._pooledCanvas.session = GraphPool.getOrCreateGraphSession(
				this._graphId,
				this._initialContent,
				this._pooledCanvas.graphCanvas
			);

			this._pooledCanvas._workspaceGraphId = this._graphId;

			this.resizeCanvas();
		}

		populateDemoNodes(this._pooledCanvas?.session?.graph);
		LightGraphWidget.syncThemeWithAce(this._pooledCanvas.graphCanvas);

		appSelf.registerAllCommands?.([]);
		appSelf.injectMenus?.(LightGraphWidget.name, []);
	}

	/**
	 * Invoked when Lumino detaches or swaps tabs out of visibility.
	 */
	protected onBeforeDetach(msg: Message): void
	{
		if(this._pooledCanvas)
		{
			GraphPool.releaseCanvas(this._pooledCanvas.graphCanvas);
			this._pooledCanvas = undefined;
		}
		super.onBeforeDetach(msg);
	}

	/**
	 * Resize calculations triggered by parent dock panel adjustments.
	 */
	protected onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		this.resizeCanvas();
	}

	private resizeCanvas(): void
	{
		if(this._pooledCanvas && this.node)
		{
			const rect = this.node.getBoundingClientRect();
			if(rect.width > 0 && rect.height > 0)
			{
				this._pooledCanvas.graphCanvas.resize(rect.width, rect.height);
				this._pooledCanvas.graphCanvas.draw(true, true);
			}
		}
	}

	/**
	 * Shift view focus onto active interaction canvas upon activation.
	 */
	protected onActivateRequest(msg: Message): void
	{
		super.onActivateRequest(msg);
		if(this._pooledCanvas)
		{
			this._pooledCanvas.canvasElement.focus();
		}
		appSelf.injectMenus?.(LightGraphWidget.name, []);
	}

	/**
	 * Opens graph structures in existing panels or initializes new tab allocations.
	 */
	static openFileInNewTab(graphId: string, fileName: string, fileContent: string | object)
	{
		if(typeof fileContent === 'string')
		{
			try
			{
				fileContent = JSON.parse(fileContent);
			} catch(e)
			{
				console.warn('File content string is not JSON, passing raw string as input.');
			}
		}

		const tabs: Widget[] = Array.from(appSelf.mainDock?.widgets() ?? []);
		const existingTab = tabs.find(
			(t) => t.constructor.name === LightGraphWidget.name && (t as LightGraphWidget).graphId === graphId
		);

		if(existingTab)
		{
			appSelf.mainDock?.activateWidget(existingTab);
			return;
		}

		// Reuse default unedited initial canvas tab if present
		const existingDefault = tabs.find(
			(t) =>
				t.constructor.name === LightGraphWidget.name &&
				(t as LightGraphWidget)._graphId.startsWith('graph-')
		) as LightGraphWidget;

		if(existingDefault && existingDefault.graphCanvas)
		{
			existingDefault.title.label = fileName.split('/').pop() ?? fileName;
			existingDefault._graphId = graphId;
			existingDefault._initialContent = fileContent;

			GraphPool.getOrCreateGraphSession(graphId, fileContent, existingDefault.graphCanvas);
			appSelf.mainDock?.activateWidget(existingDefault);
			return;
		}

		const newTab = new LightGraphWidget(graphId, fileContent);
		newTab.title.label = fileName.split('/').pop() ?? fileName;
		newTab.title.closable = true;

		if(appSelf.mainDock)
		{
			appSelf.LayoutAdjuster?.addOptimalWidgetLayout(appSelf.mainDock, newTab, {
				type: 'graph',
				projectId: newTab.constructor.name
			});
		}
	}
}

appSelf.LightGraphWidget = LightGraphWidget;
