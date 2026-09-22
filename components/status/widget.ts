import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';

import type { MenuModules } from '../bundle/menu-manager';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { IStatusDataPayload } from './generate';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';

// Rely on cheap external global D3 import as used in your existing bundle
declare const d3: typeof import('d3');

const widgetSelf: LuminoLayoutWindow & GlobalToolbarsWindow & { StatusWidget?: typeof StatusWidget; } = self as unknown as any;

export class StatusWidget extends Widget
{
	public static instance: StatusWidget | null = null;

	private _endpoint: string;
	private _abortController: AbortController | null = null;
	private _historyMetrics: Array<{ time: Date; cpu: number; mem: number; }> = [];

	// Layout Accordion Containers
	private _accordionContainer!: HTMLElement;
	private _d3SvgEl!: SVGSVGElement;
	private _processesTableBody!: HTMLElement;
	private _servicesListEl!: HTMLElement;
	private _usersListEl!: HTMLElement;
	private _startupListEl!: HTMLElement;
	private _eventsLogEl!: HTMLElement;
	private _osBadgeEl!: HTMLElement;

	constructor(endpoint: string = '/api/status/stream')
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
		this.node.style.color = '#d4d4d4';
		this.node.style.fontFamily = 'Consolas, "Courier New", monospace';

		this.title.label = 'System Task Manager';
		this.title.iconClass = 'fa fa-dashboard';
		this.title.closable = true;

		this._endpoint = endpoint;
		this._buildUI();
	}

	/**
	 * Singleton Manager to enforce only one Instance open inside the Lumino Dock.
	 */
	public static getInstance(endpoint?: string): StatusWidget
	{
		if(!StatusWidget.instance || StatusWidget.instance.isDisposed)
		{
			StatusWidget.instance = new StatusWidget(endpoint);
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
				projectId: widget.constructor.name
			});
		}
	}

	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
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

	/**
	 * Reads http chunked streams incrementally without connection timeouts.
	 */
	public async startStreamingFetch(): Promise<void>
	{
		this.stopStreamingFetch();
		this._abortController = new AbortController();

		try
		{
			const response = await fetch(this._endpoint, {
				signal: this._abortController.signal,
				headers: { 'Accept': 'application/x-ndjson, application/json' }
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
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep partial line chunk

				for(const line of lines)
				{
					if(!line.trim()) continue;
					try
					{
						const payload: IStatusDataPayload = JSON.parse(line);
						this._updateUI(payload);
					} catch
					{
						// Partial JSON guard
					}
				}
			}
		} catch(err: any)
		{
			if(err.name !== 'AbortError')
			{
				console.warn('[StatusWidget] Fetch stream disconnected:', err);
			}
		}
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
		// Header Toolbar
		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		header.style.padding = '8px 12px';
		header.style.backgroundColor = '#252526';
		header.style.borderBottom = '1px solid #3c3c3c';

		const titleEl = document.createElement('span');
		titleEl.style.fontWeight = 'bold';
		titleEl.textContent = 'System Diagnostics & Performance';

		this._osBadgeEl = document.createElement('span');
		this._osBadgeEl.style.padding = '2px 6px';
		this._osBadgeEl.style.borderRadius = '3px';
		this._osBadgeEl.style.fontSize = '11px';
		this._osBadgeEl.style.backgroundColor = '#007acc';
		this._osBadgeEl.style.color = '#ffffff';
		this._osBadgeEl.textContent = 'OS: DETECTING...';

		header.appendChild(titleEl);
		header.appendChild(this._osBadgeEl);

		// Accordion Shell
		this._accordionContainer = document.createElement('div');
		this._accordionContainer.style.flex = '1';
		this._accordionContainer.style.overflowY = 'auto';
		this._accordionContainer.style.padding = '8px';

		// 1. Performance Panel (D3 Charts)
		const perfContent = document.createElement('div');
		perfContent.style.height = '140px';
		perfContent.style.width = '100%';
		this._d3SvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this._d3SvgEl.style.width = '100%';
		this._d3SvgEl.style.height = '100%';
		perfContent.appendChild(this._d3SvgEl);

		// 2. Processes Panel
		const procContent = document.createElement('div');
		procContent.style.maxHeight = '220px';
		procContent.style.overflowY = 'auto';
		const procTable = document.createElement('table');
		procTable.style.width = '100%';
		procTable.style.borderCollapse = 'collapse';
		procTable.style.fontSize = '12px';
		procTable.innerHTML = `
      <thead>
        <tr style="text-align:left; border-bottom:1px solid #444;">
          <th>PID</th><th>Name</th><th>CPU %</th><th>Mem (MB)</th><th>User</th>
        </tr>
      </thead>
    `;
		this._processesTableBody = document.createElement('tbody');
		procTable.appendChild(this._processesTableBody);
		procContent.appendChild(procTable);

		// 3. Grid Row Panel (Services & Users / Startup)
		const gridContent = document.createElement('div');
		gridContent.style.display = 'grid';
		gridContent.style.gridTemplateColumns = '1fr 1fr';
		gridContent.style.gap = '8px';

		this._servicesListEl = document.createElement('div');
		this._servicesListEl.style.maxHeight = '150px';
		this._servicesListEl.style.overflowY = 'auto';

		const subRight = document.createElement('div');
		this._usersListEl = document.createElement('div');
		this._startupListEl = document.createElement('div');
		subRight.appendChild(this._usersListEl);
		subRight.appendChild(this._startupListEl);

		gridContent.appendChild(this._servicesListEl);
		gridContent.appendChild(subRight);

		// 4. App Events & dmesg Panel
		this._eventsLogEl = document.createElement('div');
		this._eventsLogEl.style.maxHeight = '150px';
		this._eventsLogEl.style.overflowY = 'auto';
		this._eventsLogEl.style.fontSize = '11px';
		this._eventsLogEl.style.color = '#ce9178';

		// Mount Sections into Accordion
		this._accordionContainer.appendChild(this._createAccordionSection('Performance Metrics (Sustained Window)', perfContent, true));
		this._accordionContainer.appendChild(this._createAccordionSection('Active Processes', procContent, true));
		this._accordionContainer.appendChild(this._createAccordionSection('Services, Users & Startup Apps', gridContent, false));
		this._accordionContainer.appendChild(this._createAccordionSection('App History / dmesg Events', this._eventsLogEl, false));

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
		header.textContent = `${expanded ? '▼' : '►'} ${title}`;

		contentEl.style.display = expanded ? 'block' : 'none';
		contentEl.style.padding = '8px';
		contentEl.style.backgroundColor = '#181818';

		header.addEventListener('click', () =>
		{
			const isVisible = contentEl.style.display === 'block';
			contentEl.style.display = isVisible ? 'none' : 'block';
			header.textContent = `${!isVisible ? '▼' : '►'} ${title}`;
		});

		wrapper.appendChild(header);
		wrapper.appendChild(contentEl);
		return wrapper;
	}

	private _updateUI(data: IStatusDataPayload): void
	{
		this._osBadgeEl.textContent = `OS: ${data.os.toUpperCase()}`;

		// Maintain 30-second idempotent sliding time window for D3
		const now = new Date(data.timestamp);
		this._historyMetrics.push({
			time: now,
			cpu: data.metrics.cpuUsagePct,
			mem: (data.metrics.memUsedMB / data.metrics.memTotalMB) * 100
		});

		const thirtySecsAgo = new Date(now.getTime() - 30000);
		this._historyMetrics = this._historyMetrics.filter(m => m.time >= thirtySecsAgo);
		this._renderD3Sparklines();

		// Render Processes
		this._processesTableBody.replaceChildren();
		for(const p of data.processes)
		{
			const tr = document.createElement('tr');
			tr.style.borderBottom = '1px solid #2a2a2a';
			tr.innerHTML = `<td>${p.pid}</td><td>${p.name}</td><td>${p.cpu}%</td><td>${p.memoryMB} MB</td><td>${p.user}</td>`;
			this._processesTableBody.appendChild(tr);
		}

		// Render Services
		this._servicesListEl.replaceChildren();
		const svcHeader = document.createElement('strong');
		svcHeader.textContent = 'Services:';
		this._servicesListEl.appendChild(svcHeader);
		for(const s of data.services)
		{
			const div = document.createElement('div');
			div.style.fontSize = '11px';
			div.style.color = s.status === 'running' ? '#6a9955' : '#f44747';
			div.textContent = `• [${s.status}] ${s.name}`;
			this._servicesListEl.appendChild(div);
		}

		// Render Users & Startup
		this._usersListEl.innerHTML = `<strong>Users:</strong> ${data.users.join(', ')}`;
		this._startupListEl.innerHTML = `<strong style="margin-top:4px; display:block;">Startup Apps:</strong> ${data.startupApps.slice(0, 5).join(', ')}`;

		// Render Events Log
		this._eventsLogEl.replaceChildren();
		for(const ev of data.events)
		{
			const div = document.createElement('div');
			div.textContent = `> ${ev}`;
			this._eventsLogEl.appendChild(div);
		}
	}

	/**
	 * Renders idempotent sliding-window D3 sparklines.
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

		const lineCpu = d3.line<{ time: Date; cpu: number; }>()
			.x(d => x(d.time))
			.y(d => y(d.cpu))
			.curve(d3.curveMonotoneX);

		const lineMem = d3.line<{ time: Date; mem: number; }>()
			.x(d => x(d.time))
			.y(d => y(d.mem))
			.curve(d3.curveMonotoneX);

		// Grid Axes
		svg.append('g')
			.attr('transform', `translate(0,${height - margin.bottom})`)
			.call(d3.axisBottom(x).ticks(5))
			.attr('color', '#666');

		svg.append('g')
			.attr('transform', `translate(${margin.left},0)`)
			.call(d3.axisLeft(y).ticks(4))
			.attr('color', '#666');

		// CPU Line (Green)
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
