import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { DataGrid, DataModel } from '@lumino/datagrid';

import type { IPerformanceSample, IProcessInfo, IStatusDataPayload } from './generate';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';

// Rely on global cheap D3 import
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
		return region === 'row-header' ? 6 : 0;
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
	private _accordionContainer!: HTMLElement;
	private _d3SvgEl!: SVGSVGElement;
	private _osBadgeEl!: HTMLElement;
	private _uptimeEl!: HTMLElement;

	// Lumino Grids & Interactive Containers
	private _processGrid!: DataGrid;
	private _processGridModel!: ProcessGridModel;
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
		this.title.iconClass = 'fa fa-server';
		this.title.closable = true;

		if(endpoint && endpoint !== 'System Status')
		{
			this.title.label = title ?? endpoint;
			this._endpoint = endpoint;
		}
		//this._buildUI();
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

	protected onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		this._renderD3Sparklines();
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

				// Strip leading array bracket if stream opens with '[' or '[\n'
				buffer = buffer.replace(/^\s*\[\s*/, '');

				let boundary: number;
				// Search for end of a complete root JSON object block
				while((boundary = this._findJsonObjectEnd(buffer)) !== -1)
				{
					const jsonStr = buffer.slice(0, boundary + 1).trim();
					// Advance buffer past this object and any trailing comma or array whitespace
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

	/**
	 * Helper method to scan raw buffer for matching closing curly brace '}' of a top-level JSON object.
	 */
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
					return i; // Index of matching closing brace
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

	private _buildUI(): void
	{
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

		header.appendChild(titleEl);
		header.appendChild(rightContainer);

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

		// Panel 2: Lumino Process DataGrid
		const procContent = document.createElement('div');
		procContent.style.height = '240px';
		procContent.style.width = '100%';
		procContent.style.position = 'relative';

		this._processGridModel = new ProcessGridModel();
		this._processGrid = new DataGrid({
			style: {
				...DataGrid.defaultStyle,
				voidColor: '#1e1e1e',
				backgroundColor: '#181818',
				headerBackgroundColor: '#252526',
				headerGridLineColor: '#3c3c3c',
				gridLineColor: '#2d2d2d',
				//labelColor: '#cccccc',
				selectionFillColor: 'rgba(0, 122, 204, 0.2)'
			}
		});
		this._processGrid.dataModel = this._processGridModel;
		this._processGrid.node.style.position = 'absolute';
		this._processGrid.node.style.top = '0';
		this._processGrid.node.style.left = '0';
		this._processGrid.node.style.width = '100%';
		this._processGrid.node.style.height = '100%';

		// Append the DataGrid node directly to the wrapper node
		procContent.appendChild(this._processGrid.node);

		// Panel 3: Services Table with Control Actions
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


		// Panel 4: Users & Startup Management
		const mgmtGrid = document.createElement('div');
		mgmtGrid.style.display = 'grid';
		mgmtGrid.style.gridTemplateColumns = '1fr 1fr';
		mgmtGrid.style.gap = '12px';

		this._startupContainerEl = document.createElement('div');
		mgmtGrid.appendChild(this._startupContainerEl);

		// Panel 5: Event / dmesg Log Stream
		this._eventsLogEl = document.createElement('div');
		this._eventsLogEl.style.maxHeight = '160px';
		this._eventsLogEl.style.overflowY = 'auto';
		this._eventsLogEl.style.fontSize = '11px';
		this._eventsLogEl.style.color = '#ce9178';
		this._eventsLogEl.style.backgroundColor = '#141414';
		this._eventsLogEl.style.padding = '8px';
		this._eventsLogEl.style.border = '1px solid #282828';

		// Mount Accordion Sections
		this._accordionContainer.appendChild(this._createAccordionSection('Performance Metrics (Sustained 30s Window)', perfContent, true));
		this._accordionContainer.appendChild(this._createAccordionSection('Active Processes (Task Manager View)', procContent, true));
		this._accordionContainer.appendChild(this._createAccordionSection('System Services', svcContent, false));
		this._accordionContainer.appendChild(this._createAccordionSection('User Accounts', userGrid, false));
		this._accordionContainer.appendChild(this._createAccordionSection('Startup Applications', mgmtGrid, false));
		this._accordionContainer.appendChild(this._createAccordionSection('App History / System Log (dmesg & EventLog)', this._eventsLogEl, false));

		this.node.appendChild(header);
		this.node.appendChild(this._accordionContainer);
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
			if(!isVisible && contentEl.contains(this._processGrid.node))
			{
				this._processGrid.update();
			}
		});

		wrapper.appendChild(header);
		wrapper.appendChild(contentEl);
		return wrapper;
	}

	private _updateUI(data: IStatusDataPayload): void
	{
		if(!data || !data.metrics) return;

		this._osBadgeEl.textContent = `OS: ${data.os.toUpperCase()}`;
		this._uptimeEl.textContent = `Last update: ${new Date(data.timestamp).toLocaleTimeString()}`;

		// Calculate memory percentage safely
		const memTotal = data.metrics.memTotalMB || 1;
		const memUsed = data.metrics.memUsedMB || 0;
		const memPct = Math.min(100, Math.max(0, (memUsed / memTotal) * 100));

		// Maintain 30-second sliding time window
		const now = new Date(data.timestamp).getTime();
		const sample: IPerformanceSample = {
			time: now,
			cpu: data.metrics.cpuUsagePct,
			memPct: memPct,
			diskReadKbps: data.metrics.diskReadKbps || 0,
			diskWriteKbps: data.metrics.diskWriteKbps || 0,
			netRxKbps: data.metrics.netRxKbps || 0,
			netTxKbps: data.metrics.netTxKbps || 0
		};

		this._historyMetrics.push(sample);
		const thirtySecsAgo = Date.now() - 30000;
		this._historyMetrics = this._historyMetrics.filter(m => m.time >= thirtySecsAgo);
		this._renderD3Sparklines();

		// Update Lumino Process Grid Data
		if(Array.isArray(data.processes) && data.processes.length > 0)
		{
			this._processGridModel.updateData(data.processes);
			this._processGrid.update();
		}

		// Render Services Table with Administrative Controls
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

		// Parse Multi-line Windows User Output into Structured Management List
		this._usersContainerEl.replaceChildren();
		//const userHeader = document.createElement('h4');
		//userHeader.style.margin = '0 0 6px 0';
		//userHeader.style.color = '#007acc';
		//userHeader.textContent = 'Active Users & Sessions';
		//this._usersContainerEl.appendChild(userHeader);

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

		// Render Startup Applications Control
		this._startupContainerEl.replaceChildren();
		const startupHeader = document.createElement('h4');
		startupHeader.style.margin = '0 0 6px 0';
		startupHeader.style.color = '#007acc';
		startupHeader.textContent = 'Startup Applications';
		this._startupContainerEl.appendChild(startupHeader);

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

		// Render Event / dmesg Logs
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
	}

	private _sendAdminCommand(target: 'service' | 'user' | 'startup' | 'process', name: string, action: string): void
	{
		fetch('/api/status/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ target, name, action })
		}).catch(err => console.error('[StatusWidget] Admin command failed:', err));
	}

	/**
	 * Renders fully typed idempotent sliding-window D3 sparklines.
	 */
	private _renderD3Sparklines(): void
	{
		if(typeof d3 === 'undefined' || !this._d3SvgEl || this._historyMetrics.length === 0) return;

		const svg = d3.select(this._d3SvgEl);
		svg.selectAll('*').remove();

		const width = this._d3SvgEl.clientWidth || 400;
		const height = this._d3SvgEl.clientHeight || 120;
		const margin = { top: 10, right: 10, bottom: 20, left: 30 };

		const now = new Date();
		const thirtySecsAgo = new Date(now.getTime() - 30000);

		const x = d3.scaleTime()
			.domain([thirtySecsAgo, now])
			.range([margin.left, width - margin.right]);

		const y = d3.scaleLinear()
			.domain([0, 100])
			.range([height - margin.bottom, margin.top]);

		const lineCpu = d3.line<IPerformanceSample>()
			.x((d: IPerformanceSample) => x(d.time))
			.y((d: IPerformanceSample) => y(d.cpu))
			.curve(d3.curveMonotoneX);

		const lineMem = d3.line<IPerformanceSample>()
			.x((d: IPerformanceSample) => x(d.time))
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
