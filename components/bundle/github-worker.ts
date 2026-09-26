
import type { GlobalToolbarsWindow } from "./menu.d";


const githubSelf: GlobalToolbarsWindow = self as unknown as any;


export interface StagingStatusPayload
{
	owner?: string;
	repo?: string;
	status?: string;
	modified?: string[];
	added?: string[];
	staged?: string[];
	[key: string]: any;
}

export interface GithubTransactionState
{
	callbackId: string;
	onProgress?: (results: StagingStatusPayload) => void;
	resolve?: (results: StagingStatusPayload) => void;
	reject?: (error: Error) => void;
	target?: HTMLElement;
	folderId?: string;
}

export class GithubService
{
	private static instance: GithubService;
	private worker?: Worker;
	private activeTransactions: Map<string, GithubTransactionState> = new Map();

	private constructor()
	{
		if(GithubService.instance)
		{
			return GithubService.instance;
		}
		this.worker = new Worker('/components/workers/commit-worker.js', { type: 'module' });
		this.worker.onmessage = this.handleWorkerMessage.bind(this);
	}

	public static getInstance(): GithubService
	{
		if(!GithubService.instance)
		{
			GithubService.instance = new GithubService();
		}
		return GithubService.instance;
	}

	/**
	 * Queues worker commands and attaches ID tracking for piecewise/streaming updates and resolution promises.
	 */
	public executeCommand<T extends StagingStatusPayload = StagingStatusPayload>(
		payload: Record<string, any>,
		meta?: { target?: HTMLElement; folderId?: string; },
		onProgress?: (results: T) => void
	): Promise<T>
	{
		return new Promise<T>((resolve, reject) =>
		{
			const callbackId = `gh_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

			const state: GithubTransactionState = {
				callbackId,
				resolve: resolve as (results: StagingStatusPayload) => void,
				reject,
				onProgress: onProgress as ((results: StagingStatusPayload) => void) | undefined,
				target: meta?.target,
				folderId: meta?.folderId
			};

			this.activeTransactions.set(callbackId, state);

			this.worker?.postMessage({
				...payload,
				callbackId
			});
		});
	}

	/**
	 * Looks up an active transaction by ID if explicit callback access is needed.
	 */
	public getTransaction(callbackId: string): GithubTransactionState | undefined
	{
		return this.activeTransactions.get(callbackId);
	}

	/**
	 * Centralized message dispatcher matching incoming callbackId responses with queued state.
	 */
	private handleWorkerMessage(e: MessageEvent): void
	{
		const { type, status, callbackId, isPartial, error } = e.data;
		if(!callbackId) return;

		const transaction = this.activeTransactions.get(callbackId);
		if(!transaction) return;

		if(status === 'ERROR' || error)
		{
			if(transaction.reject)
			{
				transaction.reject(new Error(error || 'Worker staging execution failed.'));
			}
			this.activeTransactions.delete(callbackId);
			return;
		}

		// Piecewise streaming update (e.g., large upload sets)
		if(isPartial)
		{
			if(transaction.onProgress)
			{
				transaction.onProgress(e.data);
			}
			return;
		}

		// Final resolution
		if(transaction.onProgress)
		{
			transaction.onProgress(e.data);
		}

		if(transaction.resolve)
		{
			transaction.resolve(e.data);
		}

		this.activeTransactions.delete(callbackId);
	}

	public terminate(): void
	{
		this.worker?.terminate();
		this.activeTransactions.clear();
	}
}

export const githubService = GithubService.getInstance();
githubSelf.GithubService = GithubService;
githubSelf.githubService = githubService;

