import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import type { RepositoryToolbar } from "./menu-repos";
import type { AceEditorWidget } from "../editor/widget";
import type { GlobalToolbarsWindow } from "./menu.d";
import type { LuminoLayoutWindow } from "./lumino.d";
import type { GithubWindow } from "./github.d";

export type NavPoint = {
	fileId: string;
	row: number;
	column: number;
};


const menuSelf: GlobalToolbarsWindow & LuminoLayoutWindow & GithubWindow = self as unknown as any;

export class HistoryToolbar extends Widget
{
	private static _instance: HistoryToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	// Internal state tracking mirroring NavHistory functionality
	public stack: any[] = [];
	public index: number = -1;
	public isNavigating: boolean = false;

	private _dropdownMenu: HTMLUListElement | null = null;

	private constructor()
	{
		super();
		this.id = 'history-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): HistoryToolbar
	{
		if(!HistoryToolbar._instance)
		{
			HistoryToolbar._instance = new HistoryToolbar();
			menuSelf.historyToolbar = HistoryToolbar._instance;
		}
		return HistoryToolbar._instance;
	}

	public initialize(commands: CommandRegistry): HistoryToolbar
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

		if(!this._commands.hasCommand('history-back'))
		{
			this._commands.addCommand('history-back', {
				label: 'Go Back',
				execute: () => this.back()
			});
		}

		if(!this._commands.hasCommand('history-forward'))
		{
			this._commands.addCommand('history-forward', {
				label: 'Go Forward',
				execute: () => this.forward()
			});
		}
	}

	// --- NavHistory Core Operations ---
	public push(fileId: any, row: number, column: number): void
	{
		if(this.isNavigating) return;

		if(this.index < this.stack.length - 1)
		{
			this.stack = this.stack.slice(0, this.index + 1);
		}

		this.stack.push({ fileId, row, column });
		this.index = this.stack.length - 1;
	}

	public back(): void
	{
		if(this.index > 0)
		{
			this.isNavigating = true;
			this.index--;
			this.apply();
			this.isNavigating = false;
		}
	}

	public forward(): void
	{
		if(this.index < this.stack.length - 1)
		{
			this.isNavigating = true;
			this.index++;
			this.apply();
			this.isNavigating = false;
		}
	}

	public apply(): void
	{
		const point = this.stack[this.index];
		const database = menuSelf.RepositoryToolbar?.owner?.value + '/' + menuSelf.RepositoryToolbar?.repository?.value;
		const filePath = menuSelf.trees?.[database].nodesById[point.fileId].path;

		menuSelf.currentOpenFileId = point.fileId;
		if(menuSelf.trees && menuSelf.trees[database])
		{
			menuSelf.trees[database].values = [point.fileId];
		}

		menuSelf.FileManager?.navigateFile(filePath, void 0, void 0, void 0, point.row + 1, point.column);

		// TODO:
		//this.updateTriggerButtonValue(meta.icon, meta.title, timeString);
	}

	// --- History Tracking Frame & Pipeline ---
	public recordFileHistory(filePath: string, sha?: string, lineNumber: number | null = null): void
	{
		const aceEditor = menuSelf.lastInteractedWidget?.constructor.name === 'AceEditorWidget'
			? menuSelf.lastInteractedWidget as AceEditorWidget
			: undefined;
		const fileNameMatch = filePath.match(/[^/\\#]+$/);
		const fileName = fileNameMatch ? fileNameMatch[0] : filePath;

		let targetLine = lineNumber;
		if(!lineNumber && typeof aceEditor !== 'undefined'
			&& typeof aceEditor._editor !== 'undefined'
		)
		{
			targetLine = aceEditor._editor.getCursorPosition().row + 1;
		}

		const dynamicTitle = targetLine
			? `${fileName} : ${targetLine} · Q3IDE`
			: `${fileName} · Q3IDE`;

		document.title = dynamicTitle;

		if(typeof aceEditor !== 'undefined' && typeof aceEditor._editor !== 'undefined')
		{
			const pos = aceEditor._editor.getCursorPosition();
			const finalLineNumber = targetLine !== null ? targetLine : (pos.row + 1);

			this.appendHistoryItem({
				filePath: filePath,
				sha: sha,
				row: pos.row,
				column: pos.column,
				lineNumber: finalLineNumber
			}, "file");

			this.push(sha, pos.row, pos.column);

			const hashRoute = `#${filePath}:${finalLineNumber}`;
			history.pushState({ location: window.location.toString(), title: dynamicTitle }, dynamicTitle, hashRoute);
		} else
		{
			const fallbackHash = '#' + filePath + (lineNumber ? ':' + lineNumber : '');
			history.pushState({ location: window.location.toString(), title: dynamicTitle }, dynamicTitle, fallbackHash);
		}
	}

	public appendHistoryItem(actionData: any, type: string = "paint"): void
	{
		if(!this._dropdownMenu) return;

		if(this._dropdownMenu.children.length === 1 && this._dropdownMenu.children[0].getAttribute('value') === '')
		{
			this._dropdownMenu.children[0].innerHTML = 'Beginning of time.';
		}

		let meta = { icon: "⚡", title: "Action Captured", desc: "System update logged." };

		if(type === 'editor')
		{
			meta = this.extractAceMetadata(actionData);
		} else if(type === 'nunu')
		{
			meta = this.extractNunuMetadata(actionData);
		} else if(type === 'audio')
		{
			meta = this.extractAudioMetadata(actionData);
		} else if(type === "paint")
		{
			meta = this.extractPaintMetadata(actionData);
		} else if(type === "file")
		{
			meta = {
				icon: "📄",
				title: actionData.filePath.split('/').pop() || '',
				desc: `Line ${actionData.row + 1}, Col ${actionData.column} — ${actionData.filePath}`
			};
		}

		const now = new Date();
		const timeString = now.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});

		const li = document.createElement('li');
		li.className = "history-item undo";
		(li as any).userData = actionData;

		li.setAttribute('data-icon', meta.icon);
		li.setAttribute('data-title', meta.title);
		li.setAttribute('data-time', timeString);

		li.innerHTML = `
            <div class="item-header">
                <span class="action-icon">${meta.icon}</span>
                <strong>${meta.title}</strong>
            </div>
            <p class="item-desc">${meta.desc} <span class="item-time-stamp">(${timeString})</span></p>
        `;

		// Interactive history item selection handling
		li.addEventListener('click', () =>
		{
			this.updateTriggerButtonValue(meta.icon, meta.title, timeString);
			if(type === "file")
			{
				this.push(actionData.sha, actionData.row, actionData.column);
				this.apply();
			}
			this._toggleMenu(false);
		});

		if(this._dropdownMenu.children.length > 0)
		{
			this._dropdownMenu.insertBefore(li, this._dropdownMenu.children[0]);
		} else
		{
			this._dropdownMenu.appendChild(li);
		}

		this.updateTriggerButtonValue(meta.icon, meta.title, timeString);
	}

	public updateTriggerButtonValue(icon: string, title: string, timeStr: string): void
	{
		const trigger = this.node.querySelector('#fileHistory');
		if(!trigger) return;

		const valueContainer = trigger.querySelector('.selected-value');
		if(valueContainer)
		{
			valueContainer.innerHTML = `
                <span class="trigger-icon-wrapper">${icon}</span>
                <span>${title} (${timeStr})</span>
            `;
		}
	}

	// --- Dom & Structural Rendering Configuration ---
	private _buildInterface(): void
	{
		// Container wrapper elements configured to isolate absolute rendering stacks
		this.node.style.position = 'relative';
		this.node.setAttribute('placeholder', 'Current Filename');
		this.node.innerHTML = `
			<button name="fileHistory" class="select-box-trigger" aria-haspopup="listbox" id="fileHistory">
				<div class="selected-value">
					<i class="bx bx-undo"></i>
					<span>No History Recorded</span>
				</div>
				<i class="bx bx-chevron-down toggle-arrow"></i>
			</button>
        `;
		this._dropdownMenu = document.createElement('ul') as HTMLUListElement;
		this._dropdownMenu.id = 'historyMenu';
		this._dropdownMenu.classList.add('history-menu-dropdown');
		this._dropdownMenu.innerHTML = '<li value="" class="empty-history-notice history-item">No current items</li>';
		document.body.appendChild(this._dropdownMenu);

		const trigger = this.node.querySelector('#fileHistory');

		trigger?.addEventListener('click', (e) =>
		{
			e.stopPropagation();
			const isVisible = this._dropdownMenu?.classList.contains('show');
			const rect = trigger.getBoundingClientRect();
			if(this._dropdownMenu)
			{
				this._dropdownMenu.style.top = (rect.y + rect.height) + 'px';
				this._dropdownMenu.style.left = rect.x + 'px';
			}
			this._toggleMenu(!isVisible);
		});

		// Click-outside setup to safely auto-collapse dropdown
		document.addEventListener('click', () => this._toggleMenu(false));
	}

	private _toggleMenu(show: boolean): void
	{
		if(!this._dropdownMenu) return;
		if(show)
		{
			this._dropdownMenu.classList.add('show');
		} else
		{
			this._dropdownMenu.classList.remove('show');
		}
	}

	// --- Modular Metadata Parsing Extractor Implementations ---
	public extractNunuMetadata(actionObj: any)
	{
		let icon = "🧊";
		let title = actionObj.action_description || "3D Object Change";
		let desc = "Engine modification recorded.";
		const actions = actionObj.actions || [];

		if(actions.length > 0)
		{
			if(actions[0].attribute !== undefined)
			{
				icon = "🚀";
				const targetAttributes = actions.map((a: any) => a.attribute);
				const objectType = actions[0].object?.type || "Object3D";
				const currentPos = actions[0].object || { x: 0, y: 0, z: 0 };

				if(targetAttributes.includes('x') && targetAttributes.includes('y') && targetAttributes.includes('z'))
				{
					title = `Translate ${objectType}`;
					desc = `Moved to Position: [${currentPos.x}, ${currentPos.y}, ${currentPos.z}]`;
				} else
				{
					title = `Modify ${objectType}`;
					desc = actions.map((a: any) => `${a.attribute}: ${a.oldValue} ➡️ ${a.newValue}`).join(' | ');
				}
			} else
			{
				const meshNode = actions.find((a: any) => a.type !== undefined) || actions[0];
				const geometryNode = actions.find((a: any) => a.category === "geometries" || a.resource !== undefined);
				icon = "➕";
				const entityName = meshNode.name ? `"${meshNode.name}"` : "Entity";
				const entityType = meshNode.type || "Object3D";
				title = `Insert ${entityType}: ${entityName}`;

				if(meshNode.position)
				{
					const p = meshNode.position;
					desc = `Placed at [${p.x}, ${p.y}, ${p.z}]`;
				} else if(geometryNode?.resource?.type)
				{
					desc = `Geometry structure: ${geometryNode.resource.type}`;
				} else
				{
					desc = `UUID: ${meshNode.uuid ? meshNode.uuid.slice(0, 8) : 'N/A'}`;
				}
			}
		}
		return { icon, title, desc };
	}

	public extractAceMetadata(actionObj: any)
	{
		const fileName = actionObj.filePath ? actionObj.filePath.split('/').pop() : (actionObj.fileName || "Unknown File");
		const displayPath = actionObj.filePath || fileName;
		const row = actionObj.row !== undefined ? actionObj.row : 0;
		const column = actionObj.column !== undefined ? actionObj.column : 0;

		let icon = "📄";
		let title = fileName;
		let desc = `Line ${row + 1}, Col ${column} — ${displayPath}`;

		if(actionObj.action_id === "ace_edit_action" || actionObj.delta)
		{
			icon = "📝";
			title = actionObj.action_description || "Code Modified";
			const delta = actionObj.delta;
			if(delta)
			{
				const lineCount = delta.lines?.length || 1;
				const contextText = lineCount > 1 ? `${lineCount} lines` : `col ${column}`;
				desc = `${fileName} — ${delta.action === "remove" ? "Removed" : "Inserted"} at line ${row + 1} (${contextText})`;
			} else
			{
				desc = `Line ${row + 1}, Col ${column} — ${fileName}`;
			}
		} else if(actionObj.action_id === "file_action")
		{
			icon = "📄";
			title = fileName;
			desc = `Line ${row + 1}, Col ${column} — ${displayPath}`;
		}
		return { icon, title, desc };
	}

	public extractPaintMetadata(actionObj: any)
	{
		const subAction = actionObj.actions_to_do?.[0];
		const settings = subAction?.settings;
		const refLayer = subAction?.reference_layer;

		let icon = "🎨";
		let title = actionObj.action_description || "Graphics Modification";
		let desc = `UUID: ${actionObj.uuid ? actionObj.uuid.slice(0, 8) : 'N/A'}`;

		if(actionObj.action_id === "new_brush_layer")
		{
			icon = "🖌️";
			title = "New Brush Layer";
			if(settings?.params)
			{
				desc = `Size: ${settings.params.size}px | Color: ${settings.color || 'none'}`;
			}
		} else if(actionObj.action_id === "update_brush_layer")
		{
			icon = "✍️";
			title = refLayer?.name || "Update Brush Layer";
			const strokeCount = settings?.data?.length || refLayer?.data?.length || 0;
			const dimensions = refLayer ? ` (${Math.round(refLayer.width)}x${Math.round(refLayer.height)}px)` : "";
			desc = `Modified ${strokeCount} vector paths${dimensions}`;
		} else if(subAction?.action_id === "update_layer")
		{
			icon = "🔄";
			const layerName = settings?.name || refLayer?.name || "Layer";
			const layerType = settings?.type || refLayer?.type || "Unknown";
			const layerOrder = settings?.order !== undefined ? settings.order : (refLayer?.order !== undefined ? refLayer.order : "N/A");
			title = `Update Layer: ${layerName}`;
			desc = `Type: ${layerType} | Order position: ${layerOrder}`;
		}
		return { icon, title, desc };
	}

	public extractAudioMetadata(actionObj: any)
	{
		const trackName = actionObj.trackName || actionObj.fileName || "Untitled Audio";
		const operation = actionObj.operation || "Audio Edit";

		let icon = "🎵";
		let title = `${operation}: ${trackName}`;
		let desc = "Audio track modified.";

		if(actionObj.startRegion !== undefined && actionObj.endRegion !== undefined)
		{
			const start = Number(actionObj.startRegion).toFixed(2);
			const end = Number(actionObj.endRegion).toFixed(2);
			desc = `Region: ${start}s to ${end}s (${(Number(end) - Number(start)).toFixed(2)}s selection)`;
		} else if(actionObj.duration)
		{
			desc = `Total track length: ${Number(actionObj.duration).toFixed(2)}s`;
		} else if(actionObj.action_description)
		{
			desc = actionObj.action_description;
		}

		const opLower = operation.toLowerCase();
		if(opLower.includes('cut') || opLower.includes('crop') || opLower.includes('trim'))
		{
			icon = "✂️";
		} else if(opLower.includes('volume') || opLower.includes('gain') || opLower.includes('fade'))
		{
			icon = "🔊";
		} else if(opLower.includes('effect') || opLower.includes('delay') || opLower.includes('reverb'))
		{
			icon = "🎛️";
		} else if(opLower.includes('reverse') || opLower.includes('invert'))
		{
			icon = "⏪";
		}
		return { icon, title, desc };
	}
}

menuSelf.HistoryToolbar = HistoryToolbar;
export const historyToolbar = HistoryToolbar.getInstance();
