// save-dialog.ts

export interface FileSystemNode
{
	name: string;
	type: 'file' | 'folder';
	children?: FileSystemNode[];
}

export interface SaveDialogResult
{
	path: string;
	filename: string;
	fileType: string;
}

export class GitHubSaveFileDialog
{
	private overlayElement: HTMLDivElement | null = null;
	private currentPath: string[] = ['root'];
	private historyStack: string[][] = [];
	private historyIndex: number = 0;
	private selectedFileName: string = 'Untitled.ts';
	private selectedFileType: string = '.ts';
	private resolvePromise: ((value: SaveDialogResult | null) => void) | null = null;

	private fileTree: FileSystemNode = {
		name: 'root',
		type: 'folder',
		children: [
			{
				name: 'src',
				type: 'folder',
				children: [
					{
						name: 'components',
						type: 'folder',
						children: [
							{ name: 'Button.tsx', type: 'file' },
							{ name: 'Dialog.tsx', type: 'file' }
						]
					},
					{ name: 'index.ts', type: 'file' },
					{ name: 'styles.css', type: 'file' }
				]
			},
			{
				name: 'public',
				type: 'folder',
				children: [
					{ name: 'favicon.ico', type: 'file' },
					{ name: 'index.html', type: 'file' }
				]
			},
			{ name: 'package.json', type: 'file' },
			{ name: 'README.md', type: 'file' },
			{ name: 'tsconfig.json', type: 'file' }
		]
	};

	constructor(initialData?: FileSystemNode)
	{
		if(initialData)
		{
			this.fileTree = initialData;
		}
		this.historyStack = [[...this.currentPath]];
	}

	public open(defaultName: string = 'Untitled.ts'): Promise<SaveDialogResult | null>
	{
		this.selectedFileName = defaultName;
		return new Promise((resolve) =>
		{
			this.resolvePromise = resolve;
			this.render();
		});
	}

	public close(result: SaveDialogResult | null = null): void
	{
		if(this.overlayElement)
		{
			this.overlayElement.remove();
			this.overlayElement = null;
		}
		if(this.resolvePromise)
		{
			this.resolvePromise(result);
			this.resolvePromise = null;
		}
	}

	private getNodeAtPath(path: string[]): FileSystemNode | null
	{
		let current: FileSystemNode = this.fileTree;
		for(let i = 1; i < path.length; i++)
		{
			if(!current.children) return null;
			const found = current.children.find((c) => c.name === path[i]);
			if(!found) return null;
			current = found;
		}
		return current;
	}

	private navigateTo(path: string[], recordHistory: boolean = true): void
	{
		this.currentPath = [...path];
		if(recordHistory)
		{
			this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
			this.historyStack.push([...this.currentPath]);
			this.historyIndex = this.historyStack.length - 1;
		}
		this.updateUI();
	}

	private navigateBack(): void
	{
		if(this.historyIndex > 0)
		{
			this.historyIndex--;
			this.navigateTo(this.historyStack[this.historyIndex], false);
		}
	}

	private navigateForward(): void
	{
		if(this.historyIndex < this.historyStack.length - 1)
		{
			this.historyIndex++;
			this.navigateTo(this.historyStack[this.historyIndex], false);
		}
	}

	private render(): void
	{
		this.overlayElement = document.querySelector('#popups') ?? document.createElement('div');
		if(this.overlayElement.id !== 'popups')
		{
			this.overlayElement.className = 'sfd-overlay';
		}

		const dialog = document.createElement('div');
		dialog.className = 'sfd-dialog';

		// Header Toolbar
		const header = document.createElement('div');
		header.className = 'sfd-header';

		const navButtons = document.createElement('div');
		navButtons.className = 'sfd-nav-buttons';

		const backBtn = document.createElement('button');
		backBtn.className = 'sfd-btn-icon sfd-btn-back';
		backBtn.innerHTML = "<i class='bx bx-chevron-left'></i>";
		backBtn.onclick = () => this.navigateBack();

		const forwardBtn = document.createElement('button');
		forwardBtn.className = 'sfd-btn-icon sfd-btn-forward';
		forwardBtn.innerHTML = "<i class='bx bx-chevron-right'></i>";
		forwardBtn.onclick = () => this.navigateForward();

		navButtons.appendChild(backBtn);
		navButtons.appendChild(forwardBtn);

		const addressBar = document.createElement('div');
		addressBar.className = 'sfd-address-bar';

		const searchBox = document.createElement('div');
		searchBox.className = 'sfd-search-box';
		searchBox.innerHTML = "<i class='bx bx-search'></i><input type='text' placeholder='Search...' />";

		header.appendChild(navButtons);
		header.appendChild(addressBar);
		header.appendChild(searchBox);

		// Body
		const body = document.createElement('div');
		body.className = 'sfd-body';

		// Sidebar
		const sidebar = document.createElement('div');
		sidebar.className = 'sfd-sidebar';
		sidebar.innerHTML = `
      <div class="sfd-sidebar-section">
        <div class="sfd-sidebar-title">GitHub Repo</div>
        <div class="sfd-sidebar-item active" data-path="root">
          <i class='bx bx-git-branch'></i> main branch
        </div>
      </div>
      <div class="sfd-sidebar-section">
        <div class="sfd-sidebar-title">Favorites</div>
        <div class="sfd-sidebar-item" data-path="root/src">
          <i class='bx bx-folder'></i> src
        </div>
        <div class="sfd-sidebar-item" data-path="root/public">
          <i class='bx bx-folder'></i> public
        </div>
      </div>
    `;

		sidebar.querySelectorAll('.sfd-sidebar-item').forEach((item) =>
		{
			item.addEventListener('click', (e) =>
			{
				const pathAttr = (e.currentTarget as HTMLElement).getAttribute('data-path');
				if(pathAttr)
				{
					this.navigateTo(pathAttr.split('/'));
				}
			});
		});

		const columnsContainer = document.createElement('div');
		columnsContainer.className = 'sfd-columns-container';

		body.appendChild(sidebar);
		body.appendChild(columnsContainer);

		// Footer
		const footer = document.createElement('div');
		footer.className = 'sfd-footer';

		const fileRow = document.createElement('div');
		fileRow.className = 'sfd-field-row';
		const fileLabel = document.createElement('label');
		fileLabel.className = 'sfd-field-label';
		fileLabel.textContent = 'Save As:';
		const fileInput = document.createElement('input');
		fileInput.type = 'text';
		fileInput.className = 'sfd-input-text';
		fileInput.value = this.selectedFileName;
		fileInput.oninput = (e) =>
		{
			this.selectedFileName = (e.target as HTMLInputElement).value;
		};
		fileRow.appendChild(fileLabel);
		fileRow.appendChild(fileInput);

		const typeRow = document.createElement('div');
		typeRow.className = 'sfd-field-row';
		const typeLabel = document.createElement('label');
		typeLabel.className = 'sfd-field-label';
		typeLabel.textContent = 'Format:';
		const typeSelect = document.createElement('select');
		typeSelect.className = 'sfd-select';
		typeSelect.innerHTML = `
      <option value=".ts">TypeScript Source (*.ts)</option>
      <option value=".tsx">TypeScript JSX (*.tsx)</option>
      <option value=".json">JSON Configuration (*.json)</option>
      <option value="*">All Files (*)</option>
    `;
		typeSelect.onchange = (e) =>
		{
			this.selectedFileType = (e.target as HTMLSelectElement).value;
		};
		typeRow.appendChild(typeLabel);
		typeRow.appendChild(typeSelect);

		const actionsRow = document.createElement('div');
		actionsRow.className = 'sfd-actions-row';

		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'sfd-btn sfd-btn-secondary';
		cancelBtn.textContent = 'Cancel';
		cancelBtn.onclick = () => this.close(null);

		const saveBtn = document.createElement('button');
		saveBtn.className = 'sfd-btn sfd-btn-primary';
		saveBtn.textContent = 'Save';
		saveBtn.onclick = () =>
		{
			this.close({
				path: '/' + this.currentPath.slice(1).join('/'),
				filename: this.selectedFileName,
				fileType: this.selectedFileType
			});
		};

		actionsRow.appendChild(cancelBtn);
		actionsRow.appendChild(saveBtn);

		footer.appendChild(fileRow);
		footer.appendChild(typeRow);
		footer.appendChild(actionsRow);

		dialog.appendChild(header);
		dialog.appendChild(body);
		dialog.appendChild(footer);

		this.overlayElement.appendChild(dialog);
		document.body.appendChild(this.overlayElement);

		this.updateUI();
	}

	private updateUI(): void
	{
		if(!this.overlayElement) return;

		// Update Nav Buttons
		const backBtn = this.overlayElement.querySelector('.sfd-btn-back') as HTMLButtonElement;
		const forwardBtn = this.overlayElement.querySelector('.sfd-btn-forward') as HTMLButtonElement;

		if(backBtn) backBtn.disabled = this.historyIndex <= 0;
		if(forwardBtn) forwardBtn.disabled = this.historyIndex >= this.historyStack.length - 1;

		// Update Address Bar Breadcrumb
		const addressBar = this.overlayElement.querySelector('.sfd-address-bar');
		if(addressBar)
		{
			addressBar.innerHTML = '';
			this.currentPath.forEach((segment, index) =>
			{
				const item = document.createElement('span');
				item.className = 'sfd-breadcrumb-item';
				item.textContent = segment === 'root' ? 'repository' : segment;
				item.onclick = () =>
				{
					this.navigateTo(this.currentPath.slice(0, index + 1));
				};
				addressBar.appendChild(item);

				if(index < this.currentPath.length - 1)
				{
					const sep = document.createElement('span');
					sep.className = 'sfd-breadcrumb-sep';
					sep.innerHTML = "<i class='bx bx-chevron-right'></i>";
					addressBar.appendChild(sep);
				}
			});
		}

		// Render Columns
		const columnsContainer = this.overlayElement.querySelector('.sfd-columns-container');
		if(columnsContainer)
		{
			columnsContainer.innerHTML = '';

			let currentPathCursor: string[] = ['root'];
			for(let depth = 0; depth < this.currentPath.length; depth++)
			{
				const targetNode = this.getNodeAtPath(currentPathCursor);
				if(!targetNode || targetNode.type !== 'folder' || !targetNode.children) break;

				const column = document.createElement('div');
				column.className = 'sfd-column';

				const nextSelectedSegment = this.currentPath[depth + 1];

				targetNode.children.forEach((child) =>
				{
					const colItem = document.createElement('div');
					const isSelected = child.name === nextSelectedSegment;
					colItem.className = `sfd-column-item ${isSelected ? 'selected' : ''}`;

					const left = document.createElement('div');
					left.className = 'sfd-column-item-left';

					const iconClass = child.type === 'folder' ? 'bx-folder' : 'bx-file';
					left.innerHTML = `<i class='bx ${iconClass} type-icon'></i><span>${child.name}</span>`;

					colItem.appendChild(left);

					if(child.type === 'folder')
					{
						const arrow = document.createElement('i');
						arrow.className = 'bx bx-chevron-right arrow-icon';
						colItem.appendChild(arrow);
					}

					colItem.onclick = () =>
					{
						const newPath = currentPathCursor.concat(child.name);
						if(child.type === 'folder')
						{
							this.navigateTo(newPath);
						} else
						{
							this.selectedFileName = child.name;
							const fileInput = this.overlayElement?.querySelector('.sfd-input-text') as HTMLInputElement;
							if(fileInput) fileInput.value = child.name;
						}
					};

					column.appendChild(colItem);
				});

				columnsContainer.appendChild(column);

				if(nextSelectedSegment)
				{
					currentPathCursor.push(nextSelectedSegment);
				}
			}

			// Auto scroll right as columns stack up
			columnsContainer.scrollLeft = columnsContainer.scrollWidth;
		}
	}
}

