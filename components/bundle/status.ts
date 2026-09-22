// src/StatusBarWidget.ts
import { Widget, PanelLayout } from '@lumino/widgets';

export class StatusBarWidget extends Widget
{
	private leftSide: HTMLElement;
	private rightSide: HTMLElement;

	constructor()
	{
		super();
		this.id = 'bottom-statusbar';

		// Core layout constraints sizing
		this.node.style.minHeight = '24px';
		this.node.style.maxHeight = '24px';

		this.layout = new PanelLayout();
		this.addClass('ide-status-bar');

		// Build sub-containers to hold items on opposite sides
		this.leftSide = document.createElement('div');
		this.leftSide.className = 'status-bar-left';
		this.leftSide.style.display = 'flex';
		this.leftSide.style.alignItems = 'center';
		this.leftSide.style.gap = '12px';

		this.rightSide = document.createElement('div');
		this.rightSide.className = 'status-bar-right';
		this.rightSide.style.display = 'flex';
		this.rightSide.style.alignItems = 'center';
		this.rightSide.style.gap = '12px';
		this.rightSide.style.marginLeft = 'auto';

		this.node.appendChild(this.leftSide);
		this.node.appendChild(this.rightSide);
	}

	/**
	 * Adds a status indicator to either the left or right side of the bar
	 */
	public addStatusItem(id: string, text: string, iconClass: string = '', align: 'left' | 'right' = 'left'): HTMLDivElement
	{
		const item = document.createElement('div');
		item.id = `status-item-${id}`;
		item.className = 'status-bar-item';
		item.style.display = 'flex';
		item.style.alignItems = 'center';
		item.style.fontSize = '12px';
		item.style.color = '#cccccc';

		if(iconClass)
		{
			const icon = document.createElement('i');
			icon.className = `${iconClass}`;
			icon.style.marginRight = '4px';
			item.appendChild(icon);
		}

		const label = document.createElement('span');
		label.className = 'status-item-label';
		label.textContent = text;
		item.appendChild(label);

		if(align === 'right')
		{
			this.rightSide.appendChild(item);
		} else
		{
			this.leftSide.appendChild(item);
		}

		return item;
	}

	/**
	 * Updates an existing status item text value on the fly
	 */
	public updateStatusItem(id: string, text: string): void
	{
		const label = this.node.querySelector(`#status-item-${id} .status-item-label`);
		if(label)
		{
			label.textContent = text;
		}
	}
}
