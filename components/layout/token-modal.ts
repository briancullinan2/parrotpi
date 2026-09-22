import { ApiWindow } from '../bundle/worker.d';

export const GITHUB_LINK = 'https://github.com/settings/tokens?type=beta';


const modalSelf: ApiWindow = self as unknown as any;

export class TokenModal
{
	private container: HTMLElement | null = null;
	private modal: HTMLDivElement | null = null;
	private tokenInput: HTMLInputElement | null = null;
	private tokenForm: HTMLFormElement | null = null;
	static _instance: TokenModal;

	static getInstance()
	{
		if(this._instance)
		{
			return this._instance;
		}
		return new TokenModal();
	}

	constructor()
	{
		if(TokenModal._instance)
		{
			return TokenModal._instance;
		}
		this.container = document.getElementById('popups');
		if(!this.container)
		{
			console.error('Target container #popups not found.');
			return;
		}
		this.render();
		this.initElements();
		this.bindEvents();
		TokenModal._instance = this;
	}

	private render(): void
	{
		this.modal = document.createElement('div');
		this.modal.id = 'token-modal';
		this.modal.className = 'hidden';

		const modalContent = document.createElement('div');
		modalContent.className = 'popup modal-content';

		this.tokenForm = document.createElement('form');
		this.tokenForm.id = 'token-form';
		this.tokenForm.action = '#';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'close-btn bx bx-x';
		closeBtn.type = 'button';

		const heading = document.createElement('h3');
		heading.textContent = 'GitHub Access Token';

		const paragraph = document.createElement('p');
		paragraph.textContent = 'Required for API access';
		paragraph.appendChild(document.createElement('br'));

		const link = document.createElement('a');
		link.id = 'github-login';
		link.setAttribute('alt', 'Github login');
		link.target = '_blank';
		link.href = GITHUB_LINK;

		const icon = document.createElement('i');
		icon.className = 'bx bx-key';
		link.appendChild(icon);
		link.appendChild(document.createTextNode('Create a Github Token'));
		paragraph.appendChild(link);

		const inputWrapper = document.createElement('div');
		inputWrapper.setAttribute('placeholder', 'Enter ghp your token here...');

		this.tokenInput = document.createElement('input');
		this.tokenInput.placeholder = 'Enter ghp your token here...';
		this.tokenInput.type = 'password';
		this.tokenInput.id = 'gh-token-input';
		this.tokenInput.name = 'gh-token-input';
		this.tokenInput.autocomplete = 'one-time-code';
		inputWrapper.appendChild(this.tokenInput);

		const actionsWrapper = document.createElement('div');
		actionsWrapper.className = 'actions';

		const saveBtn = document.createElement('button');
		saveBtn.className = 'save-token';
		saveBtn.type = 'button';
		saveBtn.textContent = 'Save Token';

		const clearBtn = document.createElement('button');
		clearBtn.className = 'clear-token danger';
		clearBtn.type = 'button';
		clearBtn.textContent = 'Clear';

		actionsWrapper.appendChild(saveBtn);
		actionsWrapper.appendChild(clearBtn);

		this.tokenForm.appendChild(closeBtn);
		this.tokenForm.appendChild(heading);
		this.tokenForm.appendChild(paragraph);
		this.tokenForm.appendChild(inputWrapper);
		this.tokenForm.appendChild(actionsWrapper);

		modalContent.appendChild(this.tokenForm);
		this.modal.appendChild(modalContent);
		this.container?.appendChild(this.modal);
	}

	private initElements(): void
	{
		// Assertions used to ensure variables match references created during rendering
		if(!this.modal || !this.tokenForm || !this.tokenInput)
		{
			throw new Error('Failed to initialize DOM components.');
		}
	}

	private bindEvents(): void
	{
		if(!this.tokenForm || !this.modal) return;

		this.tokenForm.addEventListener('submit', this.handleFormSubmit);
		this.modal.addEventListener('click', this.handleModalClick);
	}

	private handleFormSubmit = (e: Event): boolean =>
	{
		e.stopPropagation();
		e.preventDefault();
		this.saveToken();
		return false;
	};

	private handleModalClick = (e: Event): boolean =>
	{
		e.stopPropagation();
		e.preventDefault();

		const target = e.target as HTMLElement;
		if(!this.modal) return false;

		if(target.classList.contains('save-token'))
		{
			this.saveToken();
		} else if(target.classList.contains('clear-token'))
		{
			this.clearToken();
		} else if(target.classList.contains('close-btn'))
		{
			this.modal.classList.add('hidden');
			this.container?.removeChild(this.modal);
		}

		return false;
	};

	public updatePlaceholder(): void
	{
		if(!this.tokenInput || !this.modal) return;

		const globalApiToken = modalSelf.api?.github_token;
		const token = globalApiToken && globalApiToken.length > 0
			? globalApiToken
			: localStorage.getItem('github_token');

		if(token)
		{
			const masked = token.substring(0, 4) + '•'.repeat(12);
			this.tokenInput.placeholder = `Currently set: ${masked}`;
			this.tokenInput.classList.add('has-token');
		} else
		{
			this.tokenInput.placeholder = 'Enter ghp your token here...';
			this.tokenInput.classList.remove('has-token');
		}

		setTimeout(() =>
		{
			if(this.modal)
				this.container?.appendChild(this.modal);
			this.modal?.classList.remove('hidden');
		}, 200);
	}

	public saveToken(): void
	{
		if(!this.tokenInput || !this.modal) return;

		const tokenValue = this.tokenInput.value.trim();
		localStorage.setItem('github_token', tokenValue);

		this.tokenInput.value = '';
		alert('Token saved to local storage.');
		setTimeout(() =>
		{
			if(this.modal)
				this.container?.removeChild(this.modal);
			this.modal?.classList.add('hidden');
		}, 200);
	}

	public clearToken(): void
	{
		localStorage.removeItem('github_token');
		this.updatePlaceholder();
	}
}

