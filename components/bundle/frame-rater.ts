

/**
 * FrameCallback defines the signature for processing batched ticks.
 */
export type FrameCallback<T = any | undefined> = (data: T | undefined, elapsed: number, frameCount: number) => void;

/**
 * FrameRater limits and batches update calls targeting a maximum frame rate.
 * Implemented as an ES6 Singleton with a static entry point.
 *
 * @class FrameRater
 */
export class FrameRater<T = any>
{
	// Static private instance container reference holding the Singleton state

	private callback!: FrameCallback<T> | null;
	private startTime!: number;
	private frameCount!: number;
	public eventStack!: (T | undefined)[];
	private isFlushing!: boolean;
	private intervalId!: ReturnType<typeof setInterval> | null;

	/**
	 * Public static entry point to push events onto the frame processor loop stack.
	 * Accessible globally via FrameRater.requestFrameUpdate(data);
	 *
	 * @static
	 * @method requestFrameUpdate
	 * @param {T} data Data payload or event object to pass down to the frame processing callback.
	 */
	public requestFrameUpdate(data?: T | undefined): void
	{
		this.push(data);
	}

	constructor(targetFps: number = 60, callback: FrameCallback<T> | null = null)
	{
		this.callback = callback;
		this.startTime = performance.now();
		this.frameCount = 0;
		this.eventStack = [];
		this.isFlushing = false;
		this.intervalId = null;

		this.setTargetFps(targetFps);
	}

	/**
	 * Changes the maximum target frame rate and re-initializes the internal processing heartbeat interval loop.
	 *
	 * @method setTargetFps
	 * @param {number} targetFps New target frame rate.
	 */
	setTargetFps(targetFps: number): void
	{
		this.stop();

		const fpsInterval = 1000 / targetFps;

		if(this.intervalId)
		{
			clearInterval(this.intervalId);
		}

		this.intervalId = setInterval(() =>
		{
			// Only trigger if items are waiting AND we aren't currently inside a paint cycle
			if(this.eventStack.length > 0 && !this.isFlushing)
			{

				// Shallow copy and clear the stack immediately
				const currentBatch = [...this.eventStack];
				this.eventStack.length = 0;

				requestAnimationFrame((paintTime: number) =>
				{
					this.isFlushing = true; // Lock out the interval thread during execution

					this.frameCount++;
					const t = paintTime - this.startTime;

					try
					{
						if(typeof this.callback === "function")
						{
							// Drain the batch execution. Isolate each callback so a single throw can't drop the rest of the batch.
							for(let i = 0; i < currentBatch.length; i++)
							{
								try
								{
									this.callback(currentBatch[i], t, this.frameCount);
								}
								catch(e)
								{
									console.error("frame callback failed", e);
								}
							}
						}
					}
					finally
					{
						// Always release the lock, even if a callback throws, so the limiter can never freeze permanently.
						this.isFlushing = false;
					}
				});
			}
		}, fpsInterval);
	}

	/**
	 * Sets or overrides the active application update callback wrapper function method.
	 *
	 * @method setCallback
	 * @param {FrameCallback<T>} callback Handler processing batched ticks.
	 */
	setCallback(callback: FrameCallback<T>): void
	{
		this.callback = callback;
	}

	/**
	 * Internal container context mapping function method to push items into processing array tracking lists.
	 *
	 * @method push
	 * @param {T} data
	 */
	push(data?: T | undefined): void
	{
		this.eventStack.push(data);
	}

	/**
	 * Clears the current active heartbeat interval.
	 *
	 * @method stop
	 */
	stop(): void
	{
		if(this.intervalId !== null)
		{
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Fully tears down the instance container reference layout parameters context properties.
	 *
	 * @method destroy
	 */
	destroy(): void
	{
		this.stop();
		this.eventStack.length = 0;
	}
}
