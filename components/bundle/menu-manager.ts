import { Menu, MenuBar } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import type { LuminoMenuWindow } from './menu.d';
import type { FileSystemWindow, LuminoLayoutWindow } from './lumino.d';

const menuSelf: LuminoMenuWindow & LuminoLayoutWindow & FileSystemWindow = self as unknown as any;

export interface MenuConfig
{
	name?: string;
	target?: string;
	href?: string;
	parameter?: string;
	shortcut?: string;
	iconClass?: string;
	ellipsis?: boolean;
	divider?: boolean;
	children?: MenuConfig[];
}

export interface MenuModules
{
	modules?: Record<string, Record<string, Function>>;
}


/**
 * Metadata key used to track the source owner of an item at runtime.
 * We attach this to Lumino Menu.IItem elements dynamically.
 */
interface TrackedMenuItem extends Menu.IItem
{
	ownerId?: string | null;
}


export class MenuManager
{

	/**
	 * Idempotently merges a configuration structure into the shared MenuBar.
	 * @param ownerId Unique identifier for the calling widget (e.g., widget.id)
	 * @param config Top-level menu categories (e.g., File, Edit, Tools)
	 */
	public static injectMenus(ownerId: string | null | undefined, config: MenuConfig[] | MenuConfig): void
	{
		if(!(config instanceof Array))
		{
			config = [config];
		}
		config.forEach((topLevel) =>
		{
			if(!topLevel.name) return;

			// 1. Find or create the matching top-level Menu on the main MenuBar
			let targetMenu = this._findMenuBarMenuByLabel(topLevel.name);
			if(!targetMenu && menuSelf.commandRegistry)
			{
				targetMenu = new Menu({ commands: menuSelf.commandRegistry });
				targetMenu.title.label = topLevel.name;
				menuSelf.globalMenuBar?.addMenu(targetMenu);
			}

			// 2. Merge child items recursively into this top-level menu container
			if(topLevel.children && topLevel.children.length > 0 && targetMenu)
			{
				this._mergeMenuItems(ownerId, targetMenu, topLevel.children);
			}
		});
	}

	/**
	 * Removes all menu items down the tree matching the specified ownerId.
	 * Automatically prunes empty submenus or dangling separators.
	 */
	public static removeMenus(ownerId: string): void
	{
		// Iterate backward through top-level menus to allow safe removal
		const menus = menuSelf.globalMenuBar?.menus ?? [];
		for(let i = menus.length - 1; i >= 0; i--)
		{
			const menu = menus[i];
			this._pruneMenuTree(ownerId, menu);

			// If the top level menu has been completely hollowed out, remove it from the bar
			if(menu.items.length === 0)
			{
				menuSelf.globalMenuBar?.removeMenu(menu);
			}
		}
	}

	/**
	 * Recursively traverses and inserts missing configurations into a targeted menu node
	 */
	private static _mergeMenuItems(ownerId: string | null | undefined, targetMenu: Menu, items: MenuConfig[], parentMenu?: string | null): void
	{
		items.forEach((item) =>
		{
			if(item.divider)
			{
				// To maintain idempotency, avoid stacking multiple consecutive dividers
				const lastItem = targetMenu.items[targetMenu.items.length - 1] as TrackedMenuItem;
				if(lastItem && lastItem.type === 'separator')
				{
					return;
				}
				const addedItem = targetMenu.addItem({ type: 'separator' }) as TrackedMenuItem;
				addedItem.ownerId = ownerId;
				return;
			}

			if(item.children && item.children.length > 0)
			{
				// Branch Node: Look for an existing submenu with the same name
				let subMenu = this._findSubMenuByLabel(targetMenu, item.name || '');
				if(!subMenu && menuSelf.commandRegistry)
				{
					subMenu = new Menu({ commands: menuSelf.commandRegistry });
					subMenu.title.label = item.name || '';
					subMenu.title.iconClass = item.iconClass || '';
					const addedItem = targetMenu.addItem({ type: 'submenu', submenu: subMenu }) as TrackedMenuItem;
					addedItem.ownerId = ownerId;
				}
				// Continue structural merge down the branch
				if(subMenu)
				{
					this._mergeMenuItems(ownerId, subMenu, item.children);
				}
			} else
			{
				const fallback = item.name?.toLowerCase().replace(/[^a-z0-9\/\.-_]/gi, '');
				const commandId = item.target ?? `${parentMenu ? parentMenu + '/' : ''}${fallback}.${fallback}`;
				if(commandId.length === 1) return;
				// Leaf Node: Check if this explicit command target is already in the specific menu node
				const commandExists = targetMenu.items.some(
					(existing) => existing.command === commandId
				);

				if(!commandExists)
				{
					const addedItem = targetMenu.addItem({ command: commandId }) as TrackedMenuItem;
					addedItem.ownerId = ownerId;
				}
			}
		});
	}

	/**
	 * Recursively purges tagged source elements from the inside out
	 */
	private static _pruneMenuTree(ownerId: string, menu: Menu): void
	{
		const items = menu.items as TrackedMenuItem[];

		// Process backward to preserve shifting indices during deletion loops
		for(let i = items.length - 1; i >= 0; i--)
		{
			const item = items[i];

			if(item.type === 'submenu' && item.submenu)
			{
				// Drill down to leaves first
				this._pruneMenuTree(ownerId, item.submenu);

				// Clean up empty submenus
				if(item.submenu.items.length === 0)
				{
					menu.removeItemAt(i);
				} else if(item.ownerId === ownerId)
				{
					// Orphan container ownership reset if child contents from other widgets remain
					delete item.ownerId;
				}
			} else if(item.ownerId === ownerId)
			{
				menu.removeItemAt(i);
			}
		}

		// Clean up leading/trailing or consecutive separators left behind by pruning
		this._cleanDanglingSeparators(menu);
	}

	private static _cleanDanglingSeparators(menu: Menu): void
	{
		const items = menu.items;
		if(items.length === 0) return;

		// Strip leading
		while(items.length > 0 && items[0].type === 'separator')
		{
			menu.removeItemAt(0);
		}
		// Strip trailing
		while(items.length > 0 && items[items.length - 1].type === 'separator')
		{
			menu.removeItemAt(items.length - 1);
		}
		// Strip consecutive internal duplicates
		for(let i = items.length - 1; i > 0; i--)
		{
			if(items[i].type === 'separator' && items[i - 1].type === 'separator')
			{
				menu.removeItemAt(i);
			}
		}
	}

	private static _findMenuBarMenuByLabel(label: string): Menu | null
	{
		return menuSelf.globalMenuBar?.menus.find((m) => m.title.label === label) || null;
	}

	public static _findSubMenuByLabel(parentMenu: Menu, label: string): Menu | null
	{
		const foundItem = parentMenu.items.find(
			(item) => item.type === 'submenu' && (item.submenu?.title.label === label
				|| item.submenu?.id === label
			)
		);
		return foundItem ? foundItem.submenu : null;
	}


	/**
	 * Registers script lifecycle commands into the central command registry.
	 */
	public static registerAllCommands(menuItems: MenuConfig[] | MenuConfig, commands?: CommandRegistry, parentMenu?: string | null): void
	{
		commands ??= menuSelf.commandRegistry;
		if(!(menuItems instanceof Array))
		{
			menuItems = [menuItems];
		}
		menuItems.forEach((item) =>
		{
			if(item.divider) return;

			// If it has children, walk into the sub-branch recursively
			if(item.children && item.children.length > 0)
			{
				MenuManager.registerAllCommands(item.children);
				return;
			}

			// Guard: Must have a functional target action link
			if(!item.target && !item.href) return;

			const fallback = item.name?.toLowerCase().replace(/[^a-z0-9\/\.-_]/gi, '');
			const commandId = item.target ?? `${parentMenu ? parentMenu + '/' : ''}${fallback}.${fallback}`;

			// Prevent double-registration artifacts
			if(menuSelf.commandRegistry?.hasCommand(commandId)) return;

			// Map standard text label decorators
			const labelStr = item.name + (item.ellipsis ? '...' : '');
			const mnemonicChar = item.shortcut ? item.shortcut.trim().split(/[\s+]+/).pop()!.toUpperCase() : '';

			menuSelf.commandRegistry?.addCommand(commandId, {
				label: labelStr,
				iconClass: item.iconClass,
				mnemonic: item.shortcut ? labelStr.indexOf(mnemonicChar) : -1,
				execute: () =>
				{
					if(item.target)
					{
						this.doAction(item.target, item);
					} else if(item.href)
					{
						window.open(item.href, '_blank');
					}
				}
			});

			if(item.shortcut)
			{
				const keybindingSequence = [item.shortcut.replace(/Ctrl/gi, 'Accel').replace(/Shift\s*\+\s*/gi, 'Shift ').replace(/\s*\+\s*/g, ' ')];
				if(keybindingSequence.length > 0)
				{
					menuSelf.commandRegistry?.addKeyBinding({
						command: commandId,
						keys: keybindingSequence,
						selector: '*'
					});
				}
			}
		});
	}


	public static doAction(target: string, object: MenuConfig): any
	{
		const parts = target.split('.');
		const module = parts[0];
		const function_name = parts[1];
		const param = object.parameter ??= undefined;
		let modules = (menuSelf.lastInteractedWidget as MenuModules)?.modules;
		//?? (menuSelf.previousInteractedWidget as MenuModules)?.modules;
		if(menuSelf.globalModules && menuSelf.globalModules[module]
			&& menuSelf.globalModules?.[module][function_name]
		)
		{
			modules = menuSelf.globalModules;
		}

		if(!modules)
		{
			console.warn(`Cannot execute command ${object.name} - ${object.target} - current component has no modules: ${menuSelf.lastInteractedWidget?.constructor.name}`);
			return;
		}

		if(modules[module] == undefined)
		{
			console.warn(`Cannot execute command ${object.name} - ${object.target} - module class not found: ${module}`);
			return;
		}
		if(modules[module][function_name] == undefined)
		{
			console.warn(`Cannot execute command ${object.name} - ${object.target} - module function not found: ${module}.${function_name}`);
			return;
		}
		return modules[module][function_name].apply(modules[module], [param, menuSelf.lastInteractedWidget]);
	}


}


menuSelf.injectMenus = MenuManager.injectMenus.bind(MenuManager);
menuSelf.removeMenus = MenuManager.removeMenus.bind(MenuManager);
menuSelf.registerAllCommands = MenuManager.registerAllCommands.bind(MenuManager);

