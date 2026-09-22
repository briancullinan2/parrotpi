import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import type { GlobalToolbarsWindow } from "./menu.d";

const menuSelf: GlobalToolbarsWindow = self as unknown as any;

export class RepositoryToolbar extends Widget
{
	private static _instance: RepositoryToolbar | null = null;
	private _commands: CommandRegistry | null = null;

	private constructor()
	{
		super();
		this.id = 'repository-inline-toolbar';
		this._buildInterface();
	}

	public static getInstance(): RepositoryToolbar
	{
		if(!RepositoryToolbar._instance)
		{
			RepositoryToolbar._instance = new RepositoryToolbar();
			menuSelf.repositoryToolbar = RepositoryToolbar._instance;
		}
		return RepositoryToolbar._instance;
	}

	public initialize(commands: CommandRegistry): RepositoryToolbar
	{
		this._commands = commands;
		return this;
	}

	private _registerCommands()
	{
		if(!this._commands)
		{
			return;
		}
		if(!this._commands.hasCommand('change-repo'))
		{
			this._commands.addCommand('change-repo', {
				label: 'Change Repository',
				iconClass: 'bx bx-database',
				execute: () =>
				{
					const ownerSelect = RepositoryToolbar.owner;
					const repoSelect = RepositoryToolbar.repository;
					console.log(`Changing repository targets: ${ownerSelect?.value}/${repoSelect?.value}`);
				}
			});
		}

		if(!this._commands.hasCommand('change-owner'))
		{
			this._commands.addCommand('change-owner', {
				label: 'Change Owner',
				iconClass: 'bx bx-cloud',
				execute: () =>
				{
					const ownerSelect = RepositoryToolbar.owner;
					const repoSelect = RepositoryToolbar.repository;
					console.log(`Changing owner targets: ${ownerSelect?.value}/${repoSelect?.value}`);
				}
			});
		}
	}
	private _buildInterface(): void
	{
		this.node.innerHTML = `
            <label for="top-bar-sel-owner">Owner:</label>
            <select id="top-bar-sel-owner" placeholder="Repository Owner">
                <option value="org-1">Organization One</option>
                <option value="org-2">Organization Two</option>
            </select>
            <label for="top-bar-sel-repo">Repo:</label>
            <select id="top-bar-sel-repo" placeholder="Current Repository">
                <option value="repo-a">Repository A</option>
                <option value="repo-b">Repository B</option>
            </select>
			<select required id="top-bar-sel-branch" placeholder="Selected Branch">
				<option value="" selected disabled>Current Branch</option>
				<option value="main">main</option>
			</select>
			<select required id="top-bar-sel-locations" placeholder="Local File System">
				<option value="" selected disabled>Local Folders</option>
			</select>
        `;

		this.node.querySelector('#top-bar-sel-owner')?.addEventListener('change', () =>
		{
			if(this._commands)
			{
				this._commands.execute('change-owner');
			}
		});

		this.node.querySelector('#top-bar-sel-repo')?.addEventListener('change', () =>
		{
			if(this._commands)
			{
				this._commands.execute('change-repo');
			}
		});
	}

	public static get owner(): HTMLSelectElement | null
	{
		return RepositoryToolbar.getInstance().node.querySelector('#top-bar-sel-owner');
	}

	public static get repository(): HTMLSelectElement | null
	{
		return RepositoryToolbar.getInstance().node.querySelector('#top-bar-sel-repo');
	}

	public static get branch(): HTMLSelectElement | null
	{
		return RepositoryToolbar.getInstance().node.querySelector('#top-bar-sel-branch');
	}

	public static get locations(): HTMLSelectElement | null
	{
		return RepositoryToolbar.getInstance().node.querySelector('#top-bar-sel-locations');
	}
}

menuSelf.RepositoryToolbar = RepositoryToolbar;
