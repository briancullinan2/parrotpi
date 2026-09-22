import type { Terminal, IDecoration } from '@xterm/xterm';
import type { LuminoMenuWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { TerminalWindow } from './widget.d';


const renderSelf: LuminoMenuWindow & LuminoLayoutWindow & TerminalWindow = self as unknown as any;

export interface RenderFootprint
{
	startX: number;
	startY: number;
	width: number;
	height: number;
}

export interface BlueprintItem
{
	lineY: number;
	x: number;
	length: number;
	type: 'resize-t' | 'resize-b' | 'resize-l' | 'resize-r' | 'corner-tl' | 'corner-bl' | 'corner-tr' | 'corner-br';
}

export interface RenderState
{
	activeViewportDecorations: IDecoration[];
	renderMoved: boolean;
	targetStartX: number;
	targetStartY: number;
	renderWidth: number;
	renderHeight: number;
	lastRenderFootprint: RenderFootprint | null;
	previousTargetX: number;
	previousTargetY: number;
}

export const renderState: RenderState = {
	activeViewportDecorations: [],
	renderMoved: true,
	targetStartX: 0,
	targetStartY: 0,
	renderWidth: 0,
	renderHeight: 0,
	lastRenderFootprint: null,
	previousTargetX: 0,
	previousTargetY: 0
};

/**
 * Extract complete frame pixel matrices straight out of the GPU and map them to standard 24-bit Truecolor ANSI layout strings.
 */
export function captureFrameToAnsiExtended(
	gl: WebGLRenderingContext | WebGL2RenderingContext,
	cols: number,
	rows: number,
	scale: number = 1.0,
	offsetX: number = 0,
	offsetY: number = 0
): string
{
	const width = gl.drawingBufferWidth;
	const height = gl.drawingBufferHeight;
	const pixelBuffer = new Uint8Array(width * height * 4);

	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);

	let ansiOutput = "\x1b[H";

	const sampleWidth = width / scale;
	const sampleHeight = height / scale;

	for(let r = 0; r < rows; r++)
	{
		const subY = ((rows - 1 - r) / rows) * sampleHeight;
		const srcY = Math.floor(Math.max(0, Math.min(height - 1, subY + offsetY)));
		const yOffset = srcY * width * 4;

		for(let c = 0; c < cols; c++)
		{
			const subX = (c / cols) * sampleWidth;
			const srcX = Math.floor(Math.max(0, Math.min(width - 1, subX + offsetX)));
			const pixelIdx = yOffset + (srcX * 4);

			const red = pixelBuffer[pixelIdx];
			const green = pixelBuffer[pixelIdx + 1];
			const blue = pixelBuffer[pixelIdx + 2];

			ansiOutput += `\x1b[48;2;${red};${green};${blue}m `;
		}
		ansiOutput += "\x1b[0m\n";
	}

	return ansiOutput;
}

/**
 * Builds structured framework form dashboard objects using an abstract menu layout data stream.
 */
export function drawQuakeConfigDashboard(xtermInstance: Terminal): void
{
	const width = xtermInstance.cols || 80;
	xtermInstance.write("\x1b[H");

	//for(const [key, category] of Object.entries(quakeEngineMenuData))
	//{
	//	const renderedSectionBox = obThemeFormObject(key, category, width);
	//	xtermInstance.write(renderedSectionBox);
	//}
}

function getAvailableContext(canvas: HTMLCanvasElement, contextList: string[]): any
{
	if(canvas.getContext)
	{
		for(let i = 0; i < contextList.length; ++i)
		{
			try
			{
				let context = canvas.getContext(contextList[i], {
					antialias: false,
					alpha: false,
					xrCompatible: true
				});
				if(context !== null) return context;
			} catch(ex) { }
		}
	}
	return null;
}
/**
 * Executes a localized structural downsample loop, rendering textures into specific corners of a pooled xterm window layout grid.
 */
export async function captureRenderToTerminalCorner(term: Terminal): Promise<void>
{
	if(!term.element) return;

	await renderSelf.triggerPanelRoute?.('toji', renderSelf.mainDock);

	const viewport = document.getElementById("viewport") as HTMLCanvasElement;
	const gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);

	const coreService = (term as any)._core._renderService;
	const charSizeService = coreService._charSizeService;
	const windowViewCols = term.element.clientWidth / charSizeService.width;

	if(renderState.renderMoved && renderState.lastRenderFootprint)
	{
		let clearSequence = "\x1b[s";

		for(let i = 0; i < renderState.lastRenderFootprint.height; i++)
		{
			const row = renderState.lastRenderFootprint.startY + i + 1;
			const col = renderState.lastRenderFootprint.startX + 1;
			clearSequence += `\x1b[${row};${col}H${" ".repeat(renderState.lastRenderFootprint.width)}`;
		}

		clearSequence += "\x1b[u";
		term.write(clearSequence);
	}

	const ansiStringFrame = captureFrameToCornerAnsi(
		gl, renderState.renderWidth, renderState.renderHeight, renderState.targetStartX, renderState.targetStartY, 1.0, 0, 0
	);
	term.write(ansiStringFrame);

	renderState.lastRenderFootprint = {
		startX: renderState.targetStartX,
		startY: renderState.targetStartY,
		width: renderState.renderWidth,
		height: renderState.renderHeight
	};

	if(document.querySelector('#terminals a[href="#soft"].active') !== null)
	{
		//FrameRater.requestFrameUpdate();
	}

	if(renderState.renderMoved)
	{
		renderState.renderMoved = false;
		renderState.activeViewportDecorations.forEach(dec => dec.dispose());
		renderState.activeViewportDecorations = [];
		createViewportBorderDecorations(
			term,
			renderState.renderWidth,
			renderState.renderHeight,
			renderState.targetStartX,
			renderState.targetStartY,
			renderState.activeViewportDecorations
		);
	}
}

/**
 * Captures full-bleed frame buffers and outputs them directly across the active row boundaries.
 */
export async function captureRenderToTerminal(term: Terminal): Promise<void>
{
	await renderSelf.triggerPanelRoute?.('toji', renderSelf.mainDock);

	const viewport = document.getElementById("viewport") as HTMLCanvasElement;
	const gl = getAvailableContext(viewport, ['webgl2', 'webgl', 'experimental-webgl']);
	const cols = term.cols;
	const rows = term.rows - 2;

	const ansiStringFrame = captureFrameToAnsiExtended(gl, cols, rows);

	term.write("\x1b[H" + ansiStringFrame);
	if(document.querySelector('#terminals a[href="#soft"].active') !== null)
	{
		//cliRenderFrameLimiter.requestFrameUpdate();
	}
}

/**
 * High-fidelity luminance interpolation loop mapping pixel groups directly to an ASCII ramp library with local gama corrections.
 */
export function captureFrameToCornerAnsi(
	gl: WebGLRenderingContext | WebGL2RenderingContext,
	cols: number,
	rows: number,
	targetStartX: number = 0,
	targetStartY: number = 0,
	scale: number = 1.0,
	offsetX: number = 0,
	offsetY: number = 0
): string
{
	const width = gl.drawingBufferWidth;
	const height = gl.drawingBufferHeight;
	const pixelBuffer = new Uint8Array(width * height * 4);

	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);

	let ansiOutput = "\x1b[s";

	const sampleWidth = width / scale;
	const sampleHeight = height / scale;

	const startXInt = Math.floor(targetStartX) + 1;
	const startYInt = Math.floor(targetStartY);

	const asciiRamp = " .:-=+*#%@";
	const rampLength = asciiRamp.length;
	const gamma = 0.55;

	for(let r = 0; r < rows; r++)
	{
		const destinationLine = startYInt + r + 1;
		ansiOutput += `\x1b[${destinationLine};${startXInt}H`;

		const subY = ((rows - 1 - r) / rows) * sampleHeight;
		const srcY = Math.floor(Math.max(0, Math.min(height - 1, subY + offsetY)));
		const yOffset = srcY * width * 4;

		for(let c = 0; c < cols; c++)
		{
			const subX = (c / cols) * sampleWidth;
			const srcX = Math.floor(Math.max(0, Math.min(width - 1, subX + offsetX)));
			const pixelIdx = yOffset + (srcX * 4);

			const red = pixelBuffer[pixelIdx];
			const green = pixelBuffer[pixelIdx + 1];
			const blue = pixelBuffer[pixelIdx + 2];

			const rawLuminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
			const normalizedLumi = rawLuminance / 255;
			const stretchedLumi = Math.pow(normalizedLumi, gamma);

			const rampIndex = Math.floor(stretchedLumi * (rampLength - 1));
			const asciiChar = asciiRamp[rampIndex];

			let textR: number, textG: number, textB: number;
			if(rawLuminance < 110)
			{
				textR = Math.min(255, Math.floor(red * 2.0) + 40);
				textG = Math.min(255, Math.floor(green * 2.0) + 40);
				textB = Math.min(255, Math.floor(blue * 2.0) + 40);
			} else
			{
				textR = Math.floor(red * 0.25);
				textG = Math.floor(green * 0.25);
				textB = Math.floor(blue * 0.25);
			}

			ansiOutput += `\x1b[48;2;${red};${green};${blue}m\x1b[38;2;${textR};${textG};${textB}m${asciiChar}`;
		}
		ansiOutput += "\x1b[0m";
	}

	ansiOutput += "\x1b[u";
	return ansiOutput;
}

/**
 * Creates and registers layout coordinate points using xterm's native decoration overlay hierarchy trees.
 */
export function createViewportBorderDecorations(
	terminalInstance: Terminal,
	cols: number,
	rows: number,
	targetStartX: number,
	targetStartY: number,
	storageArray: IDecoration[] = []
): void
{
	const startXInt = Math.floor(targetStartX);
	const startYInt = Math.floor(targetStartY);

	const absoluteCursorRow = terminalInstance.buffer.active.baseY + terminalInstance.buffer.active.cursorY;
	const frameBlueprints: BlueprintItem[] = [];

	const topRow = startYInt;
	const bottomRow = startYInt + rows - 1;

	frameBlueprints.push({ lineY: topRow, x: startXInt, length: 1, type: 'corner-tl' });
	frameBlueprints.push({ lineY: bottomRow, x: startXInt, length: 1, type: 'corner-bl' });
	frameBlueprints.push({ lineY: topRow, x: startXInt + cols - 1, length: 1, type: 'corner-tr' });
	frameBlueprints.push({ lineY: bottomRow, x: startXInt + cols - 1, length: 1, type: 'corner-br' });

	for(let r = 1; r < cols - 1; r++)
	{
		frameBlueprints.push({ lineY: topRow, x: startXInt + r, length: 1, type: 'resize-t' });
		frameBlueprints.push({ lineY: bottomRow, x: startXInt + r, length: 1, type: 'resize-b' });
	}

	for(let r = 1; r < rows - 1; r++)
	{
		const currentLineY = startYInt + r;
		frameBlueprints.push({ lineY: currentLineY, x: startXInt, length: 1, type: 'resize-l' });
		frameBlueprints.push({ lineY: currentLineY, x: startXInt + cols - 1, length: 1, type: 'resize-r' });
	}

	frameBlueprints.forEach(bp =>
	{
		const relativeMarkerDistance = Math.max(-absoluteCursorRow, bp.lineY - absoluteCursorRow);
		const marker = terminalInstance.registerMarker(relativeMarkerDistance);

		if(marker)
		{
			const decoration = terminalInstance.registerDecoration({
				marker,
				x: bp.x,
				width: bp.length,
				layer: 'top'
			});

			if(decoration)
			{
				decoration.onRender(element =>
				{
					element.style.pointerEvents = 'auto';
					element.className = '';

					if(bp.length > 1)
					{
						element.style.display = 'block';
						element.style.height = '100%';
						element.style.minHeight = '10px';
					}

					if(bp.type === 'resize-l')
					{
						element.classList.add('terminal-box-resize-l');
					} else if(bp.type === 'resize-r')
					{
						element.classList.add('terminal-box-resize-r');
					} else if(bp.type === 'resize-t')
					{
						element.classList.add('terminal-box-resize-t');
					} else if(bp.type === 'resize-b')
					{
						element.classList.add('terminal-box-resize-b');
					} else if(bp.type.startsWith('corner-'))
					{
						element.classList.add('terminal-box-corner', `terminal-box-${bp.type}`);
					}
				});

				storageArray.push(decoration);
			}
		}
	});
}

// --- DOM Event Bindings ---
export function terminalClickEvent(term: Terminal)
{
	if(!term.element) return;

	const softActive = document.querySelector('#terminals a[href="#soft"].active') !== null;
	if(softActive && (window as any).isModifierPressed && typeof term.element.requestPointerLock === 'function')
	{
		term.element.requestPointerLock();
	}
	renderSelf.TerminalEventManager?.refreshBlinkerState(term);
}

export function terminalDblClickEvent(term: Terminal, event: MouseEvent)
{
	if(!term.element) return;


	const softActive = document.querySelector('#terminals a[href="#soft"].active') !== null;
	if(!softActive) return;

	const rect = term.element.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;

	const coreService = (term as any)._core._renderService;
	const dims = coreService.dimensions.css.cell;

	const col = Math.floor(x / dims.width);
	const row = Math.floor(y / dims.height) + term.buffer.active.viewportY;
	const viewport = document.getElementById("viewport");

	if(viewport && col >= renderState.targetStartX && col <= renderState.targetStartX + renderState.renderWidth &&
		row >= renderState.targetStartY && row <= renderState.targetStartY + renderState.renderHeight
	)
	{
		if(renderState.targetStartX === 0 && renderState.targetStartY === 0)
		{
			renderState.targetStartX = renderState.previousTargetX;
			renderState.targetStartY = renderState.previousTargetY;
			renderState.renderHeight = Math.floor(term.rows / 2);
			const canvasAspect = viewport.clientWidth / viewport.clientHeight;
			renderState.renderWidth = Math.floor(renderState.renderHeight * canvasAspect * 2);
			term.reset();
		} else
		{
			renderState.previousTargetX = renderState.targetStartX;
			renderState.previousTargetY = renderState.targetStartY;
			renderState.targetStartX = 0;
			renderState.targetStartY = 0;
			renderState.renderHeight = Math.floor(term.rows - 1);
			const windowViewCols = term.element.clientWidth / coreService._charSizeService.width;
			renderState.renderWidth = windowViewCols;
		}
		renderState.renderMoved = true;
		setTimeout(() =>
		{
			term.reset();
			renderState.renderMoved = true;
		}, 200);
	}
}


