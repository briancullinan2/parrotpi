import { Widget, Panel } from '@lumino/widgets';
import { Message, MessageLoop } from '@lumino/messaging';
import { DataGrid, DataModel } from '@lumino/datagrid';

import type { IPerformanceSample, IProcessInfo, IStatusDataPayload } from './generate';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';

import 'd3';
declare const d3: typeof import('d3');

const widgetSelf: LuminoLayoutWindow & GlobalToolbarsWindow & { StatusWidget?: typeof StatusWidget; } = self as unknown as any;

/**
 * Lumino DataGrid Model for High-Performance Process Rendering
 */
export class ProcessGridModel extends DataModel
{
	private _data: IProcessInfo[] = [];

	public updateData(data: IProcessInfo[]): void
	{
		this._data = data;
		this.emitChanged({ type: 'model-reset' });
	}

	public rowCount(region: DataModel.RowRegion): number
	{
		return region === 'body' ? this._data.length : 1;
	}

	public columnCount(region: DataModel.ColumnRegion): number
	{
		return region === 'body' ? 6 : 0;
	}

	public data(region: DataModel.CellRegion, row: number, column: number): any
	{
		if(region === 'column-header')
		{
			return ['PID', 'Process Name', 'CPU %', 'Memory (MB)', 'User', 'Actions'][column];
		}
		if(region === 'body')
		{
			const item = this._data[row];
			if(!item) return '';
			switch(column)
			{
				case 0: return item.pid;
				case 1: return item.name;
				case 2: return `${item.cpu}%`;
				case 3: return `${item.memoryMB} MB`;
				case 4: return item.user;
				case 5: return `KILL ${item.pid}`;
				default: return '';
			}
		}
		return undefined;
	}

	public getRawItem(row: number): IProcessInfo | undefined
	{
		return this._data[row];
	}
}

export class StatusWidget extends Widget
{
	public static instance: StatusWidget | null = null;

	private _endpoint: string = '/components/status/status-data.json';
	private _abortController: AbortController | null = null;
	private _historyMetrics: IPerformanceSample[] = [];

	// DOM Elements
	private _openFilesTableBody!: HTMLElement;
	private _openPortsTableBody!: HTMLElement;
	private _accordionContainer!: HTMLElement;
	private _d3SvgEl!: SVGSVGElement;
	private _osBadgeEl!: HTMLElement;
	private _uptimeEl!: HTMLElement;

	// Lumino Grids & Interactive Containers
	private _processesTableBody!: HTMLElement;
	private _summaryBarEl!: HTMLDivElement;
	private _processGrid!: DataGrid;
	private _processGridModel!: ProcessGridModel;
	private _gridPanel!: Panel;
	private _servicesTableBody!: HTMLElement;
	private _usersContainerEl!: HTMLElement;
	private _startupContainerEl!: HTMLElement;
	private _eventsLogEl!: HTMLElement;

	constructor(title?: string, endpoint?: string)
	{
		super();
		this.addClass('lm-StatusWidget');
		this.id = 'status-widget-singleton';

		this.node.style.overflow = 'hidden';
		this.node.style.display = 'flex';
		this.node.style.flexDirection = 'column';
		this.node.style.height = '100%';
		this.node.style.width = '100%';
		this.node.style.backgroundColor = '#1e1e1e';
		this.node.style.color = '#cccccc';
		this.node.style.fontFamily = 'Consolas, "Courier New", monospace';

		this.title.label = 'System Status';
		this.title.iconClass = 'bx bx-server';
		this.title.closable = true;

		if(endpoint && endpoint !== 'System Status')
		{
			this.title.label = title ?? endpoint;
			this._endpoint = endpoint;
		}
	}

	public static getInstance(endpoint?: string): StatusWidget
	{
		if(!StatusWidget.instance || StatusWidget.instance.isDisposed)
		{
			StatusWidget.instance = new StatusWidget(endpoint, endpoint);
		}
		return StatusWidget.instance;
	}

	public static openInDock(endpoint?: string): void
	{
		const widget = StatusWidget.getInstance(endpoint);
		const tabs = Array.from(widgetSelf.mainDock?.widgets() ?? []);
		const existing = tabs.find(t => t.id === widget.id);

		if(existing)
		{
			widgetSelf.mainDock?.activateWidget(existing);
			return;
		}

		if(widgetSelf.mainDock)
		{
			widgetSelf.LayoutAdjuster?.addOptimalWidgetLayout(widgetSelf.mainDock, widget, {
				type: 'editor',
				projectId: 'StatusWidget'
			});
		}
	}

	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this._buildUI();
		this.startStreamingFetch();
	}

	protected onBeforeDetach(msg: Message): void
	{
		this.stopStreamingFetch();
		super.onBeforeDetach(msg);
	}

	public dispose(): void
	{
		this.stopStreamingFetch();
		StatusWidget.instance = null;
		super.dispose();
	}

	private _forceGridLayout(): void
	{
		if(!this._processGrid || !this._processGrid.isAttached) return;

		const node = this._processGrid.node;
		const w = node.clientWidth;
		const h = node.clientHeight;

		if(w <= 0 || h <= 0) return;

		// 1. Tell Lumino the exact size
		MessageLoop.sendMessage(
			this._processGrid,
			new Widget.ResizeMessage(w, h)
		);

		// 2. Recalculate sections + paint
		this._processGrid.fit();
		this._processGrid.update();
	}

	protected onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		this._renderD3Sparklines();

		requestAnimationFrame(() =>
		{
			setTimeout(this.resizeGrid.bind(this), 200);
		});
		//if(this._processGrid)
		//{
		//	this._processGrid.update();
		//}
	}

	public async startStreamingFetch(): Promise<void>
	{
		this.stopStreamingFetch();
		this._abortController = new AbortController();

		try
		{
			const response = await fetch(this._endpoint, {
				signal: this._abortController.signal,
				headers: { 'Accept': 'application/x-ndjson, application/json, text/plain' }
			});

			if(!response.body)
			{
				throw new Error('Streaming body unavailable');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder('utf-8');
			let buffer = '';

			while(true)
			{
				const { value, done } = await reader.read();
				if(done) break;

				buffer += decoder.decode(value, { stream: true });
				buffer = buffer.replace(/^\s*\[\s*/, '');

				let boundary: number;
				while((boundary = this._findJsonObjectEnd(buffer)) !== -1)
				{
					const jsonStr = buffer.slice(0, boundary + 1).trim();
					buffer = buffer.slice(boundary + 1).replace(/^\s*,\s*/, '');

					if(jsonStr)
					{
						try
						{
							const payload: IStatusDataPayload = JSON.parse(jsonStr);
							this._updateUI(payload);
						} catch(e)
						{
							console.warn('[StatusWidget] Parse error on chunk:', e);
						}
					}
				}
			}
		} catch(err: any)
		{
			if(err.name !== 'AbortError')
			{
				console.warn('[StatusWidget] Stream reconnecting/fallback...', err);
			}
		}
	}

	private _findJsonObjectEnd(str: string): number
	{
		let depth = 0;
		let inString = false;
		let escaped = false;
		let startFound = false;

		for(let i = 0; i < str.length; i++)
		{
			const char = str[i];

			if(inString)
			{
				if(escaped)
				{
					escaped = false;
				} else if(char === '\\')
				{
					escaped = true;
				} else if(char === '"')
				{
					inString = false;
				}
				continue;
			}

			if(char === '"')
			{
				inString = true;
				continue;
			}

			if(char === '{')
			{
				depth++;
				startFound = true;
			} else if(char === '}')
			{
				depth--;
				if(startFound && depth === 0)
				{
					return i;
				}
			}
		}
		return -1;
	}

	public stopStreamingFetch(): void
	{
		if(this._abortController)
		{
			this._abortController.abort();
			this._abortController = null;
		}
	}


	private _createAccordionSection(title: string, contentEl: HTMLElement, expanded: boolean): HTMLElement
	{
		const wrapper = document.createElement('div');
		wrapper.style.marginBottom = '6px';
		wrapper.style.border = '1px solid #333';
		wrapper.style.borderRadius = '3px';

		const header = document.createElement('div');
		header.style.padding = '6px 10px';
		header.style.backgroundColor = '#2d2d2d';
		header.style.cursor = 'pointer';
		header.style.fontWeight = 'bold';
		header.style.fontSize = '12px';
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.userSelect = 'none';
		header.textContent = `${expanded ? '▼' : '►'} ${title}`;

		contentEl.style.display = expanded ? 'block' : 'none';
		contentEl.style.padding = '8px';
		contentEl.style.backgroundColor = '#181818';

		header.addEventListener('click', () =>
		{
			const isVisible = contentEl.style.display === 'block';
			contentEl.style.display = isVisible ? 'none' : 'block';
			header.textContent = `${!isVisible ? '▼' : '►'} ${title}`;

			if(!isVisible && this._processGrid)
			{
				requestAnimationFrame(() =>
				{
					this._processGrid.fit();
					this._processGrid.update();
				});
			}
		});

		wrapper.appendChild(header);
		wrapper.appendChild(contentEl);
		return wrapper;
	}

	private _buildUI(): void
	{
		this.node.replaceChildren();

		// Top System Status Banner
		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		header.style.padding = '8px 12px';
		header.style.backgroundColor = '#252526';
		header.style.borderBottom = '1px solid #3c3c3c';

		const titleEl = document.createElement('span');
		titleEl.style.fontWeight = 'bold';
		titleEl.style.fontSize = '13px';
		titleEl.textContent = 'System Diagnostics & Administrative Control';

		const rightContainer = document.createElement('div');
		rightContainer.style.display = 'flex';
		rightContainer.style.gap = '12px';
		rightContainer.style.alignItems = 'center';

		this._uptimeEl = document.createElement('span');
		this._uptimeEl.style.fontSize = '11px';
		this._uptimeEl.style.color = '#888';
		this._uptimeEl.textContent = 'Last update: Never';

		this._osBadgeEl = document.createElement('span');
		this._osBadgeEl.style.padding = '2px 8px';
		this._osBadgeEl.style.borderRadius = '3px';
		this._osBadgeEl.style.fontSize = '11px';
		this._osBadgeEl.style.backgroundColor = '#007acc';
		this._osBadgeEl.style.color = '#ffffff';
		this._osBadgeEl.textContent = 'OS: DETECTING...';

		rightContainer.appendChild(this._uptimeEl);
		rightContainer.appendChild(this._osBadgeEl);

		//header.appendChild(titleEl);
		//header.appendChild(rightContainer);

		// Main Accordion Layout Shell
		this._accordionContainer = document.createElement('div');
		this._accordionContainer.style.flex = '1';
		this._accordionContainer.style.overflowY = 'auto';
		this._accordionContainer.style.padding = '8px';

		// Panel 1: Performance Sparklines
		const perfContent = document.createElement('div');
		perfContent.style.height = '140px';
		perfContent.style.width = '100%';
		this._d3SvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this._d3SvgEl.style.width = '100%';
		this._d3SvgEl.style.height = '100%';
		perfContent.appendChild(this._d3SvgEl);

		// // Panel 2: Active Processes Section
		// const procContainerWrapper = document.createElement('div');
		// procContainerWrapper.style.display = 'flex';
		// procContainerWrapper.style.flexDirection = 'column';
		// procContainerWrapper.style.height = '320px';
		// procContainerWrapper.style.width = '100%';

		// this._summaryBarEl = document.createElement('div');
		// this._summaryBarEl.style.display = 'grid';
		// this._summaryBarEl.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
		// this._summaryBarEl.style.gap = '8px';
		// this._summaryBarEl.style.marginBottom = '8px';
		// this._summaryBarEl.style.padding = '8px';
		// this._summaryBarEl.style.backgroundColor = '#141414';
		// this._summaryBarEl.style.border = '1px solid #282828';
		// this._summaryBarEl.style.borderRadius = '3px';
		// this._summaryBarEl.style.fontSize = '11px';

		// const gridHost = document.createElement('div');
		// gridHost.style.flex = '1';
		// gridHost.style.position = 'relative';
		// gridHost.style.minHeight = '260px';
		// gridHost.style.width = '100%';

		// this._processGridModel = new ProcessGridModel();
		// this._processGrid = new DataGrid({
		// 	style: {
		// 		...DataGrid.defaultStyle,
		// 		voidColor: '#1e1e1e',
		// 		backgroundColor: '#181818',
		// 		headerBackgroundColor: '#252526',
		// 		headerGridLineColor: '#3c3c3c',
		// 		gridLineColor: '#2d2d2d',
		// 		selectionFillColor: 'rgba(0, 122, 204, 0.2)'
		// 	},
		// 	defaultSizes: {
		// 		rowHeight: 24,
		// 		columnWidth: 120,
		// 		rowHeaderWidth: 0,
		// 		columnHeaderHeight: 28
		// 	}
		// });
		// this._processGrid.dataModel = this._processGridModel;

		// gridHost.appendChild(this._processGrid.node);
		// procContainerWrapper.appendChild(this._summaryBarEl);
		// procContainerWrapper.appendChild(gridHost);
		// Panel 2: Active Processes Section (Pure HTML Table)
		const procContainerWrapper = document.createElement('div');
		procContainerWrapper.style.display = 'flex';
		procContainerWrapper.style.flexDirection = 'column';
		procContainerWrapper.style.width = '100%';

		this._summaryBarEl = document.createElement('div');
		this._summaryBarEl.style.display = 'grid';
		this._summaryBarEl.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
		this._summaryBarEl.style.gap = '8px';
		this._summaryBarEl.style.marginBottom = '8px';
		this._summaryBarEl.style.padding = '8px';
		this._summaryBarEl.style.backgroundColor = '#141414';
		this._summaryBarEl.style.border = '1px solid #282828';
		this._summaryBarEl.style.borderRadius = '3px';
		this._summaryBarEl.style.fontSize = '11px';

		const procTableScrollWrapper = document.createElement('div');
		procTableScrollWrapper.style.maxHeight = '280px';
		procTableScrollWrapper.style.overflowY = 'auto';
		procTableScrollWrapper.style.overflowX = 'hidden';
		procTableScrollWrapper.style.border = '1px solid #282828';
		procTableScrollWrapper.style.backgroundColor = '#181818';

		const procTable = document.createElement('table');
		procTable.style.width = '100%';
		procTable.style.borderCollapse = 'collapse';
		procTable.style.fontSize = '11px';
		procTable.style.textAlign = 'left';

		procTable.innerHTML = `
  <thead style="position: sticky; top: 0; background-color: #252526; z-index: 1;">
    <tr style="border-bottom: 1px solid #3c3c3c; color: #007acc;">
      <th style="padding: 6px 8px;">PID</th>
      <th style="padding: 6px 8px;">Process Name</th>
      <th style="padding: 6px 8px;">CPU %</th>
      <th style="padding: 6px 8px;">Memory</th>
      <th style="padding: 6px 8px;">User</th>
      <th style="padding: 6px 8px;">Actions</th>
    </tr>
  </thead>
`;

		this._processesTableBody = document.createElement('tbody');
		procTable.appendChild(this._processesTableBody);
		procTableScrollWrapper.appendChild(procTable);

		procContainerWrapper.appendChild(this._summaryBarEl);
		procContainerWrapper.appendChild(procTableScrollWrapper);


		// Panel 3: Services Table
		const svcContent = document.createElement('div');
		svcContent.style.maxHeight = '220px';
		svcContent.style.overflowY = 'auto';
		const svcTable = document.createElement('table');
		svcTable.style.width = '100%';
		svcTable.style.borderCollapse = 'collapse';
		svcTable.style.fontSize = '12px';
		svcTable.innerHTML = `
      <thead>
        <tr style="text-align:left; border-bottom:1px solid #444; color:#007acc;">
          <th>Service Name</th><th>Status</th><th>Control Actions</th>
        </tr>
      </thead>
    `;
		this._servicesTableBody = document.createElement('tbody');
		svcTable.appendChild(this._servicesTableBody);
		svcContent.appendChild(svcTable);

		const userGrid = document.createElement('div');
		userGrid.style.display = 'grid';
		userGrid.style.gridTemplateColumns = '1fr 1fr';
		userGrid.style.gap = '12px';

		this._usersContainerEl = document.createElement('div');
		userGrid.appendChild(this._usersContainerEl);

		const mgmtGrid = document.createElement('div');
		mgmtGrid.style.display = 'grid';
		mgmtGrid.style.gridTemplateColumns = '1fr 1fr';
		mgmtGrid.style.gap = '12px';

		this._startupContainerEl = document.createElement('div');
		mgmtGrid.appendChild(this._startupContainerEl);

		this._eventsLogEl = document.createElement('div');
		this._eventsLogEl.style.maxHeight = '160px';
		this._eventsLogEl.style.overflowY = 'auto';
		this._eventsLogEl.style.fontSize = '11px';
		this._eventsLogEl.style.color = '#ce9178';
		this._eventsLogEl.style.backgroundColor = '#141414';
		this._eventsLogEl.style.padding = '8px';
		this._eventsLogEl.style.border = '1px solid #282828';
		// --- Panel: Open Files Shell ---
		const filesContentWrapper = document.createElement('div');
		filesContentWrapper.style.maxHeight = '220px';
		filesContentWrapper.style.overflowY = 'auto';
		filesContentWrapper.style.border = '1px solid #282828';
		filesContentWrapper.style.backgroundColor = '#181818';

		const filesTable = document.createElement('table');
		filesTable.style.width = '100%';
		filesTable.style.borderCollapse = 'collapse';
		filesTable.style.fontSize = '11px';
		filesTable.style.textAlign = 'left';
		filesTable.innerHTML = `
  <thead style="position: sticky; top: 0; background-color: #252526; z-index: 1;">
    <tr style="border-bottom: 1px solid #3c3c3c; color: #007acc;">
      <th style="padding: 6px 8px;">PID</th>
      <th style="padding: 6px 8px;">Process</th>
      <th style="padding: 6px 8px;">File / Handle Path</th>
    </tr>
  </thead>
`;
		this._openFilesTableBody = document.createElement('tbody');
		filesTable.appendChild(this._openFilesTableBody);
		filesContentWrapper.appendChild(filesTable);

		// --- Panel: Active Ports Shell ---
		const portsContentWrapper = document.createElement('div');
		portsContentWrapper.style.maxHeight = '220px';
		portsContentWrapper.style.overflowY = 'auto';
		portsContentWrapper.style.border = '1px solid #282828';
		portsContentWrapper.style.backgroundColor = '#181818';

		const portsTable = document.createElement('table');
		portsTable.style.width = '100%';
		portsTable.style.borderCollapse = 'collapse';
		portsTable.style.fontSize = '11px';
		portsTable.style.textAlign = 'left';
		portsTable.innerHTML = `
  <thead style="position: sticky; top: 0; background-color: #252526; z-index: 1;">
    <tr style="border-bottom: 1px solid #3c3c3c; color: #007acc;">
      <th style="padding: 6px 8px;">Proto</th>
      <th style="padding: 6px 8px;">Local Address</th>
      <th style="padding: 6px 8px;">Port</th>
      <th style="padding: 6px 8px;">Process (PID)</th>
      <th style="padding: 6px 8px;">State</th>
    </tr>
  </thead>
`;
		this._openPortsTableBody = document.createElement('tbody');
		portsTable.appendChild(this._openPortsTableBody);
		portsContentWrapper.appendChild(portsTable);

		// Mount Accordion Sections
		const perfGraph = this._createAccordionSection('Performance Metrics (Sustained 30s Window)', perfContent, true);
		perfGraph.children[0].appendChild(rightContainer);
		this._accordionContainer.appendChild(perfGraph);
		this._accordionContainer.appendChild(this._createAccordionSection('Active Processes (Task Manager View)', procContainerWrapper, true));
		this._accordionContainer.appendChild(this._createAccordionSection('System Services', svcContent, false));
		this._accordionContainer.appendChild(this._createAccordionSection('User Accounts', userGrid, false));
		this._accordionContainer.appendChild(this._createAccordionSection('Startup Applications', mgmtGrid, false));
		this._accordionContainer.appendChild(this._createAccordionSection('App History / System Log (dmesg & EventLog)', this._eventsLogEl, false));
		this._accordionContainer.appendChild(this._createAccordionSection('Open Handles & File Locks', filesContentWrapper, false));
		this._accordionContainer.appendChild(this._createAccordionSection('Listening Network Ports', portsContentWrapper, false));

		//this.node.appendChild(header);
		this.node.appendChild(this._accordionContainer);

		// Attach Lumino DataGrid Widget to trigger layout lifecycle messages


		requestAnimationFrame(() =>
		{
			setTimeout(this.resizeGrid.bind(this), 200);
		});
	}

	private resizeGrid()
	{
		if(this._processGrid)
		{
			const host = this._processGrid.node.parentElement;
			if(host && host.clientWidth > 0 && host.clientHeight > 0)
			{
				this._processGrid.node.style.width = `${host.clientWidth}px`;
				this._processGrid.node.style.height = `${host.clientHeight}px`;
				// optional: stretch columns
				const colWidth = Math.max(90, Math.floor((host.clientWidth - 20) / 6));
				for(let c = 0; c < 6; c++)
				{
					this._processGrid.resizeColumn('body', c, colWidth);
				}
			}
			this._forceGridLayout();
		}
	}

	private _updateUI(data: IStatusDataPayload): void
	{
		if(!data || !data.metrics) return;

		this._osBadgeEl.textContent = `OS: ${data.os.toUpperCase()}`;
		this._uptimeEl.textContent = `Last update: ${new Date(data.timestamp).toLocaleTimeString()}`;

		const memTotal = data.metrics.memTotalMB || 1;
		const memUsed = data.metrics.memUsedMB || 0;
		const memPct = Math.min(100, Math.max(0, (memUsed / memTotal) * 100));

		// Hydrate samples from server payload
		if(Array.isArray(data.samples) && data.samples.length > 0)
		{
			this._historyMetrics = data.samples.map((s: IPerformanceSample) => ({
				...s,
				time: typeof s.time === 'number' ? s.time : new Date(s.time).getTime()
			}));
		} else
		{
			const sample: IPerformanceSample = {
				time: data.timestamp,
				cpu: data.metrics.cpuUsagePct,
				memPct: memPct,
				diskReadKbps: data.metrics.diskReadKbps || 0,
				diskWriteKbps: data.metrics.diskWriteKbps || 0,
				netRxKbps: data.metrics.netRxKbps || 0,
				netTxKbps: data.metrics.netTxKbps || 0
			};
			this._historyMetrics.push(sample);
			const windowStart = data.timestamp - 30000;
			this._historyMetrics = this._historyMetrics.filter(m => m.time >= windowStart);
		}

		this._renderD3Sparklines();

		// Summary Bar Update
		if(this._summaryBarEl)
		{
			this._summaryBarEl.innerHTML = `
    <div><span style="color:#888;">CPU:</span> <strong style="color:#4ec9b0;">${data.metrics.cpuUsagePct}%</strong></div>
    <div><span style="color:#888;">MEM:</span> <strong style="color:#569cd6;">${Math.round(memUsed)} / ${Math.round(memTotal)} MB (${Math.round(memPct)}%)</strong></div>
    <div><span style="color:#888;">DISK R/W:</span> <strong>${data.metrics.diskReadKbps || 0} / ${data.metrics.diskWriteKbps || 0} KB/s</strong></div>
    <div><span style="color:#888;">NET RX/TX:</span> <strong>${data.metrics.netRxKbps || 0} / ${data.metrics.netTxKbps || 0} KB/s</strong></div>
    <div><span style="color:#888;">PROCS:</span> <strong>${data.processes ? data.processes.length : 0} running</strong></div>
  `;
		}

		// Lumino DataGrid Viewport & Canvas Layout Sync
		// if(Array.isArray(data.processes) && data.processes.length > 0)
		// {
		// 	this._processGridModel.updateData(data.processes);

		// 	if(this._processGrid)
		// 	{
		// 		const host = this._processGrid.node.parentElement;
		// 		if(host && host.clientWidth > 0 && host.clientHeight > 0)
		// 		{
		// 			// Force container pixel bounds to match parent wrapper
		// 			this._processGrid.node.style.width = `${host.clientWidth}px`;
		// 			this._processGrid.node.style.height = `${host.clientHeight}px`;

		// 			// Auto-stretch process columns to fill grid width
		// 			const colWidth = Math.max(90, Math.floor((host.clientWidth - 20) / 6));
		// 			for(let c = 0; c < 6; c++)
		// 			{
		// 				this._processGrid.resizeColumn('body', c, colWidth);
		// 			}
		// 		}

		// 		// Trigger Lumino's internal message loop to redraw the canvas
		// 		this._processGrid.update();
		// 		if((this._processGrid as any).viewport)
		// 		{
		// 			(this._processGrid as any).viewport.update();
		// 		}
		// 	}
		// }

		// Render Processes HTML Table
		if(Array.isArray(data.processes))
		{
			this._processesTableBody.replaceChildren();
			for(const p of data.processes)
			{
				const tr = document.createElement('tr');
				tr.style.borderBottom = '1px solid #222';

				const pidTd = document.createElement('td');
				pidTd.style.padding = '4px 8px';
				pidTd.style.color = '#888';
				pidTd.textContent = String(p.pid);

				const nameTd = document.createElement('td');
				nameTd.style.padding = '4px 8px';
				nameTd.style.fontWeight = 'bold';
				nameTd.textContent = p.name;

				const cpuTd = document.createElement('td');
				cpuTd.style.padding = '4px 8px';
				cpuTd.style.color = p.cpu > 50 ? '#f44747' : '#4ec9b0';
				cpuTd.textContent = `${p.cpu}%`;

				const memTd = document.createElement('td');
				memTd.style.padding = '4px 8px';
				memTd.style.color = '#569cd6';
				memTd.textContent = `${p.memoryMB} MB`;

				const userTd = document.createElement('td');
				userTd.style.padding = '4px 8px';
				userTd.style.color = '#aaa';
				userTd.textContent = p.user;

				const actionTd = document.createElement('td');
				actionTd.style.padding = '4px 8px';
				const killBtn = document.createElement('button');
				killBtn.textContent = 'KILL';
				killBtn.style.fontSize = '9px';
				killBtn.style.padding = '1px 6px';
				killBtn.style.cursor = 'pointer';
				killBtn.style.backgroundColor = '#841919';
				killBtn.style.color = '#fff';
				killBtn.style.border = 'none';
				killBtn.style.borderRadius = '2px';
				killBtn.onclick = () => this._sendAdminCommand('process', String(p.pid), 'kill');

				actionTd.appendChild(killBtn);

				tr.appendChild(pidTd);
				tr.appendChild(nameTd);
				tr.appendChild(cpuTd);
				tr.appendChild(memTd);
				tr.appendChild(userTd);
				tr.appendChild(actionTd);

				this._processesTableBody.appendChild(tr);
			}
		}

		// Render Services Table
		if(Array.isArray(data.services))
		{
			this._servicesTableBody.replaceChildren();
			for(const s of data.services)
			{
				const tr = document.createElement('tr');
				tr.style.borderBottom = '1px solid #2a2a2a';

				const nameTd = document.createElement('td');
				nameTd.textContent = s.name;

				const statusTd = document.createElement('td');
				statusTd.style.color = s.status === 'running' ? '#6a9955' : '#f44747';
				statusTd.textContent = s.status.toUpperCase();

				const actionTd = document.createElement('td');
				const btn = document.createElement('button');
				btn.style.fontSize = '10px';
				btn.style.padding = '2px 6px';
				btn.style.cursor = 'pointer';
				btn.style.backgroundColor = s.status === 'running' ? '#841919' : '#1e5e27';
				btn.style.color = '#fff';
				btn.style.border = 'none';
				btn.style.borderRadius = '2px';
				btn.textContent = s.status === 'running' ? 'STOP' : 'START';
				btn.onclick = () => this._sendAdminCommand('service', s.name, s.status === 'running' ? 'stop' : 'start');

				actionTd.appendChild(btn);
				tr.appendChild(nameTd);
				tr.appendChild(statusTd);
				tr.appendChild(actionTd);
				this._servicesTableBody.appendChild(tr);
			}
		}

		// Render Users
		this._usersContainerEl.replaceChildren();
		if(Array.isArray(data.users))
		{
			for(const line of data.users)
			{
				if(!line || line.includes('----------------') || line.includes('The command completed')) continue;
				const uDiv = document.createElement('div');
				uDiv.style.fontSize = '11px';
				uDiv.style.padding = '2px 0';
				uDiv.style.display = 'flex';
				uDiv.style.justifyContent = 'space-between';

				const textSpan = document.createElement('span');
				textSpan.textContent = line;

				const delBtn = document.createElement('button');
				delBtn.textContent = 'REMOVE';
				delBtn.style.fontSize = '9px';
				delBtn.style.padding = '1px 4px';
				delBtn.style.cursor = 'pointer';
				delBtn.style.backgroundColor = '#5a1d1d';
				delBtn.style.color = '#fff';
				delBtn.style.border = 'none';
				delBtn.onclick = () => this._sendAdminCommand('user', line.trim().split(/\s+/)[0], 'delete');

				uDiv.appendChild(textSpan);
				uDiv.appendChild(delBtn);
				this._usersContainerEl.appendChild(uDiv);
			}
		}

		// Render Startup Applications
		this._startupContainerEl.replaceChildren();
		if(Array.isArray(data.startupApps))
		{
			for(const app of data.startupApps)
			{
				const appDiv = document.createElement('div');
				appDiv.style.fontSize = '11px';
				appDiv.style.padding = '2px 0';
				appDiv.style.display = 'flex';
				appDiv.style.justifyContent = 'space-between';

				const nameSpan = document.createElement('span');
				nameSpan.textContent = `• ${app}`;

				const toggleBtn = document.createElement('button');
				toggleBtn.textContent = 'DISABLE';
				toggleBtn.style.fontSize = '9px';
				toggleBtn.style.padding = '1px 4px';
				toggleBtn.style.cursor = 'pointer';
				toggleBtn.style.backgroundColor = '#3a3a3a';
				toggleBtn.style.color = '#fff';
				toggleBtn.style.border = 'none';
				toggleBtn.onclick = () => this._sendAdminCommand('startup', app, 'disable');

				appDiv.appendChild(nameSpan);
				appDiv.appendChild(toggleBtn);
				this._startupContainerEl.appendChild(appDiv);
			}
		}

		// Render Events
		if(Array.isArray(data.events))
		{
			this._eventsLogEl.replaceChildren();
			for(const ev of data.events)
			{
				const logEntry = document.createElement('div');
				logEntry.style.marginBottom = '3px';
				logEntry.textContent = `> ${ev}`;
				this._eventsLogEl.appendChild(logEntry);
			}
		}

		// --- Render Open Files ---
		if(Array.isArray(data.openFiles))
		{
			this._openFilesTableBody.replaceChildren();
			for(const f of data.openFiles)
			{
				const tr = document.createElement('tr');
				tr.style.borderBottom = '1px solid #222';

				const pidTd = document.createElement('td');
				pidTd.style.padding = '4px 8px';
				pidTd.style.color = '#888';
				pidTd.textContent = String(f.pid);

				const procTd = document.createElement('td');
				procTd.style.padding = '4px 8px';
				procTd.style.fontWeight = 'bold';
				procTd.textContent = f.process;

				const pathTd = document.createElement('td');
				pathTd.style.padding = '4px 8px';
				pathTd.style.color = '#ce9178';
				pathTd.style.wordBreak = 'break-all';
				pathTd.textContent = f.path;

				tr.appendChild(pidTd);
				tr.appendChild(procTd);
				tr.appendChild(pathTd);
				this._openFilesTableBody.appendChild(tr);
			}
		}

		// --- Render Open Ports ---
		if(Array.isArray(data.openPorts))
		{
			this._openPortsTableBody.replaceChildren();
			for(const pt of data.openPorts)
			{
				const tr = document.createElement('tr');
				tr.style.borderBottom = '1px solid #222';

				const protoTd = document.createElement('td');
				protoTd.style.padding = '4px 8px';
				protoTd.style.color = '#569cd6';
				protoTd.textContent = pt.protocol;

				const addrTd = document.createElement('td');
				addrTd.style.padding = '4px 8px';
				addrTd.textContent = pt.localAddress;

				const portTd = document.createElement('td');
				portTd.style.padding = '4px 8px';
				portTd.style.color = '#4ec9b0';
				portTd.style.fontWeight = 'bold';
				portTd.textContent = String(pt.port);

				const procTd = document.createElement('td');
				procTd.style.padding = '4px 8px';
				procTd.textContent = `${pt.process} (${pt.pid})`;

				const stateTd = document.createElement('td');
				stateTd.style.padding = '4px 8px';
				stateTd.style.color = '#6a9955';
				stateTd.textContent = pt.state;

				tr.appendChild(protoTd);
				tr.appendChild(addrTd);
				tr.appendChild(portTd);
				tr.appendChild(procTd);
				tr.appendChild(stateTd);
				this._openPortsTableBody.appendChild(tr);
			}
		}
	}


	private _sendAdminCommand(target: 'service' | 'user' | 'startup' | 'process', name: string, action: string): void
	{
		fetch('/api/status/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ target, name, action })
		}).catch(err => console.error('[StatusWidget] Admin command failed:', err));
	}

	private _renderD3Sparklines(): void
	{
		if(typeof d3 === 'undefined' || !this._d3SvgEl || this._historyMetrics.length === 0) return;

		const svg = d3.select(this._d3SvgEl);
		svg.selectAll('*').remove();

		const width = this._d3SvgEl.clientWidth || 600;
		const height = this._d3SvgEl.clientHeight || 120;
		const margin = { top: 10, right: 10, bottom: 20, left: 30 };

		// Dynamic domain bounds derived directly from sample dataset
		const timeExtent = d3.extent(this._historyMetrics, (d: IPerformanceSample) => new Date(d.time)) as [Date, Date];

		// Fallback domain if extent returns single point
		if(!timeExtent[0] || !timeExtent[1] || timeExtent[0].getTime() === timeExtent[1].getTime())
		{
			const now = new Date();
			timeExtent[0] = new Date(now.getTime() - 30000);
			timeExtent[1] = now;
		}

		const x = d3.scaleTime()
			.domain(timeExtent)
			.range([margin.left, width - margin.right]);

		const y = d3.scaleLinear()
			.domain([0, 100])
			.range([height - margin.bottom, margin.top]);

		const lineCpu = d3.line<IPerformanceSample>()
			.x((d: IPerformanceSample) => x(new Date(d.time)))
			.y((d: IPerformanceSample) => y(d.cpu))
			.curve(d3.curveMonotoneX);

		const lineMem = d3.line<IPerformanceSample>()
			.x((d: IPerformanceSample) => x(new Date(d.time)))
			.y((d: IPerformanceSample) => y(d.memPct))
			.curve(d3.curveMonotoneX);

		// Render Axes
		svg.append('g')
			.attr('transform', `translate(0,${height - margin.bottom})`)
			.call(d3.axisBottom(x).ticks(5))
			.attr('color', '#666');

		svg.append('g')
			.attr('transform', `translate(${margin.left},0)`)
			.call(d3.axisLeft(y).ticks(4))
			.attr('color', '#666');

		// CPU Line (Teal)
		svg.append('path')
			.datum(this._historyMetrics)
			.attr('fill', 'none')
			.attr('stroke', '#4ec9b0')
			.attr('stroke-width', 2)
			.attr('d', lineCpu as any);

		// Memory Line (Blue)
		svg.append('path')
			.datum(this._historyMetrics)
			.attr('fill', 'none')
			.attr('stroke', '#569cd6')
			.attr('stroke-width', 2)
			.attr('d', lineMem as any);
	}
}

widgetSelf.StatusWidget = StatusWidget;
