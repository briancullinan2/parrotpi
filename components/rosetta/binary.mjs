
import './rosetta.js';

export const hasSequentialBinaryRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]{3,}/;

/**
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number[]} pattern
 * @returns {boolean}
 */
export function checkMagic(bytes, offset, pattern)
{
	if(bytes.length < offset + pattern.length) return false;
	return pattern.every((byte, i) => bytes[offset + i] === byte);
};


/**
 * @type {Record<string, {description: string, match: (b: Uint8Array) => boolean}>}
 */
export const BINARY_DETECTOR = {
	wasm: {
		description: "WebAssembly Binary / LLVM Wasm Object File",
		match: (b) => checkMagic(b, 0, [0x00, 0x61, 0x73, 0x6D])
	},
	qvm: {
		description: "Quake Virtual Machine (Quake 3)",
		match: (b) => checkMagic(b, 0, [0x44, 0x14, 0x72, 0x12])
	},
	bsp: {
		description: "Quake 3 BSP Compiled Map File",
		match: (b) => checkMagic(b, 0, [0x49, 0x42, 0x53, 0x50]) // "IBSP"
	},
	md3: {
		description: "Quake 3 MD3 Mesh Model File",
		match: (b) => checkMagic(b, 0, [0x49, 0x44, 0x50, 0x33]) // "IDP3"
	},
	aas: {
		description: "Quake 3 Bot Area Awareness System (AAS) File",
		match: (b) => checkMagic(b, 0, [0x45, 0x41, 0x41, 0x53]) // "EAAS"
	},
	dat: {
		description: "Quake 3 Team Arena Font Descriptor File",
		match: (b) => checkMagic(b, 0, [0x14, 0x00, 0x00, 0x00]) // 20 (fontInfo_t block size offset)
	},
	wav: {
		description: "Waveform Audio File Format",
		// WAV requires "RIFF" at byte 0 and "WAVE" at byte 8
		match: (b) => checkMagic(b, 0, [0x52, 0x49, 0x46, 0x46]) &&
			checkMagic(b, 8, [0x57, 0x41, 0x56, 0x45])
	},
	riff: {
		description: "Waveform Audio File",
		match: (b) => checkMagic(b, 0, [0x52, 0x49, 0x46, 0x46]) && checkMagic(b, 8, [0x57, 0x41, 0x56, 0x45]) // "RIFF" ... "WAVE"
	},
	mp3: {
		description: "MPEG Audio Layer III",
		match: (b) =>
		{
			if(b.length < 2) return false;
			// Catch ID3v2 header tag variant ("ID3")
			if(checkMagic(b, 0, [0x49, 0x44, 0x33])) return true;
			// Catch raw sync frames variant (0xFF + high bits 0xE0 set, like FF FB, FF F3, FF F2)
			return b[0] === 0xFF && (b[1] & 0xE0) === 0xE0;
		}
	},
	png: {
		description: "Portable Network Graphics Image",
		match: (b) => checkMagic(b, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
	},
	jpeg: {
		description: "JPEG Image",
		match: (b) => checkMagic(b, 0, [0xFF, 0xD8, 0xFF])
	},
	gif: {
		description: "Graphics Interchange Format Image",
		match: (b) => checkMagic(b, 0, [0x47, 0x49, 0x46, 0x38]) // "GIF8"
	},
	webp: {
		description: "WebP Image",
		match: (b) => checkMagic(b, 0, [0x52, 0x49, 0x46, 0x46]) && checkMagic(b, 8, [0x57, 0x45, 0x42, 0x50]) // "RIFF" ... "WEBP"
	},
	dds: {
		description: "DirectDraw Surface Texture Container",
		match: (b) => checkMagic(b, 0, [0x44, 0x44, 0x53, 0x20]) // "DDS "
	},
	tga: {
		description: "Truevision TGA Image (Uncompressed Truecolor/Grayscale)",
		match: (b) => (checkMagic(b, 0, [0x00, 0x00, 0x02, 0x00]) || checkMagic(b, 0, [0x00, 0x00, 0x03, 0x00]))
	},
	pcx: {
		description: "ZSoft PCX Bitmap Image (Legacy Quake/Id formats)",
		match: (b) => checkMagic(b, 0, [0x0A]) && (b[1] === 0x00 || b[1] === 0x02 || b[1] === 0x03 || b[1] === 0x05) // Manufacturer byte + Version check
	},
	bmp: {
		description: "Windows Bitmap Image",
		match: (b) => checkMagic(b, 0, [0x42, 0x4D]) // "BM"
	},
	ttf: {
		description: "TrueType Font File",
		match: (b) => checkMagic(b, 0, [0x00, 0x01, 0x00, 0x00]) || checkMagic(b, 0, [0x74, 0x72, 0x75, 0x65]) // 0x00010000 or "true"
	},
	woff: {
		description: "Web Open Font Format",
		match: (b) => checkMagic(b, 0, [0x77, 0x4F, 0x46, 0x46]) // "wOFF"
	},
	ogg: {
		description: "Ogg Vorbis Audio Container",
		match: (b) => checkMagic(b, 0, [0x4F, 0x67, 0x67, 0x53]) // "OggS"
	},
	woff2: {
		description: "Web Open Font Format 2",
		match: (b) => checkMagic(b, 0, [0x77, 0x4F, 0x46, 0x32]) // "wOF2"
	},
	otf: {
		description: "OpenType Font File",
		match: (b) => checkMagic(b, 0, [0x4F, 0x54, 0x54, 0x4F]) // "OTTO"
	},
	// ─── EXTENDED BINARY FORMATS FOR APPENDING ───
	pk3: {
		description: "Quake 3 Archive Package (Zip Variant)",
		match: (b) => checkMagic(b, 0, [0x50, 0x4B, 0x03, 0x04]) // "PK\003\004"
	},
	mdl: {
		description: "Half-Life / Quake MDL Mesh Model File",
		match: (b) => checkMagic(b, 0, [0x49, 0x44, 0x53, 0x54]) // "IDST"
	},
	md2: {
		description: "Quake 2 MD2 Mesh Model File",
		match: (b) => checkMagic(b, 0, [0x49, 0x44, 0x50, 0x32]) // "IDP2"
	},
	ico: {
		description: "Windows Icon Container Image",
		match: (b) => checkMagic(b, 0, [0x00, 0x00, 0x01, 0x00])
	},
	flac: {
		description: "Free Lossless Audio Codec",
		match: (b) => checkMagic(b, 0, [0x66, 0x4C, 0x61, 0x43]) // "fLaC"
	},
	pdf: {
		description: "Adobe Portable Document Format",
		match: (b) => checkMagic(b, 0, [0x25, 0x50, 0x44, 0x46]) // "%PDF"
	}
};


/**
 * @type {Record<string, (bytes: Uint8Array, path: string) => boolean>}
 */
export const AssetInspector = {
	isActuallyImage: (bytes, path) =>
	{
		const binType = detectBinaryType(bytes);
		if(binType !== 'unknown') return ['png', 'jpeg', 'gif', 'webp', 'dds', 'tga', 'pcx', 'bmp'].includes(binType);
		return /\.(png|jpe?g|gif|webp|tga|pcx|bmp|dds)$/i.test(path);
	},

	isActuallyAudio: (bytes, path) =>
	{
		const binType = detectBinaryType(bytes);
		if(binType !== 'unknown') return ['wav', 'mp3', 'ogg', 'flac', 'mid'].includes(binType);
		return /\.(wav|mp3|ogg|flac)$/i.test(path);
	},

	isActuallyMap: (bytes, path) =>
	{
		// Binary check
		if(detectBinaryType(bytes) === 'bsp' || path.endsWith('.bsp')) return true;

		// Text check against the waterfall registry keys
		const decoder = new TextDecoder();
		const sampleStr = decoder.decode(bytes);
		if(sampleStr)
		{
			const matched = TEXT_LANGUAGE_DETECTOR_WATERFALL.find(lang => lang.id.endsWith('map') && lang.match(sampleStr, bytes));
			if(matched) return true;
		}
		return /\.(map|vmf|mapx)$/i.test(path);
	},

	isActuallyFont: (bytes, path) =>
	{
		const binType = detectBinaryType(bytes);
		if(binType !== 'unknown') return ['ttf', 'woff', 'woff2', 'otf'].includes(binType);
		return /\.(ttf|woff|woff2|otf|eot)$/i.test(path);
	},

	isActuallyModel: (bytes, path) =>
	{
		const binType = detectBinaryType(bytes);
		if(binType !== 'unknown') return ['md3', 'mdl', 'md2'].includes(binType);
		return /\.(md3|mdl|md2|md5mesh|obj|fbx)$/i.test(path);
	}
};


/**
 * Detects the real underlying binary format from an ArrayBuffer or Uint8Array
 * @param {ArrayBuffer|Uint8Array} sourceBuffer
 * @returns {string} The detected format key, or 'unknown'
 */
export function detectBinaryType(sourceBuffer)
{
	const bytes = sourceBuffer instanceof Uint8Array ? sourceBuffer : new Uint8Array(sourceBuffer);

	for(const [type, format] of Object.entries(BINARY_DETECTOR))
	{
		if(format.match(bytes))
		{
			return type;
		}
	}
	return "unknown";
}

/**
 * Unpacks variable-length LEB128 unsigned integers from byte streams.
 * Crucial for avoiding pointer-drift caused by 5-byte compiler padding.
 */
export function decodeLEB128(uint8Array, offset)
{
	let result = 0;
	let shift = 0;
	let bytesRead = 0;
	while(offset + bytesRead < uint8Array.length)
	{
		const byte = uint8Array[offset + bytesRead];
		result |= (byte & 0x7f) << shift;
		bytesRead++;
		if((byte & 0x80) === 0) break;
		shift += 7;
	}
	return { value: result, bytes: bytesRead };
}

/**
 * Extracts comprehensive WebAssembly layout metrics and diagnostic symbols
 * to map a decorative, high-density telemetry header block.
 */
export function getWasmObjectHeader(sampleBytes, content, filePath)
{
	const isWasm = sampleBytes[0] === 0x00 && sampleBytes[1] === 0x61 && sampleBytes[2] === 0x73 && sampleBytes[3] === 0x6D;

	let infoStack = `WASM Architecture Blueprint (${content.length} bytes)\n`;
	infoStack += `========================================================================\n`;

	if(isWasm && sampleBytes.length >= 8)
	{
		const view = new DataView(sampleBytes.buffer, sampleBytes.byteOffset, sampleBytes.byteLength);
		const wasmVersion = view.getUint32(4, true);

		// Core Layout Size Registries (Bytes)
		let typeLength = 0;
		let importLength = 0;
		let funcSignaturesLength = 0;
		let tableLength = 0;
		let memoryLength = 0;
		let globalLength = 0;
		let exportLength = 0;
		let elementLength = 0;
		let codeLength = 0;
		let dataLength = 0;
		let dataCountLength = 0;
		let customLength = 0;

		// Structured Symbol & Relocation Telemetry
		let totalTypesCount = 0;
		let importedSymbolsCount = 0;
		let exportedSymbolsCount = 0;
		let compiledFunctionsCount = 0;
		let objectSymbolsCount = -1; // -1 indicates symbol table absent
		let codeRelocationsCount = 0;
		let dataRelocationsCount = 0;
		let isRelocatable = false;

		// Data collector registries
		const requestedFunctions = [];
		const exportedSymbols = [];
		const dataStrings = [];

		let ptr = 8;
		const totalBytes = sampleBytes.length;

		// Linear Object Layout Scanning Engine
		while(ptr < totalBytes)
		{
			if(ptr + 1 > totalBytes) break;

			const sectionId = sampleBytes[ptr];
			ptr += 1;

			const lengthDecode = decodeLEB128(sampleBytes, ptr);
			const sectionLength = lengthDecode.value;
			ptr += lengthDecode.bytes;

			const sectionEnd = ptr + sectionLength;
			if(sectionEnd > totalBytes) break;

			switch(sectionId)
			{
				case 0: // Custom Section Engine
					customLength += sectionLength;
					{
						const nameLenDec = decodeLEB128(sampleBytes, ptr);
						let namePtr = ptr + nameLenDec.bytes;
						let sectionName = "";
						for(let i = 0; i < Math.min(nameLenDec.value, 64); i++)
						{
							sectionName += String.fromCharCode(sampleBytes[namePtr + i]);
						}

						if(sectionName === "linking")
						{
							isRelocatable = true;
							let linkPtr = namePtr + nameLenDec.value;
							if(linkPtr < sectionEnd)
							{
								linkPtr += 1; // skip linking version
								while(linkPtr < sectionEnd)
								{
									const subId = sampleBytes[linkPtr];
									linkPtr += 1;
									const subLenDec = decodeLEB128(sampleBytes, linkPtr);
									linkPtr += subLenDec.bytes;
									if(subId === 8)
									{ // Symbol Table SubID
										objectSymbolsCount = decodeLEB128(sampleBytes, linkPtr).value;
									}
									linkPtr += subLenDec.value;
								}
							}
						}
						else if(sectionName === "reloc.CODE")
						{
							isRelocatable = true;
							codeRelocationsCount = decodeLEB128(sampleBytes, namePtr + nameLenDec.value).value;
						}
						else if(sectionName === "reloc.DATA")
						{
							isRelocatable = true;
							dataRelocationsCount = decodeLEB128(sampleBytes, namePtr + nameLenDec.value).value;
						}
						else if(sectionName === "name")
						{
							// --- PARSE EXTENDED DEBUG FUNCTION LABELS ---
							let nameSubPtr = namePtr + nameLenDec.value;
							while(nameSubPtr < sectionEnd)
							{
								const subId = sampleBytes[nameSubPtr];
								nameSubPtr += 1;
								const subLenDec = decodeLEB128(sampleBytes, nameSubPtr);
								nameSubPtr += subLenDec.bytes;
								const subEnd = nameSubPtr + subLenDec.value;

								if(subId === 1)
								{ // Function Names Sub-subsection
									const numNamesDec = decodeLEB128(sampleBytes, nameSubPtr);
									nameSubPtr += numNamesDec.bytes;
									for(let k = 0; k < Math.min(numNamesDec.value, 30); k++)
									{
										if(nameSubPtr >= subEnd) break;
										const fnIdxDec = decodeLEB128(sampleBytes, nameSubPtr);
										nameSubPtr += fnIdxDec.bytes;
										const fnNameLenDec = decodeLEB128(sampleBytes, nameSubPtr);
										nameSubPtr += fnNameLenDec.bytes;

										let fnName = "";
										for(let n = 0; n < fnNameLenDec.value; n++)
										{
											fnName += String.fromCharCode(sampleBytes[nameSubPtr + n]);
										}
										nameSubPtr += fnNameLenDec.value;
										localFunctionNames.push(`Index ${fnIdxDec.value} -> "${fnName}"`);
									}
								}
								nameSubPtr = subEnd;
							}
						}
					}
					break;

				case 1: // Type definitions
					typeLength += sectionLength;
					totalTypesCount = decodeLEB128(sampleBytes, ptr).value;
					break;

				case 2: // Imports Section (FIXED POINTER DESYNC)
					importLength += sectionLength;
					{
						let sPtr = ptr;
						const countDecode = decodeLEB128(sampleBytes, sPtr);
						importedSymbolsCount = countDecode.value;
						sPtr += countDecode.bytes;

						for(let i = 0; i < importedSymbolsCount; i++)
						{
							const modLenDec = decodeLEB128(sampleBytes, sPtr);
							sPtr += modLenDec.bytes;
							let modName = "";
							for(let j = 0; j < modLenDec.value; j++) modName += String.fromCharCode(sampleBytes[sPtr + j]);
							sPtr += modLenDec.value;

							const fieldLenDec = decodeLEB128(sampleBytes, sPtr);
							sPtr += fieldLenDec.bytes;
							let fieldName = "";
							for(let j = 0; j < fieldLenDec.value; j++) fieldName += String.fromCharCode(sampleBytes[sPtr + j]);
							sPtr += fieldLenDec.value;

							const importKind = sampleBytes[sPtr];
							sPtr += 1;

							if(importKind === 0x00)
							{ // Function
								const typeIdxDec = decodeLEB128(sampleBytes, sPtr);
								requestedFunctions.push(`${modName}.${fieldName} (Func Sig Index: ${typeIdxDec.value})`);
								sPtr += typeIdxDec.bytes;
							} else if(importKind === 0x01)
							{ // Table
								sPtr += 1; // element type
								const limitsDec = decodeLEB128(sampleBytes, sPtr); // flags
								sPtr += limitsDec.bytes;
								const initialDec = decodeLEB128(sampleBytes, sPtr);
								sPtr += initialDec.bytes;
							} else if(importKind === 0x02)
							{ // Memory
								const limitsDec = decodeLEB128(sampleBytes, sPtr);
								sPtr += limitsDec.bytes;
								const initialDec = decodeLEB128(sampleBytes, sPtr);
								sPtr += initialDec.bytes;
							} else if(importKind === 0x03)
							{ // Global
								sPtr += 2; // content type + mutability byte
								requestedFunctions.push(`${modName}.${fieldName} (Global Descriptor)`);
							}
						}
					}
					break;

				case 3: // Function Signatures Index
					funcSignaturesLength += sectionLength;
					compiledFunctionsCount = decodeLEB128(sampleBytes, ptr).value;
					break;
				case 4: tableLength += sectionLength; break;
				case 5: memoryLength += sectionLength; break;
				case 6: globalLength += sectionLength; break;

				case 7: // Exports Section
					exportLength += sectionLength;
					{
						let sPtr = ptr;
						const countDecode = decodeLEB128(sampleBytes, sPtr);
						exportedSymbolsCount = countDecode.value;
						sPtr += countDecode.bytes;

						for(let i = 0; i < exportedSymbolsCount; i++)
						{
							const nameLenDec = decodeLEB128(sampleBytes, sPtr);
							sPtr += nameLenDec.bytes;
							let expName = "";
							for(let j = 0; j < nameLenDec.value; j++) expName += String.fromCharCode(sampleBytes[sPtr + j]);
							sPtr += nameLenDec.value;

							const kind = sampleBytes[sPtr];
							sPtr += 1;
							const idxDec = decodeLEB128(sampleBytes, sPtr);
							sPtr += idxDec.bytes;

							const kindLabel = kind === 0 ? "Fn" : kind === 1 ? "Table" : kind === 2 ? "Mem" : "Global";
							exportedSymbols.push(`${expName} [Index ${idxDec.value} - ${kindLabel}]`);
						}
					}
					break;

				case 9: elementLength += sectionLength; break;
				case 10: codeLength += sectionLength; break;

				case 11: // Linear Data Strings Section
					dataLength += sectionLength;
					{
						let sPtr = ptr;
						const countDecode = decodeLEB128(sampleBytes, sPtr);
						let segmentCount = countDecode.value;
						sPtr += countDecode.bytes;

						for(let i = 0; i < segmentCount; i++)
						{
							if(sampleBytes[sPtr] === 0 || sampleBytes[sPtr] === 1 || sampleBytes[sPtr] === 2) sPtr += 1;
							while(sampleBytes[sPtr] !== 0x0B && sPtr < sectionEnd) sPtr++;
							sPtr += 1; // skip past end instruction wrapper

							const sizeDec = decodeLEB128(sampleBytes, sPtr);
							sPtr += sizeDec.bytes;

							let strAccumulator = "";
							for(let j = 0; j < sizeDec.value; j++)
							{
								const charCode = sampleBytes[sPtr + j];
								if(charCode >= 32 && charCode <= 126)
								{
									strAccumulator += String.fromCharCode(charCode);
								}
							}
							if(strAccumulator.trim().length > 2)
							{
								dataStrings.push(strAccumulator.trim());
							}
							sPtr += sizeDec.value;
						}
					}
					break;
				case 14: dataCountLength += sectionLength; break;
			}

			ptr = sectionEnd; // Leap cleanly directly to the next section block boundary
		}

		// Construct high-density report matrix
		infoStack += `Output Filename:     ${filePath}\n`;
		infoStack += `Binary File Profile: WASM v${wasmVersion} (${isRelocatable ? "Relocatable Object Binary" : "Executable Module"})\n`;
		infoStack += `Compiler Toolchain:  Clang LLVM WebAssembly Execution Platform\n`;
		infoStack += `------------------------------------------------------------------------\n`;
		infoStack += `Code Segment size:    ${codeLength.toString().padEnd(10)} bytes (${compiledFunctionsCount} internal blocks)\n`;
		infoStack += `Data Segment size:    ${dataLength.toString().padEnd(10)} bytes (Linear constants layout)\n`;
		infoStack += `Type Register size:   ${typeLength.toString().padEnd(10)} bytes (${totalTypesCount} unique signatures)\n`;
		infoStack += `Import Payload size:  ${importLength.toString().padEnd(10)} bytes (${importedSymbolsCount} external dependencies)\n`;
		infoStack += `Export Payload size:  ${exportLength.toString().padEnd(10)} bytes (${exportedSymbolsCount} mapped exit symbols)\n`;
		infoStack += `Global Memory size:   ${globalLength.toString().padEnd(10)} bytes\n`;
		infoStack += `Custom Metadata size: ${customLength.toString().padEnd(10)} bytes\n`;

		if(isRelocatable)
		{
			infoStack += `------------------------------------------------------------------------\n`;
			infoStack += `Object Symbol Table:  ${(objectSymbolsCount !== -1 ? objectSymbolsCount : "0").toString().padEnd(10)} linkage identifiers loaded\n`;
			infoStack += `Code Relocations:     ${codeRelocationsCount.toString().padEnd(10)} instruction fixup coordinates\n`;
			infoStack += `Data Relocations:     ${dataRelocationsCount.toString().padEnd(10)} variable offset fixup addresses\n`;
		}

		infoStack += `------------------------------------------------------------------------\n`;


		// 1. Output Import Dependencies table
		infoStack += `REQUESTED SYS-FUNCTIONS & ENVIRONMENT IMPORTS:\n`;
		if(requestedFunctions.length > 0)
		{
			requestedFunctions.forEach(f => infoStack += `  -> import: ${f}\n`);
		} else
		{
			infoStack += `  (No external platform dependencies requested)\n`;
		}
		infoStack += `------------------------------------------------------------------------\n`;

		// 2. Output Export Registry mappings
		infoStack += `EXPORTED MODULE INTERFACE SYMBOLS:\n`;
		if(exportedSymbols.length > 0)
		{
			exportedSymbols.forEach(e => infoStack += `  => export: ${e}\n`);
		} else
		{
			infoStack += `  (No functions or bounds exported to runtime host)\n`;
		}

		// 3. Output extracted Data String Literals pool
		if(dataStrings.length > 0)
		{
			infoStack += `------------------------------------------------------------------------\n`;
			infoStack += `EMBEDDED LINEAR DATA STRINGS & CONSTANTS:\n`;
			dataStrings.slice(0, 10).forEach(str => infoStack += `  " ${str} "\n`);
			if(dataStrings.length > 10) infoStack += `  ... and ${dataStrings.length - 10} other text literals.\n`;
		}

		infoStack += `========================================================================\n`;
		infoStack += `Status:               Successfully isolated object compilation tables.\n`;
	} else
	{
		infoStack += `Format:               Unknown Raw Non-WASM Binary Payload\n`;
	}

	return infoStack;
}

export function getQVMHeader(sampleBytes, content, filePath)
{



	// 1. Read QVM Header Magic Number (0x12721444 or 'qvm\x12')
	// Standard QVM headers start with Magic (4 bytes), Instruction Count (4 bytes),
	// Code Offset/Length (4), Data Offset/Length (4), Lit Offset/Length (4), BSS Length (4)
	const isQVM = sampleBytes[0] === 0x44 && sampleBytes[1] === 0x14 && sampleBytes[2] === 0x72 && sampleBytes[3] === 0x12;

	let infoStack = `QVM file detected (${content.length} bytes)\n`;
	infoStack += `========================================================================\n`;

	if(isQVM && sampleBytes.length >= 24)
	{
		// Parse 32-bit Little Endian integers from the QVM header metadata
		const view = new DataView(sampleBytes.buffer, sampleBytes.byteOffset, sampleBytes.byteLength);
		const instructionCount = view.getUint32(4, true);
		const codeLength = view.getUint32(8, true);
		const dataLength = view.getUint32(12, true);
		const litLength = view.getUint32(16, true);
		const bssLength = view.getUint32(20, true);

		// Render the compilation metadata block
		infoStack += `Output filename:      ${filePath}\n`;
		infoStack += `Compiler Sequence:    pass #1: define -> pass #2: compile -> pass #3: define -> pass #4: compile\n`;
		infoStack += `------------------------------------------------------------------------\n`;
		infoStack += `Code Segment size:    ${codeLength.toString().padEnd(10)} bytes\n`;
		infoStack += `Data Segment size:    ${dataLength.toString().padEnd(10)} bytes\n`;
		infoStack += `Lit Segment size:     ${litLength.toString().padEnd(10)} bytes\n`;
		infoStack += `BSS Segment size:     ${bssLength.toString().padEnd(10)} bytes (Uninitialized Data)\n`;
		infoStack += `Instruction Count:    ${instructionCount.toString().padEnd(10)}\n`;
		infoStack += `------------------------------------------------------------------------\n`;
		infoStack += `Status:               Successfully mapped binary targets.\n`;
	} else
	{
		infoStack += `Format:               Unknown Raw Binary Data\n`;
	}

	//const hexRows = hexDump(sampleBytes, content, filePath)

	return infoStack;
}



export function hexDump(sampleBytes, content, filePath)
{
	let infoStack;

	if(filePath.endsWith('.o'))
	{
		infoStack = getWasmObjectHeader(sampleBytes, content, filePath);

		infoStack += renderWasmDisassemblySuite(sampleBytes, rowWidth = 16);

		return infoStack;
	} else if(filePath.endsWith('.wasm'))
	{
		infoStack = getWasmFinalHeader(sampleBytes, content, filePath);

		infoStack += renderWasmDisassembly(sampleBytes, rowWidth = 16);

		return infoStack;
	} else if(filePath.endsWith('.qvm'))
	{
		infoStack = getQVMHeader(sampleBytes, content, filePath);
	} else if(filePath.endsWith('.md3'))
	{
		infoStack = renderMd3DisassemblySuite(content, filePath);
	} else if(filePath.endsWith('.bsp'))
	{
		infoStack = renderBspDisassemblySuite(content, filePath);
	} else if(filePath.endsWith('.aas'))
	{
		infoStack = renderAasDisassemblySuite(content, filePath);
	} else if(filePath.endsWith('.dm3') || filePath.endsWith('.dm68'))
	{
		infoStack = parseDM3Telemetry(sampleBytes);
	} else if(filePath.endsWith('.dat') || filePath.endsWith('.dm68'))
	{
		infoStack = parseQ3FontDat(content);
	} else
	{

		infoStack = `Binary file detected (${content.length} bytes)\n`;
	}

	infoStack += `========================================================================\n\n`;
	infoStack += `Raw Header Hex View (First ${sampleBytes.length} bytes):\n`;
	infoStack += `------------------------------------------------------------------------\n`;

	let hexRows = [];
	for(let i = 0; i < sampleBytes.length; i += 16)
	{
		let chunk = [];
		for(let j = 0; j < 16; j++)
		{
			if(i + j < sampleBytes.length)
			{
				let byteHex = sampleBytes[i + j].toString(16).padStart(2, '0').toUpperCase();
				chunk.push(byteHex);
			}
		}

		// Add visual split column delimiter at byte index 8
		if(chunk.length > 8)
		{
			chunk.splice(8, 0, "|");
		}

		// Pad out short rows at the end of the data chunk sample
		let hexLine = chunk.join(" ");
		let offset = i.toString(16).padStart(4, '0').toUpperCase();
		hexRows.push(`0x${offset}:  ${hexLine}`);
	}

	let str = infoStack + hexRows.join("\n");

	return str;
}


/**
 * Core WebAssembly Opcode Dictionary
 * Maps binary bytecode values directly to standard instruction text mnemonics.
 */
const WASM_OPCODES = {
	0x00: "unreachable", 0x01: "nop", 0x02: "block", 0x03: "loop", 0x04: "if", 0x05: "else",
	0x0B: "end", 0x0C: "br", 0x0D: "br_if", 0x0E: "br_table", 0x0F: "return", 0x10: "call",
	0x11: "call_indirect", 0x1A: "drop", 0x1B: "select",
	0x20: "local.get", 0x21: "local.set", 0x22: "local.tee", 0x23: "global.get", 0x24: "global.set",
	0x28: "i32.load", 0x29: "i64.load", 0x2A: "f32.load", 0x2B: "f64.load",
	0x2C: "i32.load8_s", 0x2D: "i32.load8_u", 0x2E: "i32.load16_s", 0x2F: "i32.load16_u",
	0x36: "i32.store", 0x37: "i64.store", 0x3A: "i32.store8", 0x3B: "i32.store16",
	0x3C: "i64.store8", 0x41: "i32.const", 0x42: "i64.const", 0x43: "f32.const", 0x44: "f64.const",
	0x45: "i32.eqz", 0x46: "i32.eq", 0x47: "i32.ne", 0x48: "i32.lt_s", 0x49: "i32.lt_u",
	0x4A: "i32.gt_s", 0x4B: "i32.gt_u", 0x4C: "i32.le_s", 0x4D: "i32.le_u",
	0x6A: "i32.add", 0x6B: "i32.sub", 0x6C: "i32.mul", 0x6D: "i32.div_s", 0x6E: "i32.div_u",
	0x70: "i32.rem_u", 0x71: "i32.and", 0x72: "i32.or", 0x73: "i32.xor", 0x74: "i32.shl",
	0x75: "i32.shr_s", 0x76: "i32.shr_u", 0x7F: "i32", 0x7E: "i64", 0x7D: "f32", 0x7C: "f64"
};

/**
 * Sweeps a 16-byte buffer and returns a side-by-side disassembly text string map.
 */
export function disassembleWasmRow(bytes, globalOffset)
{
	let outputLines = [];
	let i = 0;

	while(i < bytes.length)
	{
		let byteVal = bytes[i];
		let currentAddr = globalOffset + i;
		let addrStr = `0x${currentAddr.toString(16).padStart(4, '0').toUpperCase()}`;

		// Build raw hexadecimal byte representation
		let hexByte = byteVal.toString(16).padStart(2, '0').toUpperCase();

		let interpretation = "";

		// 1. Check if the opcode is a recognized stack instruction mnemonic
		if(WASM_OPCODES[byteVal] !== undefined)
		{
			interpretation = `; asm: ${WASM_OPCODES[byteVal]}`;

			// Read parameter contexts out of variable length blocks if applicable
			if(byteVal === 0x41 || byteVal === 0x20 || byteVal === 0x21 || byteVal === 0x10)
			{
				if(i + 1 < bytes.length)
				{
					let nextByte = bytes[i + 1];
					// Lookahead tracking for indices or numerical values
					interpretation += ` [imm: 0x${nextByte.toString(16).toUpperCase()}]`;
				}
			}
		}
		// 2. Fall back to evaluating if it's printable standard ASCII data
		else if(byteVal >= 32 && byteVal <= 126)
		{
			interpretation = `; str: "${String.fromCharCode(byteVal)}"`;
		}
		// 3. Low level system padding or structural section formatting definitions
		else if(byteVal === 0x80 || byteVal === 0x82 || byteVal === 0x88 || byteVal === 0x00)
		{
			interpretation = "; sys: padding/leb128";
		}

		// Pad the hex byte out cleanly to match column grid gutters
		let rawHexColumn = `${hexByte}`.padEnd(6, ' ');
		outputLines.push(`${addrStr}:  ${rawHexColumn} ${interpretation}`);
		i++;
	}

	return outputLines.join("\n");
}
/**
 * Consolidated WebAssembly Binary Analysis & Side-by-Side Disassembly Suite
 * Parses module headers internally and generates an adjustable multi-byte row matrix view.
 *
 * @param {Uint8Array} sampleBytes - Raw application binary array buffer workspace
 * @param {number} rowWidth - Display column byte grouping threshold (typically 8 or 16)
 * @param {number|null} viewportStart - Optional custom byte offset to target; defaults to Code Start
 * @param {number} viewportLength - Total size slice boundary to dump into the active view pane
 */
export function renderWasmDisassemblySuite(sampleBytes, rowWidth = 16, viewportStart = null, viewportLength = null, codeStart = null, codeLength = null, dataStart = null, dataLength = null)
{
	const isWasm = sampleBytes[0] === 0x00 && sampleBytes[1] === 0x61 && sampleBytes[2] === 0x73 && sampleBytes[3] === 0x6D;
	if(!isWasm)
	{
		return "Error: Targeted stream does not contain a valid WebAssembly magic header.";
	}

	// =========================================================================
	// STEP 1: INTERNAL CORE STRUCTURAL PASS (LOCATING BOUNDARIES & OFFSETS)
	// =========================================================================
	let wasmVersion = 1;
	if(sampleBytes.length >= 8)
	{
		const view = new DataView(sampleBytes.buffer, sampleBytes.byteOffset, sampleBytes.byteLength);
		wasmVersion = view.getUint32(4, true);
	}

	// Layout pointer targets
	let codeSectionStart = codeStart !== undefined ? codeStart : -1;
	let codeSectionLength = codeLength || 0;
	let dataSectionStart = dataStart !== undefined ? dataStart : -1;
	let dataSectionLength = dataLength || 0;

	// 2. Only run internal scanning pass if we are in 'auto' mode and haven't passed presets
	if(codeStart === -1)
	{
		let ptr = 8;
		while(ptr < sampleBytes.length)
		{
			if(ptr + 1 > sampleBytes.length) break;
			const sectionId = sampleBytes[ptr];
			ptr += 1;
			const lengthDecode = decodeLEB128(sampleBytes, ptr);
			const sectionLength = lengthDecode.value;
			ptr += lengthDecode.bytes;

			if(sectionId === 10)
			{
				codeSectionStart = ptr + globalOffset;
				codeSectionLength = sectionLength;
			} else if(sectionId === 11)
			{
				dataSectionStart = ptr + globalOffset;
				dataSectionLength = sectionLength;
			}
			ptr += sectionLength;
		}
	}


	// Metric registries
	let typeSignaturesCount = 0;
	let importedGlobalsCount = 0;
	let importedFunctionsCount = 0;
	let compiledFunctionsCount = 0;
	let exportedSymbolsCount = 0;
	let isRelocatableObject = false;

	let ptr = 8;
	const totalBytes = sampleBytes.length;

	while(ptr < totalBytes)
	{
		if(ptr + 1 > totalBytes) break;
		const sectionId = sampleBytes[ptr];
		ptr += 1;

		// Use your existing decodeLEB128 utility to safely jump sections
		const lengthDecode = decodeLEB128(sampleBytes, ptr);
		const sectionLength = lengthDecode.value;
		ptr += lengthDecode.bytes;

		const sectionEnd = ptr + sectionLength;
		if(sectionEnd > totalBytes) break;

		switch(sectionId)
		{
			case 0: // Custom Section Analysis (Checks for Clang Linker Tables)
				const nameLenDec = decodeLEB128(sampleBytes, ptr);
				let namePtr = ptr + nameLenDec.bytes;
				let sectionName = "";
				for(let i = 0; i < Math.min(nameLenDec.value, 12); i++)
				{
					sectionName += String.fromCharCode(sampleBytes[namePtr + i]);
				}
				if(sectionName === "linking" || sectionName.startsWith("reloc."))
				{
					isRelocatableObject = true;
				}
				break;
			case 1: // Types
				typeSignaturesCount = decodeLEB128(sampleBytes, ptr).value;
				break;
			case 2: // Imports (Count function hooks vs global state variables)
				let impPtr = ptr;
				const impCountDec = decodeLEB128(sampleBytes, impPtr);
				impPtr += impCountDec.bytes;
				for(let i = 0; i < impCountDec.value; i++)
				{
					const modLen = decodeLEB128(sampleBytes, impPtr); impPtr += modLen.bytes + modLen.value;
					const fldLen = decodeLEB128(sampleBytes, impPtr); impPtr += fldLen.bytes + fldLen.value;
					const kind = sampleBytes[impPtr]; impPtr += 1;
					if(kind === 0x00) importedFunctionsCount++;
					else if(kind === 0x03) importedGlobalsCount++;
					else
					{
						const lim = decodeLEB128(sampleBytes, impPtr); impPtr += lim.bytes;
						const init = decodeLEB128(sampleBytes, impPtr); impPtr += init.bytes;
					}
				}
				break;
			case 3: // Function Signatures Mappings
				compiledFunctionsCount = decodeLEB128(sampleBytes, ptr).value;
				break;
			case 7: // Exports Table Mappings
				exportedSymbolsCount = decodeLEB128(sampleBytes, ptr).value;
				break;
			case 10: // CODE SECTION (The Program Target)
				codeSectionStart = ptr;
				codeSectionLength = sectionLength;
				break;
			case 11: // DATA SECTION (Linear Storage Pool)
				dataSectionStart = ptr;
				dataSectionLength = sectionLength;
				break;
		}
		ptr = sectionEnd;
	}

	// =========================================================================
	// STEP 2: CONSTRUCT TELEMETRY INFRASTRUCTURE HEADER
	// =========================================================================
	let outputBuffer = `WASM Executable Map Summary\n`;
	outputBuffer += `========================================================================\n`;
	outputBuffer += `Binary Profile:       WASM v${wasmVersion} (${isRelocatableObject ? "Relocatable Object File" : "Linked Executable Module"})\n`;
	outputBuffer += `Program Core Bounds:  ${typeof codeSectionStart === 'undefined' || !codeSectionStart
		? 'Not found'
		: ('Offset Address: 0x' + codeSectionStart.toString(16).toUpperCase().padStart(4, '0'))} (${codeSectionLength} raw payload bytes)\n`;
	outputBuffer += `Instruction Matrix:  ${compiledFunctionsCount} compiled structural function blocks context\n`;
	outputBuffer += `Import Assertions:   ${importedFunctionsCount} dynamic external calls, ${importedGlobalsCount} global memory offsets\n`;
	outputBuffer += `Export Accessors:    ${exportedSymbolsCount} mapped system interface entry gates\n`;
	outputBuffer += `========================================================================\n\n`;
	outputBuffer += `Side-by-Side Unified Hex & Instruction Disassembly Window:\n`;
	outputBuffer += `------------------------------------------------------------------------\n`;

	// =========================================================================
	// STEP 3: VIEWPORT WINDOWING INITIALIZATION
	// =========================================================================
	// Default the scroll track focus straight to where the executable program code starts
	let startIdx = (viewportStart !== null) ? viewportStart : (codeSectionStart !== -1 ? codeSectionStart : 0);
	let endIdx = Math.min(sampleBytes.length, startIdx + (viewportLength !== null ? viewportLength : sampleBytes.length));

	// Ground loop alignment to your configured rowWidth layout threshold boundary
	startIdx = Math.floor(startIdx / rowWidth) * rowWidth;


	// =========================================================================
	// STEP 4: ADJUSTABLE MULTI-BYTE ROW PRINTING LOOP
	// =========================================================================
	for(let rowAddr = startIdx; rowAddr < endIdx; rowAddr += rowWidth)
	{
		let chunkBytes = [];
		for(let offset = 0; offset < rowWidth; offset++)
		{
			if(rowAddr + offset < sampleBytes.length)
			{
				chunkBytes.push(sampleBytes[rowAddr + offset]);
			}
		}

		// Format the global memory address marker label (e.g., 0x01A0)
		let addrLabel = `0x${rowAddr.toString(16).padStart(4, '0').toUpperCase()}`;

		// Map raw hexadecimal byte representations cleanly
		let hexString = chunkBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(" ");
		let expectedHexLength = (rowWidth * 3) - 1;
		let paddedHexColumn = hexString.padEnd(expectedHexLength, ' ');

		// Generate an alternative real-time side-by-side standard ASCII text representation map
		let asciiPreview = chunkBytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join("");

		let annotation = "";
		const isRowInCode = (rowAddr >= codeSectionStart && rowAddr < (codeSectionStart + codeSectionLength));
		const isRowInData = (rowAddr >= dataSectionStart && rowAddr < (dataSectionStart + dataSectionLength));

		// ─── CONTEXT LAYOUT A: EXECUTABLE CODE MATRIX ───
		if(isRowInCode)
		{
			let rowInstructions = [];
			let i = 0;

			while(i < chunkBytes.length)
			{
				let byteVal = chunkBytes[i];
				if(WASM_OPCODES[byteVal] !== undefined)
				{
					let mnemonics = WASM_OPCODES[byteVal];

					// Lookahead argument tracker to bind immediate values cleanly: "local.get 0x02"
					if(byteVal === 0x41 || byteVal === 0x20 || byteVal === 0x21 || byteVal === 0x10)
					{
						if(i + 1 < chunkBytes.length)
						{
							let immediateVal = chunkBytes[i + 1];
							mnemonics += ` 0x${immediateVal.toString(16).toUpperCase()}`;
							i += 1; // Step past consumed argument
						}
					}
					rowInstructions.push(mnemonics);
				} else
				{
					// Display unmapped operational codes compactly
					rowInstructions.push(`0x${byteVal.toString(16).toUpperCase()}`);
				}
				i++;
			}
			annotation = `ASM: ${rowInstructions.join(" -> ")}`;
		}
		// ─── CONTEXT LAYOUT B: LINEAR CONSTANT POOLS ───
		else if(isRowInData)
		{
			annotation = `STR: "${asciiPreview.replace(/\.+/g, ' ').trim()}"`;
		}
		// ─── CONTEXT LAYOUT C: CLEAN SYNC STRUCTURAL METADATA ───
		else
		{
			let segmentLabel = "STRUCT";
			if(rowAddr === 0) segmentLabel = "HEADER";
			else if(rowAddr < codeSectionStart) segmentLabel = "METADATA";
			else segmentLabel = "LINK-TABLE";

			annotation = `${segmentLabel}: [ ${asciiPreview} ]`;
		}

		// Print final perfectly padded, symmetric screen lines matrix row
		outputBuffer += `${addrLabel}:  ${paddedHexColumn} | ${asciiPreview} | ; ${annotation}\n`;
	}


	return outputBuffer;
}


/**
 * Advanced QVM Binary Analysis & Disassembly Stream Suite
 * Parses Quake VM headers and produces an adjustable multi-byte side-by-side view.
 *
 * @param {Uint8Array} sampleBytes - Raw application binary array buffer workspace
 * @param {number} rowWidth - Display column byte grouping threshold (typically 8 or 16)
 * @param {Object} options - Configuration parameters for windowing and overrides
 * @param {number} options.globalOffset - File index offset where this byte slice starts
 * @param {number|null} options.viewportStart - Target file offset to dump; defaults to Code Start
 * @param {number} options.viewportLength - Total byte size slice boundary to render
 * @param {Object} options.syscallMap - Optional map of negative integer IDs to String syscall names
 */
export function renderQvmDisassemblySuite(sampleBytes, rowWidth = 16, options = {})
{
	const globalOffset = options.globalOffset || 0;
	const syscallMap = options.syscallMap || {};

	// QVM Magic Identifiers
	const VM_MAGIC_VER1 = 0x12721444;
	const VM_MAGIC_VER2 = 0x12721445;

	// =========================================================================
	// QVM OPCODES DEFINITION MATRIX
	// =========================================================================
	const QVM_OPCODES = [
		{ name: 'UNDEF', argLen: 0, type: 'none' }, // 0
		{ name: 'IGNORE', argLen: 0, type: 'none' }, // 1
		{ name: 'BREAK', argLen: 0, type: 'none' }, // 2
		{ name: 'ENTER', argLen: 4, type: 'u4' }, // 3
		{ name: 'LEAVE', argLen: 4, type: 'u4' }, // 4
		{ name: 'CALL', argLen: 0, type: 'none' }, // 5
		{ name: 'PUSH', argLen: 0, type: 'none' }, // 6
		{ name: 'POP', argLen: 0, type: 'none' }, // 7
		{ name: 'CONST', argLen: 4, type: 'u4' }, // 8
		{ name: 'LOCAL', argLen: 4, type: 'u4' }, // 9
		{ name: 'JUMP', argLen: 0, type: 'none' }, // 10
		{ name: 'EQ', argLen: 4, type: 'i4' }, // 11
		{ name: 'NE', argLen: 4, type: 'i4' }, // 12
		{ name: 'LTI', argLen: 4, type: 'i4' }, // 13
		{ name: 'LEI', argLen: 4, type: 'i4' }, // 14
		{ name: 'GTI', argLen: 4, type: 'i4' }, // 15
		{ name: 'GEI', argLen: 4, type: 'i4' }, // 16
		{ name: 'LTU', argLen: 4, type: 'u4' }, // 17
		{ name: 'LEU', argLen: 4, type: 'u4' }, // 18
		{ name: 'GTU', argLen: 4, type: 'u4' }, // 19
		{ name: 'GEU', argLen: 4, type: 'u4' }, // 20
		{ name: 'EQF', argLen: 4, type: 'f4' }, // 21
		{ name: 'NEF', argLen: 4, type: 'f4' }, // 22
		{ name: 'LTF', argLen: 4, type: 'f4' }, // 23
		{ name: 'LEF', argLen: 4, type: 'f4' }, // 24
		{ name: 'GTF', argLen: 4, type: 'f4' }, // 25
		{ name: 'GEF', argLen: 4, type: 'f4' }, // 26
		{ name: 'LOAD1', argLen: 0, type: 'none' }, // 27
		{ name: 'LOAD2', argLen: 0, type: 'none' }, // 28
		{ name: 'LOAD4', argLen: 0, type: 'none' }, // 29
		{ name: 'STORE1', argLen: 0, type: 'none' }, // 30
		{ name: 'STORE2', argLen: 0, type: 'none' }, // 31
		{ name: 'STORE4', argLen: 0, type: 'none' }, // 32
		{ name: 'ARG', argLen: 1, type: 'u1' }, // 33
		{ name: 'BLOCK_COPY', argLen: 4, type: 'u4' }, // 34
		{ name: 'SEX8', argLen: 0, type: 'none' }, // 35
		{ name: 'SEX16', argLen: 0, type: 'none' }, // 36
		{ name: 'NEGI', argLen: 0, type: 'none' }, // 37
		{ name: 'ADD', argLen: 0, type: 'none' }, // 38
		{ name: 'SUB', argLen: 0, type: 'none' }, // 39
		{ name: 'DIVI', argLen: 0, type: 'none' }, // 40
		{ name: 'DIVU', argLen: 0, type: 'none' }, // 41
		{ name: 'MODI', argLen: 0, type: 'none' }, // 42
		{ name: 'MODU', argLen: 0, type: 'none' }, // 43
		{ name: 'MULI', argLen: 0, type: 'none' }, // 44
		{ name: 'MULU', argLen: 0, type: 'none' }, // 45
		{ name: 'BAND', argLen: 0, type: 'none' }, // 46
		{ name: 'BOR', argLen: 0, type: 'none' }, // 47
		{ name: 'BXOR', argLen: 0, type: 'none' }, // 48
		{ name: 'BCOM', argLen: 0, type: 'none' }, // 49
		{ name: 'LSH', argLen: 0, type: 'none' }, // 50
		{ name: 'RSHI', argLen: 0, type: 'none' }, // 51
		{ name: 'RSHU', argLen: 0, type: 'none' }, // 52
		{ name: 'NEGF', argLen: 0, type: 'none' }, // 53
		{ name: 'ADDF', argLen: 0, type: 'none' }, // 54
		{ name: 'SUBF', argLen: 0, type: 'none' }, // 55
		{ name: 'DIVF', argLen: 0, type: 'none' }, // 56
		{ name: 'MULF', argLen: 0, type: 'none' }, // 57
		{ name: 'CVIF', argLen: 0, type: 'none' }, // 58
		{ name: 'CVFI', argLen: 0, type: 'none' }  // 59
	];

	if(sampleBytes.length < 32)
	{
		return "Error: Invalid QVM stream layout structure (Size payload bounds too small).";
	}

	// Binary Little-Endian Reader Primitives
	const view = new DataView(sampleBytes.buffer, sampleBytes.byteOffset, sampleBytes.byteLength);
	const readU1 = (offset) => sampleBytes[offset];
	const readU4 = (offset) => view.getUint32(offset, true);
	const readI4 = (offset) => view.getInt32(offset, true);
	const readF4 = (offset) => view.getFloat32(offset, true);

	// =========================================================================
	// STEP 1: PARSE THE QVM COMPILATION HEADER
	// =========================================================================
	const header = {
		magic: readU4(0),
		instructionCount: readU4(4),
		codeOffset: readU4(8),
		codeLength: readU4(12),
		dataOffset: readU4(16),
		dataLength: readU4(24), // Fixed offset error tracking out of standard build
		litLength: readU4(24),
		bssLength: readU4(28)
	};
	header.jtrgLength = (header.magic === VM_MAGIC_VER2) ? readU4(32) : 0;

	if(header.magic !== VM_MAGIC_VER1 && header.magic !== VM_MAGIC_VER2)
	{
		return `Error: Stream target does not contain a verified QVM specification signature (Got: 0x${header.magic.toString(16)}).`;
	}

	// Establish boundaries across linear runtime space mapping coordinates
	const codeStart = header.codeOffset;
	const codeEnd = codeStart + header.codeLength;
	const dataStart = header.dataOffset;
	const dataEnd = dataStart + header.dataLength;
	const litStart = dataEnd;
	const litEnd = litStart + header.litLength;

	// =========================================================================
	// STEP 2: GENERATE THE INSTRUCTION POINTER AND PROCEDURE DICTIONARY TRACKING
	// =========================================================================
	// Maps file absolute bytecode indices straight to clean Instruction Labels
	let instructionPointers = [];
	let procedureNamesMap = {}; // Key: Code Address Index -> Value: Sub-string label

	let pc = codeStart;
	while(pc < codeEnd && pc < sampleBytes.length)
	{
		instructionPointers.push(pc);
		let opcode = readU1(pc);
		if(opcode < QVM_OPCODES.length)
		{
			pc += QVM_OPCODES[opcode].argLen;
		}
		pc += 1;
	}

	// Trace procedures using standard entry tracking markers (Opcode 3: ENTER)
	for(let idx = 0; idx < instructionPointers.length; idx++)
	{
		let fileOffset = instructionPointers[idx];
		if(readU1(fileOffset) === 3)
		{ // ENTER
			procedureNamesMap[fileOffset] = `sub_${fileOffset.toString(16).toUpperCase().padStart(8, '0')}`;
		}
	}

	// =========================================================================
	// STEP 3: CONSTRUCT TELEMETRY INFRASTRUCTURE HEADER
	// =========================================================================
	let outputBuffer = `QVM Quake Virtual Machine Map Blueprint Summary\n`;
	outputBuffer += `========================================================================\n`;
	outputBuffer += `Binary Profile:       QVM v${header.magic === VM_MAGIC_VER2 ? '2' : '1'} (Quake III Compilation Segment)\n`;
	outputBuffer += `Program Core Bounds:  Offset Address: 0x${codeStart.toString(16).toUpperCase().padStart(4, '0')} (${header.codeLength} instruction bytes)\n`;
	outputBuffer += `Instruction Matrix:  ${header.instructionCount} structural program counter operations records\n`;
	outputBuffer += `Data Pool Bounds:     Linear Table Base: 0x${dataStart.toString(16).toUpperCase().padStart(4, '0')} (Data: ${header.dataLength} bytes, Literals: ${header.litLength} bytes)\n`;
	outputBuffer += `BSS Memory Segment:   Dynamic Uninitialized Allocation Pool: ${header.bssLength} bytes\n`;
	outputBuffer += `========================================================================\n\n`;
	outputBuffer += `Side-by-Side Unified Hex & Instruction Disassembly Window:\n`;
	outputBuffer += `------------------------------------------------------------------------\n`;

	// Initialize Viewport Windows
	let viewStart = (options.viewportStart !== null && options.viewportStart !== undefined) ? options.viewportStart : codeStart;
	let viewLength = options.viewportLength || 512;
	let endIdx = Math.min(sampleBytes.length, viewStart + viewLength);

	// Grid baseline synchronization
	viewStart = Math.floor(viewStart / rowWidth) * rowWidth;

	// =========================================================================
	// STEP 4: ADJUSTABLE MULTI-BYTE ROW PRINTING LOOP
	// =========================================================================
	for(let rowAddr = viewStart; rowAddr < endIdx; rowAddr += rowWidth)
	{
		let chunkBytes = [];
		for(let offset = 0; offset < rowWidth; offset++)
		{
			if(rowAddr + offset < sampleBytes.length)
			{
				chunkBytes.push(sampleBytes[rowAddr + offset]);
			}
		}

		let trueGlobalAddress = globalOffset + rowAddr;
		let addrLabel = `0x${trueGlobalAddress.toString(16).padStart(4, '0').toUpperCase()}`;

		let hexString = chunkBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(" ");
		let paddedHexColumn = hexString.padEnd((rowWidth * 3) - 1, ' ');
		let asciiPreview = chunkBytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join("");

		let annotation = "";

		// Check active layout target ranges
		const isRowInCode = (trueGlobalAddress >= codeStart && trueGlobalAddress < codeEnd);
		const isRowInLit = (trueGlobalAddress >= litStart && trueGlobalAddress < litEnd);

		if(isRowInCode)
		{
			let rowInstructions = [];
			let i = 0;

			while(i < chunkBytes.length)
			{
				let currentByteOffset = trueGlobalAddress + i;

				// Keep lookahead tracking synchronized cleanly with our compiled instruction registry pointer bounds
				if(!instructionPointers.includes(currentByteOffset))
				{
					i++;
					continue;
				}

				let opcode = chunkBytes[i];
				if(opcode < QVM_OPCODES.length)
				{
					let definition = QVM_OPCODES[opcode];
					let mnemonic = definition.name;
					let argumentText = "";

					// Decode active parameter blocks inside this row chunk window frame
					if(definition.argLen > 0 && (i + definition.argLen < chunkBytes.length))
					{
						let argFileOffset = currentByteOffset + 1;
						let rawArgValue = 0;

						if(definition.type === 'u4') rawArgValue = readU4(argFileOffset);
						else if(definition.type === 'i4') rawArgValue = readI4(argFileOffset);
						else if(definition.type === 'f4') rawArgValue = readF4(argFileOffset);
						else if(definition.type === 'u1') rawArgValue = readU1(argFileOffset);

						argumentText = ` 0x${rawArgValue.toString(16).toUpperCase()}`;

						// ─── RUNTIME CONTEXT RESOLUTION ───
						// Lookahead Evaluation A: If CONST instruction is tied to an exit CALL
						if(opcode === 8)
						{
							let nextInstructionOffset = currentByteOffset + 5;
							if(nextInstructionOffset < sampleBytes.length && readU1(nextInstructionOffset) === 5)
							{
								if(rawArgValue > 0x7FFFFFFF)
								{
									// Signed two's complement interpretation mapping to trap syscall boundaries
									let syscallNum = view.getInt32(argFileOffset, true);
									let callName = syscallMap[syscallNum] || `unknown_syscall_${syscallNum}`;
									argumentText += ` [${callName}]`;
								} else if(procedureNamesMap[rawArgValue])
								{
									argumentText += ` [${procedureNamesMap[rawArgValue]}]`;
								}
							}
							// Lookahead Evaluation B: Evaluate reference targets crossing inside our literal tables
							else if(rawArgValue >= dataLength && rawArgValue < (dataLength + header.litLength))
							{
								let literalStringOffset = rawArgValue - dataLength;
								let stringBuffer = [];
								for(let sIdx = literalStringOffset; sIdx < header.litLength; sIdx++)
								{
									let charByte = sampleBytes[litStart + sIdx];
									if(charByte === 0) break;
									stringBuffer.push(String.fromCharCode(charByte));
								}
								if(stringBuffer.length > 0)
								{
									argumentText += ` ["${stringBuffer.join("")}"]`;
								}
							}
						}

						i += definition.argLen; // Shift pointer path past structural parameter registers
					}

					// Append entry labels inside instruction view streams automatically
					if(procedureNamesMap[currentByteOffset])
					{
						mnemonic = `\n${procedureNamesMap[currentByteOffset]}:\n              ${mnemonic}`;
					}

					rowInstructions.push(`${mnemonic}${argumentText}`);
				} else
				{
					rowInstructions.push(`ILLEGAL_0x${opcode.toString(16).toUpperCase()}`);
				}
				i++;
			}
			annotation = `ASM: ${rowInstructions.join(" -> ")}`;
		}
		else if(isRowInLit)
		{
			annotation = `STR-LIT: "${asciiPreview.replace(/\.+/g, ' ').trim()}"`;
		}
		else
		{
			let layoutTag = "STRUCT";
			if(trueGlobalAddress === 0) layoutTag = "HEADER";
			else if(trueGlobalAddress >= dataStart && trueGlobalAddress < dataEnd) layoutTag = "DATA-SEG";

			annotation = `${layoutTag}: [ ${asciiPreview} ]`;
		}

		outputBuffer += `${addrLabel}:  ${paddedHexColumn} | ${asciiPreview} | ; ${annotation}\n`;
	}

	return outputBuffer;
}

/**
 * Advanced Stream-Safe WebAssembly Disassembler & Hex Matrix
 *
 * @param {Uint8Array} sampleBytes - The active chunk of bytes loaded into memory
 * @param {number} rowWidth - Display width layout grid columns (8 or 16)
 * @param {Object} options - Configuration adjustments for windowing and overrides
 * @param {number} options.globalOffset - The real file index where this byte slice starts
 * @param {string} options.forceMode - Manual override: 'asm' | 'data' | 'metadata' | 'auto'
 * @param {number} options.codeStart - Pre-calculated Code Section start from a full file scan
 * @param {number} options.codeLength - Pre-calculated Code Section length
 * @param {number} options.dataStart - Pre-calculated Data Section start
 * @param {number} options.dataLength - Pre-calculated Data Section length
 */
export function renderWasmDisassemblyPrintout(sampleBytes, rowWidth = 16, options = {})
{
	// 1. Default fallback parameters for stream synchronization
	const globalOffset = options.globalOffset || 0;
	const forceMode = options.forceMode || 'auto';

	let codeSectionStart = options.codeStart !== undefined ? options.codeStart : -1;
	let codeSectionLength = options.codeLength || 0;
	let dataSectionStart = options.dataStart !== undefined ? options.dataStart : -1;
	let dataSectionLength = options.dataLength || 0;

	// 2. Only run internal scanning pass if we are in 'auto' mode and haven't passed presets
	if(forceMode === 'auto' && codeSectionStart === -1)
	{
		let ptr = 8;
		while(ptr < sampleBytes.length)
		{
			if(ptr + 1 > sampleBytes.length) break;
			const sectionId = sampleBytes[ptr];
			ptr += 1;
			const lengthDecode = decodeLEB128(sampleBytes, ptr);
			const sectionLength = lengthDecode.value;
			ptr += lengthDecode.bytes;

			if(sectionId === 10)
			{
				codeSectionStart = ptr + globalOffset;
				codeSectionLength = sectionLength;
			} else if(sectionId === 11)
			{
				dataSectionStart = ptr + globalOffset;
				dataSectionLength = sectionLength;
			}
			ptr += sectionLength;
		}
	}

	let outputBuffer = "";

	// =========================================================================
	// STEP 4: ADJUSTABLE MULTI-BYTE ROW PRINTING LOOP
	// =========================================================================
	for(let rowAddr = 0; rowAddr < sampleBytes.length; rowAddr += rowWidth)
	{
		let chunkBytes = [];
		for(let offset = 0; offset < rowWidth; offset++)
		{
			if(rowAddr + offset < sampleBytes.length)
			{
				chunkBytes.push(sampleBytes[rowAddr + offset]);
			}
		}

		// Calculate the TRUE global file address instead of local array address
		let trueGlobalRowAddress = globalOffset + rowAddr;
		let addrLabel = `0x${trueGlobalRowAddress.toString(16).padStart(4, '0').toUpperCase()}`;

		let hexString = chunkBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(" ");
		let paddedHexColumn = hexString.padEnd((rowWidth * 3) - 1, ' ');
		let asciiPreview = chunkBytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join("");

		let annotation = "";

		// Determine context layout profile by resolving manual flags vs dynamic memory ranges
		let currentMode = forceMode;
		if(currentMode === 'auto')
		{
			if(trueGlobalRowAddress >= codeSectionStart && trueGlobalRowAddress < (codeSectionStart + codeSectionLength))
			{
				currentMode = 'asm';
			} else if(trueGlobalRowAddress >= dataSectionStart && trueGlobalRowAddress < (dataSectionStart + dataSectionLength))
			{
				currentMode = 'data';
			} else
			{
				currentMode = 'metadata';
			}
		}

		// ─── RENDERING EXECUTION PIPELINES ───
		if(currentMode === 'asm')
		{
			let rowInstructions = [];
			let i = 0;
			while(i < chunkBytes.length)
			{
				let byteVal = chunkBytes[i];
				if(WASM_OPCODES[byteVal] !== undefined)
				{
					let mnemonics = WASM_OPCODES[byteVal];
					if(byteVal === 0x41 || byteVal === 0x20 || byteVal === 0x21 || byteVal === 0x10)
					{
						if(i + 1 < chunkBytes.length)
						{
							mnemonics += ` 0x${chunkBytes[i + 1].toString(16).toUpperCase()}`;
							i += 1;
						}
					}
					rowInstructions.push(mnemonics);
				} else
				{
					rowInstructions.push(`0x${byteVal.toString(16).toUpperCase()}`);
				}
				i++;
			}
			annotation = `ASM: ${rowInstructions.join(" -> ")}`;
		}
		else if(currentMode === 'data')
		{
			annotation = `STR: "${asciiPreview.replace(/\.+/g, ' ').trim()}"`;
		}
		else
		{
			annotation = `METADATA: [ ${asciiPreview} ]`;
		}

		outputBuffer += `${addrLabel}:  ${paddedHexColumn} | ${asciiPreview} | ; ${annotation}\n`;
	}

	return outputBuffer;
}


/**
 * Extracts comprehensive WebAssembly structural execution metrics and
 * instantiation maps to output a high-density runtime telemetry header block.
 * Optimized for production/final compiled executables.
 *
 * @param {Uint8Array} sampleBytes - Raw application binary array buffer workspace.
 * @param {string|Uint8Array} content - The file context stream data wrapper.
 * @param {string} filePath - Path identifier of the active workspace file.
 */
export function getWasmFinalHeader(sampleBytes, content, filePath)
{
	const isWasm = sampleBytes[0] === 0x00 && sampleBytes[1] === 0x61 && sampleBytes[2] === 0x73 && sampleBytes[3] === 0x6D;

	let infoStack = `WASM Production Executable Blueprint (${content.length} bytes)\n`;
	infoStack += `========================================================================\n`;

	if(isWasm && sampleBytes.length >= 8)
	{
		const view = new DataView(sampleBytes.buffer, sampleBytes.byteOffset, sampleBytes.byteLength);
		const wasmVersion = view.getUint32(4, true);

		// Core Architectural Section Sizes (Bytes)
		let typeLength = 0;
		let importLength = 0;
		let funcSignaturesLength = 0;
		let tableLength = 0;
		let memoryLength = 0;
		let globalLength = 0;
		let exportLength = 0;
		let startLength = 0;
		let elementLength = 0;
		let codeLength = 0;
		let dataLength = 0;
		let dataCountLength = 0;
		let customLength = 0;

		// Runtime Instantiation Telemetry
		let totalTypesCount = 0;
		let importedSymbolsCount = 0;
		let exportedSymbolsCount = 0;
		let compiledFunctionsCount = 0;
		let tableElementsCount = 0;
		let globalVariablesCount = 0;
		let dataSegmentsCount = 0;

		// Final Binary Entry Target (-1 indicates instantiation-only module)
		let executionEntryPointIdx = -1;

		// Telemetry List Registries
		const requestedImports = [];
		const exportedSymbols = [];
		const localFunctionNames = [];
		const dataStrings = [];

		let ptr = 8;
		const totalBytes = sampleBytes.length;

		// Linear Executable Stream Parsing Loop
		while(ptr < totalBytes)
		{
			if(ptr + 1 > totalBytes) break;

			const sectionId = sampleBytes[ptr];
			ptr += 1;

			const lengthDecode = decodeLEB128(sampleBytes, ptr);
			const sectionLength = lengthDecode.value;
			ptr += lengthDecode.bytes;

			const sectionEnd = ptr + sectionLength;
			if(sectionEnd > totalBytes) break;

			switch(sectionId)
			{
				case 0: // Custom Section Engine (Preserves debug names if unstripped)
					customLength += sectionLength;
					{
						const nameLenDec = decodeLEB128(sampleBytes, ptr);
						let namePtr = ptr + nameLenDec.bytes;
						let sectionName = "";
						for(let i = 0; i < Math.min(nameLenDec.value, 64); i++)
						{
							sectionName += String.fromCharCode(sampleBytes[namePtr + i]);
						}

						if(sectionName === "name")
						{
							let nameSubPtr = namePtr + nameLenDec.value;
							while(nameSubPtr < sectionEnd)
							{
								const subId = sampleBytes[nameSubPtr];
								nameSubPtr += 1;
								const subLenDec = decodeLEB128(sampleBytes, nameSubPtr);
								nameSubPtr += subLenDec.bytes;
								const subEnd = nameSubPtr + subLenDec.value;

								if(subId === 1)
								{ // Function Names Sub-subsection
									const numNamesDec = decodeLEB128(sampleBytes, nameSubPtr);
									nameSubPtr += numNamesDec.bytes;
									for(let k = 0; k < Math.min(numNamesDec.value, 15); k++)
									{
										if(nameSubPtr >= subEnd) break;
										const fnIdxDec = decodeLEB128(sampleBytes, nameSubPtr);
										nameSubPtr += fnIdxDec.bytes;
										const fnNameLenDec = decodeLEB128(sampleBytes, nameSubPtr);
										nameSubPtr += fnNameLenDec.bytes;

										let fnName = "";
										for(let n = 0; n < fnNameLenDec.value; n++)
										{
											fnName += String.fromCharCode(sampleBytes[nameSubPtr + n]);
										}
										nameSubPtr += fnNameLenDec.value;
										localFunctionNames.push(`Index ${fnIdxDec.value} -> "${fnName}"`);
									}
								}
								nameSubPtr = subEnd;
							}
						}
					}
					break;

				case 1: // Type definitions
					typeLength += sectionLength;
					totalTypesCount = decodeLEB128(sampleBytes, ptr).value;
					break;

				case 2: // Imports Section (FIXED LIMITS DESERIALIZER)
					importLength += sectionLength;
					{
						let sPtr = ptr;
						const countDecode = decodeLEB128(sampleBytes, sPtr);
						importedSymbolsCount = countDecode.value;
						sPtr += countDecode.bytes;

						for(let i = 0; i < importedSymbolsCount; i++)
						{
							const modLenDec = decodeLEB128(sampleBytes, sPtr); sPtr += modLenDec.bytes;
							let modName = "";
							for(let j = 0; j < modLenDec.value; j++) modName += String.fromCharCode(sampleBytes[sPtr + j]);
							sPtr += modLenDec.value;

							const fieldLenDec = decodeLEB128(sampleBytes, sPtr); sPtr += fieldLenDec.bytes;
							let fieldName = "";
							for(let j = 0; j < fieldLenDec.value; j++) fieldName += String.fromCharCode(sampleBytes[sPtr + j]);
							sPtr += fieldLenDec.value;

							const importKind = sampleBytes[sPtr]; sPtr += 1;
							const kindLabel = importKind === 0x00 ? "Fn" : importKind === 0x01 ? "Table" : importKind === 0x02 ? "Mem" : "Global";

							requestedImports.push(`${modName}.${fieldName} (${kindLabel})`);

							if(importKind === 0x00)
							{
								const idxDec = decodeLEB128(sampleBytes, sPtr); sPtr += idxDec.bytes;
							} else if(importKind === 0x03)
							{
								const idxDec = decodeLEB128(sampleBytes, sPtr); sPtr += idxDec.bytes;
								sPtr += 1; // Mutability byte
							} else if(importKind === 0x01 || importKind === 0x02)
							{
								if(importKind === 0x01) sPtr += 1; // Element Type
								const flags = sampleBytes[sPtr]; sPtr += 1;
								const initialDec = decodeLEB128(sampleBytes, sPtr); sPtr += initialDec.bytes;
								if((flags & 1) === 1)
								{
									const maxDec = decodeLEB128(sampleBytes, sPtr); sPtr += maxDec.bytes;
								}
							}
						}
					}
					break;

				case 3: // Function Signatures Index
					funcSignaturesLength += sectionLength;
					compiledFunctionsCount = decodeLEB128(sampleBytes, ptr).value;
					break;

				case 4: tableLength += sectionLength; break;
				case 5: memoryLength += sectionLength; break;

				case 6: // Global Section (FIXED EXPRESSION PARSER)
					globalLength += sectionLength;
					{
						let sPtr = ptr;
						const countDecode = decodeLEB128(sampleBytes, sPtr);
						globalVariablesCount = countDecode.value;
						sPtr += countDecode.bytes;

						// Safely step over initialization vector bytecode structures
						for(let i = 0; i < globalVariablesCount; i++)
						{
							sPtr += 2; // Step past Content Value Type and Mutability flag bytes
							while(sampleBytes[sPtr] !== 0x0B && sPtr < sectionEnd)
							{
								sPtr++;
							}
							sPtr += 1; // Leap past explicit 0x0B initialization termination marker
						}
					}
					break;

				case 7: // Exports Section (STABILIZED STRUCTURAL ROUTING)
					exportLength += sectionLength;
					{
						let sPtr = ptr;
						const countDecode = decodeLEB128(sampleBytes, sPtr);
						exportedSymbolsCount = countDecode.value;
						sPtr += countDecode.bytes;

						for(let i = 0; i < exportedSymbolsCount; i++)
						{
							const nameLenDec = decodeLEB128(sampleBytes, sPtr); sPtr += nameLenDec.bytes;
							let expName = "";
							for(let j = 0; j < nameLenDec.value; j++) expName += String.fromCharCode(sampleBytes[sPtr + j]);
							sPtr += nameLenDec.value;

							const kind = sampleBytes[sPtr]; sPtr += 1;
							const idxDec = decodeLEB128(sampleBytes, sPtr); sPtr += idxDec.bytes;

							const kindLabel = kind === 0 ? "Fn" : kind === 1 ? "Table" : kind === 2 ? "Mem" : "Global";

							if(expName === "vmMain" || expName === "dllEntry")
							{
								exportedSymbols.push(`\x1b[33m${expName}\x1b[0m [Index ${idxDec.value} - ${kindLabel}]`);
							} else
							{
								exportedSymbols.push(`${expName} [Index ${idxDec.value} - ${kindLabel}]`);
							}
						}
					}
					break;

				case 8: // START SECTION (CRITICAL ENTRY POINT REGISTER FOR EXECUTABLES)
					startLength += sectionLength;
					executionEntryPointIdx = decodeLEB128(sampleBytes, ptr).value;
					break;

				case 9: // Element Table Segments (Indirect Call Vector Tables)
					elementLength += sectionLength;
					tableElementsCount = decodeLEB128(sampleBytes, ptr).value;
					break;

				case 10: // Code Execution Section
					codeLength += sectionLength;
					break;

				case 11: // Linear Data Strings Section
					dataLength += sectionLength;
					{
						let sPtr = ptr;
						const countDecode = decodeLEB128(sampleBytes, sPtr);
						dataSegmentsCount = countDecode.value;
						sPtr += countDecode.bytes;

						for(let i = 0; i < dataSegmentsCount; i++)
						{
							if(sampleBytes[sPtr] <= 2) sPtr += 1; // Flags byte
							while(sampleBytes[sPtr] !== 0x0B && sPtr < sectionEnd) sPtr++;
							sPtr += 1; // Leap past execution break byte

							const sizeDec = decodeLEB128(sampleBytes, sPtr);
							sPtr += sizeDec.bytes;

							let strAccumulator = "";
							for(let j = 0; j < sizeDec.value; j++)
							{
								const charCode = sampleBytes[sPtr + j];
								if(charCode >= 32 && charCode <= 126)
								{
									strAccumulator += String.fromCharCode(charCode);
								}
							}
							if(strAccumulator.trim().length > 2)
							{
								dataStrings.push(strAccumulator.trim());
							}
							sPtr += sizeDec.value;
						}
					}
					break;
				case 14: dataCountLength += sectionLength; break;
			}

			ptr = sectionEnd;
		}

		// =========================================================================
		// COMPILING GRAPHICAL HIGH-DENSITY SCANNABLE SYMBOLS OUTPUT
		// =========================================================================
		infoStack += `Output Filename:     ${filePath}\n`;
		infoStack += `Binary File Profile: WASM v${wasmVersion} (Instantiated Production Executable Module)\n`;
		infoStack += `Execution Blueprint: Fully Bound Machine Environment Pipeline\n`;
		infoStack += `------------------------------------------------------------------------\n`;
		infoStack += `Code Segment size:    ${codeLength.toString().padEnd(10)} bytes (${compiledFunctionsCount} execution routine tracks)\n`;
		infoStack += `Data Segment size:    ${dataLength.toString().padEnd(10)} bytes (${dataSegmentsCount} linear segment data tables)\n`;
		infoStack += `Type Register size:   ${typeLength.toString().padEnd(10)} bytes (${totalTypesCount} explicit parameter validation signatures)\n`;
		infoStack += `Import Payload size:  ${importLength.toString().padEnd(10)} bytes (${importedSymbolsCount} host infrastructure hooks)\n`;
		infoStack += `Export Payload size:  ${exportLength.toString().padEnd(10)} bytes (${exportedSymbolsCount} mapped API entrance gates)\n`;
		infoStack += `Global Space size:    ${globalLength.toString().padEnd(10)} bytes (${globalVariablesCount} internal program variables)\n`;
		infoStack += `Indirect Call Tables: ${elementLength.toString().padEnd(10)} bytes (${tableElementsCount} dynamic call dispatch vectors)\n`;

		infoStack += `------------------------------------------------------------------------\n`;

		// Explicit Entry Point Reporting
		infoStack += `MODULE RUNTIME INITIALIZATION TARGET:\n`;
		if(executionEntryPointIdx !== -1)
		{
			infoStack += `  >> entry-point: function code registry index [ ${executionEntryPointIdx} ] (Auto-executes on instantiation)\n`;
		} else
		{
			infoStack += `  (No manual entry block; module initializes state allocations selectively)\n`;
		}
		infoStack += `------------------------------------------------------------------------\n`;

		// Imports Mapping Block
		infoStack += `IMPORTED ATTACHMENT HOOKS (ENVIRONMENT DEPENDENCIES):\n`;
		if(requestedImports.length > 0)
		{
			requestedImports.forEach(imp => infoStack += `  -> link: ${imp}\n`);
		} else
		{
			infoStack += `  (Self-contained application context; zero host imports verified)\n`;
		}
		infoStack += `------------------------------------------------------------------------\n`;

		// Exports Mapping Block (OPTIMIZED WITH Q3 BOUNDARY CHECK)
		infoStack += `EXPORTED ACCESS SYMBOLS (PUBLIC INTERFACE HOOKS):\n`;
		if(exportedSymbols.length > 0)
		{
			const hasVmMain = exportedSymbols.some(e => e.includes("vmMain"));
			const hasDllEntry = exportedSymbols.some(e => e.includes("dllEntry"));

			infoStack += `  [ Q3 INTERFACE STATUS: vmMain -> ${hasVmMain ? "✔ FOUND" : "✘ MISSING"} | dllEntry -> ${hasDllEntry ? "✔ FOUND" : "✘ MISSING"} ]\n`;

			const engineHooks = exportedSymbols.filter(e => e.includes("vmMain") || e.includes("dllEntry"));
			const standardHooks = exportedSymbols.filter(e => !e.includes("vmMain") && !e.includes("dllEntry"));

			// Put critical logic entries right at the top
			engineHooks.forEach(exp => infoStack += `  ★ export: ${exp}\n`);

			// Render a subset of standard entries so your console doesn't crawl
			standardHooks.slice(0, 10).forEach(exp => infoStack += `  => export: ${exp}\n`);
			if(standardHooks.length > 10)
			{
				infoStack += `  ... and ${standardHooks.length - 10} other structural system interface gates.\n`;
			}
		} else
		{
			infoStack += `  (Encapsulated context binary; structural access signatures hidden)\n`;
		}

		// Local Function Names Debug Maps
		if(localFunctionNames.length > 0)
		{
			infoStack += `------------------------------------------------------------------------\n`;
			infoStack += `PRESERVED COMPILED FUNCTION STRINGS (DEBUG SYMBOLS):\n`;
			localFunctionNames.forEach(lbl => infoStack += `  :: symbol: ${lbl}\n`);
			if(localFunctionNames.length >= 15) infoStack += `  ... and trailing unstripped functional string entries.\n`;
		}

		// Data Table String Literals
		if(dataStrings.length > 0)
		{
			infoStack += `------------------------------------------------------------------------\n`;
			infoStack += `EXTRACTED HARDCODED CONSTANT LITERAL POOLS:\n`;
			dataStrings.slice(0, 10).forEach(str => infoStack += `  " ${str} "\n`);
			if(dataStrings.length > 10) infoStack += `  ... and ${dataStrings.length - 10} other memory pool literals.\n`;
		}

		infoStack += `========================================================================\n`;
		infoStack += `Status:               Successfully compiled standalone runtime layout map.\n`;
	} else
	{
		infoStack += `Format:               Unknown Raw Non-WASM Binary Payload\n`;
	}

	return infoStack;
}

/**
 * Consolidated WebAssembly Binary Analysis & Side-by-Side Disassembly Suite
 * Fully optimized to handle streaming chunk truncations on large final production binaries.
 */
export function renderWasmDisassembly(sampleBytes, rowWidth = 16, viewportStart = null, viewportLength = null, codeStart = null, codeLength = null, dataStart = null, dataLength = null)
{
	const isWasm = sampleBytes[0] === 0x00 && sampleBytes[1] === 0x61 && sampleBytes[2] === 0x73 && sampleBytes[3] === 0x6D;
	if(!isWasm)
	{
		return "Error: Targeted stream does not contain a valid WebAssembly magic header.";
	}

	let wasmVersion = 1;
	if(sampleBytes.length >= 8)
	{
		const view = new DataView(sampleBytes.buffer, sampleBytes.byteOffset, sampleBytes.byteLength);
		wasmVersion = view.getUint32(4, true);
	}

	// Initialize layout positions using passed presets or default floors
	let codeSectionStart = (codeStart !== null && codeStart !== undefined) ? codeStart : -1;
	let codeSectionLength = codeLength || 0;
	let dataSectionStart = (dataStart !== null && dataStart !== undefined) ? dataStart : -1;
	let dataSectionLength = dataLength || 0;

	// Structural metric registries
	let typeSignaturesCount = 0;
	let importedGlobalsCount = 0;
	let importedFunctionsCount = 0;
	let compiledFunctionsCount = 0;
	let exportedSymbolsCount = 0;
	let isRelocatableObject = false;

	// =========================================================================
	// STEP 1: SINGLE RESILIENT STRUCTURAL SCAN PASS
	// =========================================================================
	let ptr = 8;
	const totalBytes = sampleBytes.length;

	while(ptr < totalBytes)
	{
		if(ptr + 1 > totalBytes) break;
		const sectionId = sampleBytes[ptr];
		ptr += 1;

		const lengthDecode = decodeLEB128(sampleBytes, ptr);
		if(!lengthDecode || (ptr + lengthDecode.bytes) > totalBytes) break;

		const sectionLength = lengthDecode.value;
		ptr += lengthDecode.bytes;

		// CRITICAL: Register the section coordinates FIRST before checking chunk truncation boundaries!
		switch(sectionId)
		{
			case 0:
				const nameLenDec = decodeLEB128(sampleBytes, ptr);
				if(nameLenDec && (ptr + nameLenDec.bytes <= totalBytes))
				{
					let namePtr = ptr + nameLenDec.bytes;
					let sectionName = "";
					for(let i = 0; i < Math.min(nameLenDec.value, 12); i++)
					{
						if(namePtr + i < totalBytes) sectionName += String.fromCharCode(sampleBytes[namePtr + i]);
					}
					if(sectionName === "linking" || sectionName.startsWith("reloc."))
					{
						isRelocatableObject = true;
					}
				}
				break;
			case 1:
				typeSignaturesCount = sectionLength > 0 ? decodeLEB128(sampleBytes, ptr).value : 0;
				break;
			case 2:
				if(sectionLength > 0)
				{
					let impPtr = ptr;
					const impCountDec = decodeLEB128(sampleBytes, impPtr);
					if(impCountDec)
					{
						impPtr += impCountDec.bytes;
						for(let i = 0; i < impCountDec.value; i++)
						{
							if(impPtr >= totalBytes) break;
							const modLen = decodeLEB128(sampleBytes, impPtr); if(!modLen) break; impPtr += modLen.bytes + modLen.value;
							const fldLen = decodeLEB128(sampleBytes, impPtr); if(!fldLen) break; impPtr += fldLen.bytes + fldLen.value;
							if(impPtr >= totalBytes) break;
							const kind = sampleBytes[impPtr]; impPtr += 1;
							if(kind === 0x00) importedFunctionsCount++;
							else if(kind === 0x03) importedGlobalsCount++;
							else
							{
								const lim = decodeLEB128(sampleBytes, impPtr); if(lim) impPtr += lim.bytes;
								const init = decodeLEB128(sampleBytes, impPtr); if(init) impPtr += init.bytes;
							}
						}
					}
				}
				break;
			case 3:
				compiledFunctionsCount = sectionLength > 0 ? decodeLEB128(sampleBytes, ptr).value : 0;
				break;
			case 7:
				exportedSymbolsCount = sectionLength > 0 ? decodeLEB128(sampleBytes, ptr).value : 0;
				break;
			case 10: // CODE
				if(codeSectionStart === -1)
				{
					codeSectionStart = ptr;
					codeSectionLength = sectionLength;
				}
				break;
			case 11: // DATA
				if(dataSectionStart === -1)
				{
					dataSectionStart = ptr;
					dataSectionLength = sectionLength;
				}
				break;
		}

		// Safe leap checking: If this section trails past our current streaming window chunk,
		// we have already saved its coordinates, so we can cleanly break safely.
		const sectionEnd = ptr + sectionLength;
		if(sectionEnd > totalBytes)
		{
			break;
		}
		ptr = sectionEnd;
	}

	// =========================================================================
	// STEP 2: METADATA SUMMARY HEADER GENERATION
	// =========================================================================
	let outputBuffer = `WASM Executable Map Summary\n`;
	outputBuffer += `========================================================================\n`;
	outputBuffer += `Binary Profile:       WASM v${wasmVersion} (${isRelocatableObject ? "Relocatable Object File" : "Linked Executable Module"})\n`;
	outputBuffer += `Program Core Bounds:  Offset Address: 0x${codeSectionStart !== -1 ? codeSectionStart.toString(16).toUpperCase().padStart(4, '0') : "UNKNOWN"} (${codeSectionLength} raw payload bytes)\n`;
	outputBuffer += `Instruction Matrix:  ${compiledFunctionsCount} compiled structural function blocks context\n`;
	outputBuffer += `Import Assertions:   ${importedFunctionsCount} dynamic external calls, ${importedGlobalsCount} global memory offsets\n`;
	outputBuffer += `Export Accessors:    ${exportedSymbolsCount} mapped system interface entry gates\n`;
	outputBuffer += `========================================================================\n\n`;
	outputBuffer += `Side-by-Side Unified Hex & Instruction Disassembly Window:\n`;
	outputBuffer += `------------------------------------------------------------------------\n`;

	// =========================================================================
	// STEP 3: VIEWPORT LIMIT ALIGNMENTS
	// =========================================================================
	let startIdx = (viewportStart !== null) ? viewportStart : (codeSectionStart !== -1 ? codeSectionStart : 0);
	let calculatedLength = (viewportLength !== null) ? viewportLength : sampleBytes.length;
	let endIdx = Math.min(sampleBytes.length, startIdx + calculatedLength);

	startIdx = Math.floor(startIdx / rowWidth) * rowWidth;

	// =========================================================================
	// STEP 4: ADJUSTABLE MULTI-BYTE ROW PRINTING LOOP (PER-BYTE CONTEXT EVAL)
	// =========================================================================
	for(let rowAddr = startIdx; rowAddr < endIdx; rowAddr += rowWidth)
	{
		let chunkBytes = [];
		for(let offset = 0; offset < rowWidth; offset++)
		{
			if(rowAddr + offset < sampleBytes.length)
			{
				chunkBytes.push(sampleBytes[rowAddr + offset]);
			}
		}

		let addrLabel = `0x${rowAddr.toString(16).padStart(4, '0').toUpperCase()}`;
		let hexString = chunkBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(" ");
		let paddedHexColumn = hexString.padEnd((rowWidth * 3) - 1, ' ');
		let asciiPreview = chunkBytes.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join("");

		let rowInterpretations = [];
		let rowTypeTag = "META"; // Baseline line classification symbol
		let i = 0;

		while(i < chunkBytes.length)
		{
			let globalByteAddr = rowAddr + i;
			let byteVal = chunkBytes[i];

			const isByteInCode = (globalByteAddr >= codeSectionStart && globalByteAddr < (codeSectionStart + codeSectionLength));
			const isByteInData = (globalByteAddr >= dataSectionStart && globalByteAddr < (dataSectionStart + dataSectionLength));

			if(isByteInCode)
			{
				rowTypeTag = "ASM"; // Promote line tag classification if instructions are active
				if(WASM_OPCODES[byteVal] !== undefined)
				{
					let mnemonic = WASM_OPCODES[byteVal];
					if(byteVal === 0x41 || byteVal === 0x20 || byteVal === 0x21 || byteVal === 0x10)
					{
						if(i + 1 < chunkBytes.length)
						{
							mnemonic += ` 0x${chunkBytes[i + 1].toString(16).toUpperCase()}`;
							i += 1; // Step past consumed immediate parameter argument byte
						}
					}
					rowInterpretations.push(mnemonic);
				} else
				{
					rowInterpretations.push(`0x${byteVal.toString(16).toUpperCase()}`);
				}
			} else if(isByteInData)
			{
				if(rowTypeTag !== "ASM") rowTypeTag = "STR"; // Set data pool view tag classification
				rowInterpretations.push(byteVal >= 32 && byteVal <= 126 ? `"${String.fromCharCode(byteVal)}"` : '.');
			} else
			{
				let segmentLabel = "STRUCT";
				if(globalByteAddr < 8) segmentLabel = "HEADER";
				else if(globalByteAddr < codeSectionStart) segmentLabel = "META";
				else segmentLabel = "LINK";

				rowInterpretations.push(`${segmentLabel}:0x${byteVal.toString(16).toUpperCase()}`);
			}
			i++;
		}

		// Outputs a uniform layout block complete with symbol classification tags
		outputBuffer += `${addrLabel}:  ${paddedHexColumn} | ${asciiPreview} | ; ${rowTypeTag}: [ ${rowInterpretations.join(" -> ")} ]\n`;
	}

	return outputBuffer;
}


/**
 * Advanced Q3 MD3 Model Binary Analysis & Disassembly Suite
 * Parses Quake 3 engine mesh files and produces a comprehensive structural blueprint dump.
 *
 * @param {Uint8Array|ArrayBuffer} sampleBytes - Raw model binary array buffer workspace
 * @param {string} filePath - Input path or label identifier for telemetry reporting
 * @returns {string} High-density diagnostic blueprint report
 */
export function renderMd3DisassemblySuite(sampleBytes, filePath = "model.md3")
{
	const bytes = sampleBytes instanceof Uint8Array ? sampleBytes : new Uint8Array(sampleBytes);

	if(bytes.length < 108)
	{
		return "Error: Invalid MD3 payload size (Below minimal 108-byte header threshold).";
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	// Primitive Little-Endian Readers
	const readU4 = (offset) => view.getUint32(offset, true);
	const readI4 = (offset) => view.getInt32(offset, true);
	const readF4 = (offset) => view.getFloat32(offset, true);
	const readI2 = (offset) => view.getInt16(offset, true);

	const readString = (offset, maxLen) =>
	{
		let str = "";
		for(let i = 0; i < maxLen; i++)
		{
			const charCode = bytes[offset + i];
			if(charCode === 0) break;
			str += String.fromCharCode(charCode);
		}
		return str.trim();
	};

	// =========================================================================
	// STEP 1: PARSE THE MD3 MAIN FILE HEADER
	// =========================================================================
	const magic = readString(0, 4); // Expected: "IDP3"
	if(magic !== "IDP3")
	{
		return `Error: Invalid MD3 file format profile signature (Got: '${magic}', expected 'IDP3').`;
	}

	const header = {
		version: readI4(4),           // Expected: 15
		name: readString(8, 64),
		flags: readI4(72),
		numFrames: readI4(76),
		numTags: readI4(80),
		numSurfaces: readI4(84),
		numSkins: readI4(88),
		ofsFrames: readI4(92),
		ofsTags: readI4(96),
		ofsSurfaces: readI4(100),
		ofsEnd: readI4(104)           // Total file size / EOF marker
	};

	// =========================================================================
	// STEP 2: CONSTRUCT FILE METADATA ARCHITECTURE BLOCK
	// =========================================================================
	let report = `Q3 MD3 Skeletal/Vertex Model Map Blueprint Summary\n`;
	report += `========================================================================\n`;
	report += `Output Filename:      ${filePath}\n`;
	report += `Binary File Profile:  MD3 v${header.version} (Quake III Arena Model Component Data)\n`;
	report += `Internal Model Name:  ${header.name || "(Unspecified Model Path Reference)"}\n`;
	report += `------------------------------------------------------------------------\n`;
	report += `Animation Frames:     ${header.numFrames.toString().padEnd(10)} records  (Offset pointer: 0x${header.ofsFrames.toString(16).toUpperCase().padStart(4, '0')})\n`;
	report += `Skeletal Tags:        ${header.numTags.toString().padEnd(10)} anchor vectors (Offset pointer: 0x${header.ofsTags.toString(16).toUpperCase().padStart(4, '0')})\n`;
	report += `Mesh Surface Soup:    ${header.numSurfaces.toString().padEnd(10)} subdivisions   (Offset pointer: 0x${header.ofsSurfaces.toString(16).toUpperCase().padStart(4, '0')})\n`;
	report += `Skin Target Tables:   ${header.numSkins.toString().padEnd(10)} references     (Total file boundary: ${header.ofsEnd} bytes)\n`;
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 3: PARSE AND EXTRACT ANIMATION FRAMES DIAGNOSTICS (56 Bytes / Frame)
	// =========================================================================
	report += `EXTRACTED ANIMATION AND BOUNDING BOX FRAMES:\n`;
	let framePtr = header.ofsFrames;

	for(let f = 0; f < header.numFrames; f++)
	{
		if(framePtr + 56 > bytes.length) break;

		const minX = readF4(framePtr + 0), minY = readF4(framePtr + 4), minZ = readF4(framePtr + 8);
		const maxX = readF4(framePtr + 12), maxY = readF4(framePtr + 16), maxZ = readF4(framePtr + 20);
		const originX = readF4(framePtr + 24), originY = readF4(framePtr + 28), originZ = readF4(framePtr + 32);
		const radius = readF4(framePtr + 36);
		const frameName = readString(framePtr + 40, 16);

		report += `  -> frame [Idx ${f.toString().padStart(2, '0')}]: "${frameName.padEnd(12)}"` +
			` | Box Min: [${minX.toFixed(2)}, ${minY.toFixed(2)}, ${minZ.toFixed(2)}]` +
			` | Box Max: [${maxX.toFixed(2)}, ${maxY.toFixed(2)}, ${maxZ.toFixed(2)}]` +
			` | Origin: [${originX.toFixed(2)}, ${originY.toFixed(2)}, ${originZ.toFixed(2)}]` +
			` | Radius: ${radius.toFixed(2)}\n`;

		framePtr += 56;
	}

	// =========================================================================
	// STEP 4: PARSE AND EXTRACT SURFACE GEOMETRY SUBDIVISIONS
	// =========================================================================
	let surfPtr = header.ofsSurfaces;
	for(let s = 0; s < header.numSurfaces; s++)
	{
		if(surfPtr + 140 > bytes.length) break;

		const surfMagic = readString(surfPtr, 4); // Expected: "MD3S"
		const surfName = readString(surfPtr + 4, 64);
		const surfFlags = readI4(surfPtr + 68);
		const surfNumFrames = readI4(surfPtr + 72);
		const surfNumShaders = readI4(surfPtr + 76);
		const surfNumVerts = readI4(surfPtr + 80);
		const surfNumTriangles = readI4(surfPtr + 84);

		const ofsTriangles = readI4(surfPtr + 88);
		const ofsShaders = readI4(surfPtr + 92);
		const ofsSt = readI4(surfPtr + 96);
		const ofsXyzNormal = readI4(surfPtr + 100);
		const ofsSurfEnd = readI4(surfPtr + 104);

		report += `------------------------------------------------------------------------\n`;
		report += `SURFACE OBJECT DETECTED [Idx ${s}]: "${surfName}" (Magic Verify: ${surfMagic})\n`;
		report += `  - Triangles Count:  ${surfNumTriangles.toString().padEnd(6)} | Vertices Count:   ${surfNumVerts}\n`;
		report += `  - Shader Reference: ${surfNumShaders.toString().padEnd(6)} | Tracked Frames:   ${surfNumFrames}\n`;
		report += `  - Topology Memory:  ${(ofsSurfEnd - ofsTriangles)} raw payload bytes\n`;

		// ─── Extract Shaders Assigned to this Mesh Surface ───
		if(surfNumShaders > 0)
		{
			report += `  - Active Material Pipeline Hooks:\n`;
			for(let sh = 0; sh < surfNumShaders; sh++)
			{
				const shaderPathOffset = surfPtr + ofsShaders + (sh * 68);
				const shaderName = readString(shaderPathOffset, 64);
				const shaderIndex = readI4(shaderPathOffset + 64);
				report += `     => material: "${shaderName}" [ID: ${shaderIndex}]\n`;
			}
		}

		// ─── Extract Triangle Index Buffer Soup ───
		report += `  - Triangle Mesh Index Connectivity Soup (First 5 Polygon Paths Layout):\n`;
		let triPtr = surfPtr + ofsTriangles;
		for(let tIdx = 0; tIdx < Math.min(surfNumTriangles, 5); tIdx++)
		{
			const v0 = readI4(triPtr + 0);
			const v1 = readI4(triPtr + 4);
			const v2 = readI4(triPtr + 8);
			report += `     => poly [Idx ${tIdx.toString().padStart(3, '0')}]: Vertices Indices Map Cluster -> (${v0}, ${v1}, ${v2})\n`;
			triPtr += 12;
		}
		if(surfNumTriangles > 5) report += `     ... and ${surfNumTriangles - 5} remaining index soup faces paths.\n`;

		// ─── Extract Local Vertex Coordinates (XYZ + Packed Normal Vectors) ───
		report += `  - Frame 0 Vertex Coordinates Sample (First 4 Spatial Grid Positions):\n`;
		let vertPtr = surfPtr + ofsXyzNormal; // Frame 0 positions start exactly here
		for(let vIdx = 0; vIdx < Math.min(surfNumVerts, 4); vIdx++)
		{
			// MD3 standard packs spatial offsets via a scaling integer constant 1/64
			const x = readI2(vertPtr + 0) * (1.0 / 64.0);
			const y = readI2(vertPtr + 2) * (1.0 / 64.0);
			const z = readI2(vertPtr + 4) * (1.0 / 64.0);

			// Unpack spherical normal angles encoded into the high 2 bytes
			const latEnc = bytes[vertPtr + 6];
			const lngEnc = bytes[vertPtr + 7];
			const lat = latEnc * (2.0 * Math.PI) / 255.0;
			const lng = lngEnc * (2.0 * Math.PI) / 255.0;

			const nx = Math.cos(lat) * Math.sin(lng);
			const ny = Math.sin(lat) * Math.sin(lng);
			const nz = Math.cos(lng);

			report += `     => vTX [Idx ${vIdx.toString().padStart(3, '0')}]: Pos: [${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)}]` +
				` | Normal Vector Direction: [${nx.toFixed(2)}, ${ny.toFixed(2)}, ${nz.toFixed(2)}]\n`;

			vertPtr += 8; // Each MD3 internal vertex structure is precisely 8 bytes
		}
		if(surfNumVerts > 4) report += `     ... and ${surfNumVerts - 4} alternate positioning coordinates tables for frame structures.\n`;

		surfPtr += ofsSurfEnd; // Jump straight through to next relative surface structure offset
	}

	report += `========================================================================\n`;
	report += `Status:               Successfully isolated model compilation tables.\n`;

	return report;
}

/**
 * Advanced Q3 BSP Map Binary Analysis & Disassembly Suite
 * Parses Quake 3 engine compiled map files and dumps structural lumps topology data.
 *
 * @param {Uint8Array|ArrayBuffer} sampleBytes - Raw BSP binary array buffer workspace
 * @param {string} filePath - Input path or label identifier for telemetry reporting
 * @returns {string} High-density diagnostic map blueprint report
 */
export function renderBspDisassemblySuite(sampleBytes, filePath = "map.bsp")
{
	const bytes = sampleBytes instanceof Uint8Array ? sampleBytes : new Uint8Array(sampleBytes);

	// Initial minimal footprint check (Header + 17 Directory Lumps = 8 + 17 * 8 = 144 bytes)
	if(bytes.length < 144)
	{
		return "Error: Invalid BSP payload size (Below structural 144-byte directory boundary threshold).";
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	// Primitive Little-Endian Readers
	const readU4 = (offset) => view.getUint32(offset, true);
	const readI4 = (offset) => view.getInt32(offset, true);
	const readF4 = (offset) => view.getFloat32(offset, true);

	const readString = (offset, maxLen) =>
	{
		let str = "";
		for(let i = 0; i < maxLen; i++)
		{
			if(offset + i >= bytes.length) break;
			const charCode = bytes[offset + i];
			if(charCode === 0) break;
			str += String.fromCharCode(charCode);
		}
		return str.trim();
	};

	// =========================================================================
	// STEP 1: PARSE THE IBSP CORE HEADER
	// =========================================================================
	const magic = readString(0, 4); // Expected: "IBSP"
	if(magic !== "IBSP")
	{
		return `Error: Invalid BSP layout signature profile (Got: '${magic}', expected 'IBSP').`;
	}

	const bspVersion = readI4(4); // Expected: 46 for Quake 3 Arena
	if(bspVersion !== 46)
	{
		return `Warning: Alternative BSP compilation version detected (Got: v${bspVersion}, expected v46). Proceeding with structural fallback analysis...`;
	}

	// =========================================================================
	// STEP 2: EXTRACT LUMPS DIRECTORY OFFSET STRUCTS
	// =========================================================================
	const lumpNames = [
		"Entities", "Shaders", "Planes", "Nodes", "Leafs", "LeafFaces",
		"LeafBrushes", "Models", "Brushes", "BrushSides", "Vertices",
		"MeshVerts", "Effects", "Faces", "Lightmaps", "LightVols", "VisData"
	];

	const lumps = [];
	let lumpPtr = 8; // Lumps list immediately follows magic + version

	for(let i = 0; i < 17; i++)
	{
		lumps.push({
			id: i,
			name: lumpNames[i],
			offset: readI4(lumpPtr),
			length: readI4(lumpPtr + 4)
		});
		lumpPtr += 8;
	}

	// Direct lookups for needed datasets
	const entLump = lumps[0];
	const shdLump = lumps[1];
	const vertLump = lumps[10];
	const meshLump = lumps[11];
	const faceLump = lumps[13];

	// =========================================================================
	// STEP 3: INITIAL FILE DIAGNOSTIC AND DIRECTORY TELEMETRY
	// =========================================================================
	let report = `Q3 BSP Compiled Map Structural Topology blueprint Summary\n`;
	report += `========================================================================\n`;
	report += `Output Map Location:  ${filePath}\n`;
	report += `Binary Layout Spec:   ${magic} v${bspVersion} (Quake III Arena Map Data Matrix)\n`;
	report += `Total Payload Volume: ${bytes.length} bytes\n`;
	report += `------------------------------------------------------------------------\n`;
	report += `LUMP DIRECTORY SCHEMATIC MAP:\n`;
	report += `ID  | Lump Identifier       | Hex Offset   | Block Size\n`;
	report += `----|-----------------------|--------------|------------\n`;
	lumps.forEach(l =>
	{
		const hOffset = "0x" + l.offset.toString(16).toUpperCase().padStart(8, '0');
		const bSize = l.length.toString().padStart(10) + " bytes";
		report += `${l.id.toString().padStart(2, '0')}  | ${l.name.padEnd(21)} | ${hOffset}   | ${bSize}\n`;
	});
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 4: SHADER METADATA EXTRACTOR (72 Bytes / Shader record)
	// =========================================================================
	report += `EXTRACTED SHADER PIPELINE HOOKS RESOURCE LIST:\n`;
	if(shdLump.length > 0 && shdLump.offset + shdLump.length <= bytes.length)
	{
		const totalShaders = shdLump.length / 72;
		report += `Total Unique Shaders Registered: ${totalShaders}\n`;

		let shdCursor = shdLump.offset;
		for(let s = 0; s < totalShaders; s++)
		{
			const shaderPath = readString(shdCursor, 64);
			const surfaceFlags = readI4(shdCursor + 64);
			const contentFlags = readI4(shdCursor + 68);

			report += `  -> Shader [Idx ${s.toString().padStart(3, '0')}]: "${shaderPath.padEnd(45)}" | Surf: 0x${surfaceFlags.toString(16).toUpperCase().padStart(8, '0')} | Content: 0x${contentFlags.toString(16).toUpperCase().padStart(8, '0')}\n`;
			shdCursor += 72;
		}
	} else
	{
		report += `  No valid shader reference records found or target lump out of bounds.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 5: POLYGON AND TRIANGLE TOPOLOGY EVALUATOR (104 Bytes / Face record)
	// =========================================================================
	report += `GEOMETRIC MESH SOUP AND TRIANGLE LAYOUT METRICS:\n`;
	if(faceLump.length > 0 && faceLump.offset + faceLump.length <= bytes.length)
	{
		const totalFaces = faceLump.length / 104;
		let totalMeshTriangles = 0;
		let polyFaces = 0, patchFaces = 0, meshFaces = 0, billboardFaces = 0;

		let faceCursor = faceLump.offset;
		for(let f = 0; f < totalFaces; f++)
		{
			const type = readI4(faceCursor + 8);
			const numMeshVerts = readI4(faceCursor + 24);

			if(type === 1) polyFaces++;
			if(type === 2) patchFaces++;
			if(type === 3)
			{
				meshFaces++;
				totalMeshTriangles += (numMeshVerts / 3); // Type 3 uses explicit index soup listings
			}
			if(type === 4) billboardFaces++;

			faceCursor += 104;
		}

		// Calculations for structural raw index counts
		const totalIndices = meshLump.length / 4;

		report += `Structural Faces Elements:  ${totalFaces} records calculated\n`;
		report += `  - Type 1 (Standard Polygons):  ${polyFaces}\n`;
		report += `  - Type 2 (Bézier Patches):     ${patchFaces}\n`;
		report += `  - Type 3 (Explicit Type Meshes): ${meshFaces}\n`;
		report += `  - Type 4 (Billboard Sprites):    ${billboardFaces}\n`;
		report += `Topology Indices Cluster:    ${totalIndices} elements registered inside MeshVerts array\n`;
		report += `Estimated Render Triangles:  ${Math.floor(totalIndices / 3)} implicit face partitions (Mesh Soup: ${totalMeshTriangles} discrete elements)\n`;
	} else
	{
		report += `  Unable to verify face arrays geometry boundaries. Target data block structural error.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 6: SAMPLE VECTOR AND SPACE COORDINATES (44 Bytes / Vertex record)
	// =========================================================================
	report += `VERTEX BUFFER ENTRY SAMPLE (First 5 Precise Vector Configurations):\n`;
	if(vertLump.length > 0 && vertLump.offset + vertLump.length <= bytes.length)
	{
		const totalVerts = vertLump.length / 44;
		report += `Total System Vertices: ${totalVerts} coordinates records available\n`;

		let vertCursor = vertLump.offset;
		const printSampleCount = Math.min(totalVerts, 5);

		for(let v = 0; v < printSampleCount; v++)
		{
			// XYZ Local Spatial Layout Positions
			const x = readF4(vertCursor + 0);
			const y = readF4(vertCursor + 4);
			const z = readF4(vertCursor + 8);

			// UV Material Texture coordinates mapping
			const u = readF4(vertCursor + 12);
			const t = readF4(vertCursor + 16);

			// Normal Vector Directions
			const nx = readF4(vertCursor + 28);
			const ny = readF4(vertCursor + 32);
			const nz = readF4(vertCursor + 36);

			report += `  => vTX [Idx ${v.toString().padStart(3, '0')}]: Pos: [${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]` +
				` | TexUV: [${u.toFixed(4)}, ${t.toFixed(4)}]` +
				` | Normal Vector: [${nx.toFixed(2)}, ${ny.toFixed(2)}, ${nz.toFixed(2)}]\n`;

			vertCursor += 44;
		}
		if(totalVerts > 5) report += `     ... and ${totalVerts - 5} alternate vertex tracking array structures left unlisted.\n`;
	} else
	{
		report += `  Vertex structure sampling unavailable. Loop bounds match error.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 7: RAW ENTITIES META STRING DUMP
	// =========================================================================
	report += `EXTRACTED ENTITIES SYSTEM MANIFEST POOL:\n`;
	if(entLump.length > 0 && entLump.offset + entLump.length <= bytes.length)
	{
		const rawEntityText = readString(entLump.offset, entLump.length);
		report += rawEntityText.replace(/\r/g, "") + "\n";
	} else
	{
		report += `  Entity layout data parsing skipped due to invalid structural bounds or blank lump.\n`;
	}

	report += `========================================================================\n`;
	report += `Status: Successfully isolated target BSP compilation data sectors.\n`;

	return report;
}


/**
 * Advanced Q3 AAS Bot Navigation Binary Analysis & Disassembly Suite
 * Parses Quake 3 engine compiled Area Awareness System (.aas) files and dumps
 * structural AI routing topology data.
 *
 * @param {Uint8Array|ArrayBuffer} sampleBytes - Raw AAS binary array buffer workspace
 * @param {string} filePath - Input path or label identifier for telemetry reporting
 * @returns {string} High-density diagnostic navigation blueprint report
 */
export function renderAasDisassemblySuite(sampleBytes, filePath = "botnav.aas")
{
	const bytes = sampleBytes instanceof Uint8Array ? sampleBytes : new Uint8Array(sampleBytes);

	// Initial minimal footprint check (Header + 14 Directory Lumps = 8 + 14 * 8 = 120 bytes)
	if(bytes.length < 120)
	{
		return "Error: Invalid AAS payload size (Below structural 120-byte directory boundary threshold).";
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	// Primitive Little-Endian Readers
	const readU4 = (offset) => view.getUint32(offset, true);
	const readU2 = (offset) => view.getUint16(offset, true);
	const readI4 = (offset) => view.getInt32(offset, true);
	const readI2 = (offset) => view.getInt16(offset, true);
	const readF4 = (offset) => view.getFloat32(offset, true);

	const readString = (offset, maxLen) =>
	{
		let str = "";
		for(let i = 0; i < maxLen; i++)
		{
			if(offset + i >= bytes.length) break;
			const charCode = bytes[offset + i];
			if(charCode === 0) break;
			str += String.fromCharCode(charCode);
		}
		return str.trim();
	};

	// =========================================================================
	// STEP 1: PARSE THE EAAS CORE HEADER
	// =========================================================================
	const magic = readString(0, 4); // Expected: "EAAS"
	if(magic !== "EAAS")
	{
		return `Error: Invalid AAS layout signature profile (Got: '${magic}', expected 'EAAS').`;
	}

	const aasVersion = readI4(4); // Expected: 4 or 5 for Quake 3 Arena
	if(aasVersion !== 4 && aasVersion !== 5)
	{
		return `Warning: Alternative AAS compilation version detected (Got: v${aasVersion}, expected v4 or v5). Proceeding with structural fallback analysis...`;
	}
	// =========================================================================
	// STEP 2: DECRYPT HEADER AND EXTRACT LUMPS DIRECTORY OFFSET STRUCTS
	// =========================================================================

	// If the version is 5, the header data from offset 8 onwards is XOR scrambled.
	// We must decrypt the bspChecksum (4 bytes) + 14 lumps (14 * 8 = 112 bytes) = 116 bytes total.
	if(aasVersion === 5)
	{
		const headerDataSize = 4 + (14 * 8);
		for(let i = 0; i < headerDataSize; i++)
		{
			const byteOffset = 8 + i;
			// Apply the id Tech 3 AAS_DData XOR cipher: data[i] ^= i * 119
			bytes[byteOffset] ^= (i * 119) & 0xFF;
		}
	}

	// Now we can safely read the 4-byte checksum that precedes the lumps
	const bspChecksum = readI4(8);

	const lumpNames = [
		"BBoxes", "Vertices", "Planes", "Edges", "EdgeIndex", "Faces",
		"FaceIndex", "Areas", "AreaSettings", "Reachability", "Nodes",
		"Portals", "PortalIndex", "Clusters"
	];

	const lumps = [];
	let lumpPtr = 12; // Lumps list immediately follows magic (4) + version (4) + bspChecksum (4)

	// AAS files strictly use 14 directory lumps
	for(let i = 0; i < 14; i++)
	{
		lumps.push({
			id: i,
			name: lumpNames[i],
			offset: readI4(lumpPtr),
			length: readI4(lumpPtr + 4)
		});
		lumpPtr += 8;
	}

	// Direct lookups for needed datasets
	const vertLump = lumps[1];
	const areasLump = lumps[7];
	const settingsLump = lumps[8];
	const reachLump = lumps[9];
	const nodeLump = lumps[10];
	// Ensure edgeLump is defined for Step 8
	const edgeLump = lumps[3];
	// =========================================================================
	// STEP 3: INITIAL FILE DIAGNOSTIC AND DIRECTORY TELEMETRY
	// =========================================================================
	let report = `Q3 AAS Bot Navigation Map Structural Topology Blueprint Summary\n`;
	report += `========================================================================\n`;
	report += `Output Map Location:  ${filePath}\n`;
	report += `Binary Layout Spec:   ${magic} v${aasVersion} (Area Awareness System Matrix)\n`;
	report += `BSP Link Checksum:    ${bspChecksum}\n`;
	report += `Total Payload Volume: ${bytes.length} bytes\n`;
	report += `------------------------------------------------------------------------\n`;
	report += `LUMP DIRECTORY SCHEMATIC MAP:\n`;
	report += `ID  | Lump Identifier       | Hex Offset   | Block Size\n`;
	report += `----|-----------------------|--------------|------------\n`;
	lumps.forEach(l =>
	{
		const hOffset = "0x" + l.offset.toString(16).toUpperCase().padStart(8, '0');
		const bSize = l.length.toString().padStart(10) + " bytes";
		report += `${l.id.toString().padStart(2, '0')}  | ${l.name.padEnd(21)} | ${hOffset}   | ${bSize}\n`;
	});
	report += `------------------------------------------------------------------------\n\n`;


	// =========================================================================
	// STEP 4: BOT NAVIGATION AREA SETTINGS EXTRACTOR (28 Bytes / Record)
	// =========================================================================
	report += `EXTRACTED AI AREA SETTINGS METADATA HOOKS:\n`;
	if(settingsLump.length > 0 && settingsLump.offset + settingsLump.length <= bytes.length)
	{
		const totalSettings = settingsLump.length / 28;
		report += `Total Navigable Areas Registered: ${totalSettings}\n`;

		let setCursor = settingsLump.offset;
		const printSampleCount = Math.min(totalSettings, 5); // Print first 5 for brevity

		for(let s = 0; s < printSampleCount; s++)
		{
			const contents = readI4(setCursor + 0);
			const areaFlags = readI4(setCursor + 4);
			const presenceType = readI4(setCursor + 8);
			const numReachable = readI4(setCursor + 20);
			const firstReachable = readI4(setCursor + 24);

			report += `  -> Area [Idx ${s.toString().padStart(3, '0')}]: Contents: 0x${contents.toString(16).toUpperCase().padStart(8, '0')} | Flags: 0x${areaFlags.toString(16).toUpperCase().padStart(4, '0')} | Presence: ${presenceType} | Reachabilities: ${numReachable} (Starts @ ${firstReachable})\n`;
			setCursor += 28;
		}
		if(totalSettings > 5) report += `     ... and ${totalSettings - 5} alternate area configurations unlisted.\n`;
	} else
	{
		report += `  No valid area settings records found or target lump out of bounds.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 5: REACHABILITY MOVEMENT GRAPH EVALUATOR (44 Bytes / Record)
	// =========================================================================
	report += `BOT REACHABILITY AND MOVEMENT GRAPH METRICS:\n`;
	if(reachLump.length > 0 && reachLump.offset + reachLump.length <= bytes.length)
	{
		const totalReach = reachLump.length / 44;

		// Match standard Q3 travel flags (1-15)
		let tCounts = { walk: 0, crouch: 0, barrierJump: 0, jump: 0, ladder: 0, walkOffLedge: 0, swim: 0, waterJump: 0, teleport: 0, elevator: 0, grapple: 0, rocketJump: 0, bfgJump: 0, jumpPad: 0, funcBob: 0, unknown: 0 };

		report += `Total Reachability Edges: ${totalReach}\n\n`;
		report += `EDGE SAMPLE ROUTING TABLE (First 10 Links):\n`;

		let reachCursor = reachLump.offset;
		const printSampleCount = Math.min(totalReach, 10);

		for(let r = 0; r < totalReach; r++)
		{
			// 1. Target Node Data
			const areaNum = readI4(reachCursor + 0);

			// 2. Spatial Vectors (12 bytes each)
			const startX = readF4(reachCursor + 12);
			const startY = readF4(reachCursor + 16);
			const startZ = readF4(reachCursor + 20);

			const endX = readF4(reachCursor + 24);
			const endY = readF4(reachCursor + 28);
			const endZ = readF4(reachCursor + 32);

			// 3. Movement Logistics
			// Note: Lower 16 bits hold the travel type, upper bits can hold team flags
			const travelType = readI4(reachCursor + 36) & 0x0000FFFF;
			const travelTime = readU2(reachCursor + 40); // Hundredths of a sec

			// Map travel types to metrics
			switch(travelType)
			{
				case 1: tCounts.walk++; break;
				case 2: tCounts.crouch++; break;
				case 3: tCounts.barrierJump++; break;
				case 4: tCounts.jump++; break;
				case 5: tCounts.ladder++; break;
				case 6: tCounts.walkOffLedge++; break;
				case 7: tCounts.swim++; break;
				case 8: tCounts.waterJump++; break;
				case 9: tCounts.teleport++; break;
				case 10: tCounts.elevator++; break;
				case 11: tCounts.grapple++; break;
				case 12: tCounts.rocketJump++; break;
				case 13: tCounts.bfgJump++; break;
				case 14: tCounts.jumpPad++; break;
				case 15: tCounts.funcBob++; break;
				default: tCounts.unknown++; break;
			}

			if(r < printSampleCount)
			{
				// Calculate physical geometric distance for validation
				const dx = endX - startX;
				const dy = endY - startY;
				const dz = endZ - startZ;
				const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

				report += `  -> Route [Idx ${r.toString().padStart(5, '0')}]: to Area ${areaNum.toString().padStart(4, ' ')} | Type: ${travelType.toString().padStart(2, ' ')} | Time Weight: ${travelTime.toString().padStart(4, ' ')}cs | Euclidean Dist: ${dist.toFixed(1)}\n`;
				report += `       Command Vector: Start [${startX.toFixed(1)}, ${startY.toFixed(1)}, ${startZ.toFixed(1)}] -> End [${endX.toFixed(1)}, ${endY.toFixed(1)}, ${endZ.toFixed(1)}]\n`;
			}

			reachCursor += 44;
		}

		report += `\nStructural Reachability Categorization:\n`;
		report += `  - Ground / Walk Routes:         ${tCounts.walk}\n`;
		report += `  - Ledge Drops / Falls:          ${tCounts.walkOffLedge}\n`;
		report += `  - Standard Jumps:               ${tCounts.jump}\n`;
		report += `  - Jump Pads / Boosters:         ${tCounts.jumpPad}\n`;
		report += `  - Weapon Jumps (RL/BFG):        ${tCounts.rocketJump + tCounts.bfgJump}\n`;
		report += `  - Specialty (Tele/Elevator):    ${tCounts.teleport + tCounts.elevator + tCounts.funcBob}\n`;
	} else
	{
		report += `  Unable to verify reachability graph geometry bounds. Data block structural error.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;


	// =========================================================================
	// STEP 6: SAMPLE VECTOR AND SPACE COORDINATES (12 Bytes / Vertex record)
	// =========================================================================
	report += `VERTEX BUFFER ENTRY SAMPLE (First 5 Precise Vector Configurations):\n`;
	if(vertLump && vertLump.length > 0 && vertLump.offset + vertLump.length <= bytes.length)
	{
		const totalVerts = vertLump.length / 12; // AAS vertices are 3x 32-bit floats
		report += `Total System Vertices: ${totalVerts} coordinate records available\n`;

		let vertCursor = vertLump.offset;
		const printSampleCount = Math.min(totalVerts, 5);

		for(let v = 0; v < printSampleCount; v++)
		{
			// XYZ Local Spatial Layout Positions (Z is UP in AAS/idTech3)
			const x = readF4(vertCursor + 0);
			const y = readF4(vertCursor + 4);
			const z = readF4(vertCursor + 8);

			report += `  => vTX [Idx ${v.toString().padStart(3, '0')}]: Pos: [${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]\n`;

			vertCursor += 12;
		}
		if(totalVerts > 5) report += `     ... and ${totalVerts - 5} alternate vertex tracking array structures left unlisted.\n`;
	} else
	{
		report += `  Vertex structure sampling unavailable. Loop bounds match error or lump missing.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 7: BSP NODE TREE HEURISTICS (24 Bytes / Node)
	// =========================================================================
	report += `EXTRACTED ROUTING BSP NODE METRICS:\n`;
	if(nodeLump && nodeLump.length > 0 && nodeLump.offset + nodeLump.length <= bytes.length)
	{
		const totalNodes = nodeLump.length / 24;
		report += `Total Spatial Nodes Evaluated: ${totalNodes}\n`;
	} else
	{
		report += `  Node layout data parsing skipped due to invalid structural bounds or blank lump.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 8: EDGE DEFINITIONS (8 Bytes / Edge)
	// =========================================================================
	report += `AAS EDGE ROUTING DATA (Vertex Pairs):\n`;
	if(edgeLump && edgeLump.length > 0 && edgeLump.offset + edgeLump.length <= bytes.length)
	{
		const totalEdges = edgeLump.length / 8; // Two 32-bit integers
		report += `Total Spatial Edges Parsed: ${totalEdges}\n`;
		report += `  * Edges map 2D connections for face boundaries.\n`;
	} else
	{
		report += `  Edge mapping unavailable or uninitialized.\n`;
	}
	report += `========================================================================\n`;
	report += `Status: Successfully isolated target AAS bot route compilation data sectors.\n`;

	// =========================================================================
	// STEP 7: BSP NODE TREE HEURISTICS (24 Bytes / Node)
	// =========================================================================
	report += `EXTRACTED ROUTING BSP NODE METRICS:\n`;
	if(typeof nodeLump !== 'undefined' && nodeLump.length > 0 && nodeLump.offset + nodeLump.length <= bytes.length)
	{
		const totalNodes = nodeLump.length / 24;
		report += `Total Spatial Nodes Evaluated: ${totalNodes}\n`;
	} else
	{
		report += `  Node layout data parsing skipped due to invalid structural bounds or blank lump.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 8: EDGE DEFINITIONS (8 Bytes / Edge)
	// =========================================================================
	// Derived from aas_edge_t { int v[2]; } referenced in AAS_ShowFace
	report += `AAS EDGE ROUTING DATA (Vertex Pairs):\n`;
	if(typeof edgeLump !== 'undefined' && edgeLump.length > 0 && edgeLump.offset + edgeLump.length <= bytes.length)
	{
		const totalEdges = edgeLump.length / 8; // Two 32-bit integers
		report += `Total Spatial Edges Parsed: ${totalEdges}\n`;
		report += `  * Edges map 2D connections for face boundaries.\n`;
	} else
	{
		report += `  Edge mapping unavailable or uninitialized.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 9: AREA TOPOLOGY HEURISTICS
	// =========================================================================
	// Derived from aas_area_t & aas_areasettings_t referenced in AAS_ShowArea
	report += `AREA TOPOLOGY & CONVEX HULLS:\n`;
	if(typeof areaLump !== 'undefined' && areaLump.length > 0)
	{
		// Area structures vary by version but typically contain face limits/indices
		report += `Area Lump Size: ${areaLump.length} bytes extracted.\n`;
		report += `  * Areas dictate walkable zones and liquid boundaries.\n`;
		report += `  * Ready to extract face/edge indices for 3D reconstruction.\n`;
	} else
	{
		report += `  Area hull data parsing skipped.\n`;
	}
	report += `------------------------------------------------------------------------\n\n`;

	// =========================================================================
	// STEP 10: BOT REACHABILITY GRAPH
	// =========================================================================
	// Derived from aas_reachability_t and TRAVEL_* constants in AAS_PrintTravelType
	report += `BOT REACHABILITY AND TRAVEL GRAPH:\n`;
	if(typeof reachLump !== 'undefined' && reachLump.length > 0)
	{
		report += `Reachability Graph populated with ${reachLump.length} bytes.\n`;
		report += `  * Tracks TRAVEL_WALK, TRAVEL_JUMP, TRAVEL_ROCKETJUMP, TRAVEL_JUMPPAD, etc.\n`;
		report += `  * Includes embedded velocity/cmdmove predictions (Z-velocity jump parameters).\n`;
	} else
	{
		report += `  Reachability vector analysis unavailable.\n`;
	}
	report += `========================================================================\n\n`;

	// =========================================================================
	// STEP 7: BSP NODE TREE HEURISTICS (24 Bytes / Node)
	// =========================================================================
	report += `EXTRACTED ROUTING BSP NODE METRICS:\n`;
	if(nodeLump.length > 0 && nodeLump.offset + nodeLump.length <= bytes.length)
	{
		const totalNodes = nodeLump.length / 24;
		report += `Total Spatial Nodes Evaluated: ${totalNodes}\n`;
	} else
	{
		report += `  Node layout data parsing skipped due to invalid structural bounds or blank lump.\n`;
	}

	report += `========================================================================\n`;
	report += `Status: Successfully isolated target AAS bot route compilation data sectors.\n`;

	return report;
}

export const HUFFMAN_DECODER_TABLE =
	[
		2512, 2182, 512, 2763, 1859, 2808, 512, 2360, 1918, 1988, 512, 1803, 2158, 2358, 512, 2180,
		1798, 2053, 512, 1804, 2603, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2767, 512, 1664,
		1731, 2116, 512, 2788, 1791, 1808, 512, 1840, 2153, 1921, 512, 2708, 2723, 1549, 512, 2046,
		1893, 2717, 512, 2602, 1801, 1288, 512, 1568, 2480, 2062, 512, 1281, 2145, 2711, 512, 1543,
		1909, 2150, 512, 2077, 2338, 2762, 512, 2162, 1794, 2024, 512, 2168, 1922, 2447, 512, 2334,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2321, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2729, 512, 2633, 1791, 1919, 512, 2184, 1917, 1802, 512, 2710, 1795, 1549, 512, 2172,
		2375, 2789, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2374, 2446, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2751, 512, 2413,
		1798, 2529, 512, 1804, 2344, 1288, 512, 2404, 2156, 2786, 512, 1281, 1640, 2641, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2395, 1921, 512, 2586, 2319, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2773, 512, 1281, 2365, 2410, 512, 1543,
		1909, 2781, 512, 2097, 2411, 2740, 512, 2396, 1794, 2024, 512, 2734, 1922, 2733, 512, 2112,
		1857, 2528, 512, 2593, 2079, 1288, 512, 2648, 2143, 1908, 512, 1281, 1640, 2770, 512, 1664,
		1731, 2169, 512, 2714, 1791, 1919, 512, 2185, 1917, 1802, 512, 2398, 1795, 1549, 512, 2098,
		2801, 2361, 512, 2400, 2328, 1288, 512, 1568, 2783, 2713, 512, 1281, 1858, 1923, 512, 1543,
		2816, 2182, 512, 2497, 1859, 2397, 512, 2794, 1918, 1988, 512, 1803, 2158, 2772, 512, 2180,
		1798, 2053, 512, 1804, 2464, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2764, 512, 1664,
		1731, 2116, 512, 2620, 1791, 1808, 512, 1840, 2153, 1921, 512, 2716, 2384, 1549, 512, 2046,
		1893, 2448, 512, 2722, 1801, 1288, 512, 1568, 2472, 2062, 512, 1281, 2145, 2376, 512, 1543,
		1909, 2150, 512, 2077, 2366, 2709, 512, 2162, 1794, 2024, 512, 2168, 1922, 2735, 512, 2407,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2779, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2359, 512, 2705, 1791, 1919, 512, 2184, 1917, 1802, 512, 2642, 1795, 1549, 512, 2172,
		2394, 2645, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2450, 2771, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2585, 512, 2403,
		1798, 2619, 512, 1804, 2777, 1288, 512, 2355, 2156, 2362, 512, 1281, 1640, 2380, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2811, 1921, 512, 2402, 2601, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2719, 512, 1281, 2747, 2776, 512, 1543,
		1909, 2725, 512, 2097, 2445, 2765, 512, 2638, 1794, 2024, 512, 2444, 1922, 2774, 512, 2112,
		1857, 2727, 512, 2644, 2079, 1288, 512, 2800, 2143, 1908, 512, 1281, 1640, 2580, 512, 1664,
		1731, 2169, 512, 2646, 1791, 1919, 512, 2185, 1917, 1802, 512, 2588, 1795, 1549, 512, 2098,
		2322, 2504, 512, 2623, 2350, 1288, 512, 1568, 2323, 2721, 512, 1281, 1858, 1923, 512, 1543,
		2512, 2182, 512, 2746, 1859, 2798, 512, 2360, 1918, 1988, 512, 1803, 2158, 2358, 512, 2180,
		1798, 2053, 512, 1804, 2745, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2806, 512, 1664,
		1731, 2116, 512, 2796, 1791, 1808, 512, 1840, 2153, 1921, 512, 2582, 2761, 1549, 512, 2046,
		1893, 2793, 512, 2647, 1801, 1288, 512, 1568, 2480, 2062, 512, 1281, 2145, 2738, 512, 1543,
		1909, 2150, 512, 2077, 2338, 2715, 512, 2162, 1794, 2024, 512, 2168, 1922, 2447, 512, 2334,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2321, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2795, 512, 2750, 1791, 1919, 512, 2184, 1917, 1802, 512, 2732, 1795, 1549, 512, 2172,
		2375, 2604, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2374, 2446, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2813, 512, 2413,
		1798, 2529, 512, 1804, 2344, 1288, 512, 2404, 2156, 2743, 512, 1281, 1640, 2748, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2395, 1921, 512, 2637, 2319, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2812, 512, 1281, 2365, 2410, 512, 1543,
		1909, 2799, 512, 2097, 2411, 2802, 512, 2396, 1794, 2024, 512, 2649, 1922, 2595, 512, 2112,
		1857, 2528, 512, 2790, 2079, 1288, 512, 2634, 2143, 1908, 512, 1281, 1640, 2724, 512, 1664,
		1731, 2169, 512, 2730, 1791, 1919, 512, 2185, 1917, 1802, 512, 2398, 1795, 1549, 512, 2098,
		2605, 2361, 512, 2400, 2328, 1288, 512, 1568, 2787, 2810, 512, 1281, 1858, 1923, 512, 1543,
		2803, 2182, 512, 2497, 1859, 2397, 512, 2758, 1918, 1988, 512, 1803, 2158, 2598, 512, 2180,
		1798, 2053, 512, 1804, 2464, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2726, 512, 1664,
		1731, 2116, 512, 2583, 1791, 1808, 512, 1840, 2153, 1921, 512, 2712, 2384, 1549, 512, 2046,
		1893, 2448, 512, 2639, 1801, 1288, 512, 1568, 2472, 2062, 512, 1281, 2145, 2376, 512, 1543,
		1909, 2150, 512, 2077, 2366, 2731, 512, 2162, 1794, 2024, 512, 2168, 1922, 2766, 512, 2407,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2809, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2359, 512, 2587, 1791, 1919, 512, 2184, 1917, 1802, 512, 2643, 1795, 1549, 512, 2172,
		2394, 2635, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2450, 2749, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2778, 512, 2403,
		1798, 2791, 512, 1804, 2775, 1288, 512, 2355, 2156, 2362, 512, 1281, 1640, 2380, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2805, 1921, 512, 2402, 2741, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2769, 512, 1281, 2739, 2780, 512, 1543,
		1909, 2737, 512, 2097, 2445, 2596, 512, 2757, 1794, 2024, 512, 2444, 1922, 2599, 512, 2112,
		1857, 2804, 512, 2744, 2079, 1288, 512, 2707, 2143, 1908, 512, 1281, 1640, 2782, 512, 1664,
		1731, 2169, 512, 2742, 1791, 1919, 512, 2185, 1917, 1802, 512, 2718, 1795, 1549, 512, 2098,
		2322, 2504, 512, 2581, 2350, 1288, 512, 1568, 2323, 2597, 512, 1281, 1858, 1923, 512, 1543,
		2512, 2182, 512, 2763, 1859, 2808, 512, 2360, 1918, 1988, 512, 1803, 2158, 2358, 512, 2180,
		1798, 2053, 512, 1804, 2603, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2767, 512, 1664,
		1731, 2116, 512, 2788, 1791, 1808, 512, 1840, 2153, 1921, 512, 2708, 2723, 1549, 512, 2046,
		1893, 2717, 512, 2602, 1801, 1288, 512, 1568, 2480, 2062, 512, 1281, 2145, 2711, 512, 1543,
		1909, 2150, 512, 2077, 2338, 2762, 512, 2162, 1794, 2024, 512, 2168, 1922, 2447, 512, 2334,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2321, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2729, 512, 2633, 1791, 1919, 512, 2184, 1917, 1802, 512, 2710, 1795, 1549, 512, 2172,
		2375, 2789, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2374, 2446, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2751, 512, 2413,
		1798, 2529, 512, 1804, 2344, 1288, 512, 2404, 2156, 2786, 512, 1281, 1640, 2641, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2395, 1921, 512, 2586, 2319, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2773, 512, 1281, 2365, 2410, 512, 1543,
		1909, 2781, 512, 2097, 2411, 2740, 512, 2396, 1794, 2024, 512, 2734, 1922, 2733, 512, 2112,
		1857, 2528, 512, 2593, 2079, 1288, 512, 2648, 2143, 1908, 512, 1281, 1640, 2770, 512, 1664,
		1731, 2169, 512, 2714, 1791, 1919, 512, 2185, 1917, 1802, 512, 2398, 1795, 1549, 512, 2098,
		2801, 2361, 512, 2400, 2328, 1288, 512, 1568, 2783, 2713, 512, 1281, 1858, 1923, 512, 1543,
		3063, 2182, 512, 2497, 1859, 2397, 512, 2794, 1918, 1988, 512, 1803, 2158, 2772, 512, 2180,
		1798, 2053, 512, 1804, 2464, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2764, 512, 1664,
		1731, 2116, 512, 2620, 1791, 1808, 512, 1840, 2153, 1921, 512, 2716, 2384, 1549, 512, 2046,
		1893, 2448, 512, 2722, 1801, 1288, 512, 1568, 2472, 2062, 512, 1281, 2145, 2376, 512, 1543,
		1909, 2150, 512, 2077, 2366, 2709, 512, 2162, 1794, 2024, 512, 2168, 1922, 2735, 512, 2407,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2779, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2359, 512, 2705, 1791, 1919, 512, 2184, 1917, 1802, 512, 2642, 1795, 1549, 512, 2172,
		2394, 2645, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2450, 2771, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2585, 512, 2403,
		1798, 2619, 512, 1804, 2777, 1288, 512, 2355, 2156, 2362, 512, 1281, 1640, 2380, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2811, 1921, 512, 2402, 2601, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2719, 512, 1281, 2747, 2776, 512, 1543,
		1909, 2725, 512, 2097, 2445, 2765, 512, 2638, 1794, 2024, 512, 2444, 1922, 2774, 512, 2112,
		1857, 2727, 512, 2644, 2079, 1288, 512, 2800, 2143, 1908, 512, 1281, 1640, 2580, 512, 1664,
		1731, 2169, 512, 2646, 1791, 1919, 512, 2185, 1917, 1802, 512, 2588, 1795, 1549, 512, 2098,
		2322, 2504, 512, 2623, 2350, 1288, 512, 1568, 2323, 2721, 512, 1281, 1858, 1923, 512, 1543,
		2512, 2182, 512, 2746, 1859, 2798, 512, 2360, 1918, 1988, 512, 1803, 2158, 2358, 512, 2180,
		1798, 2053, 512, 1804, 2745, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2806, 512, 1664,
		1731, 2116, 512, 2796, 1791, 1808, 512, 1840, 2153, 1921, 512, 2582, 2761, 1549, 512, 2046,
		1893, 2793, 512, 2647, 1801, 1288, 512, 1568, 2480, 2062, 512, 1281, 2145, 2738, 512, 1543,
		1909, 2150, 512, 2077, 2338, 2715, 512, 2162, 1794, 2024, 512, 2168, 1922, 2447, 512, 2334,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2321, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2795, 512, 2750, 1791, 1919, 512, 2184, 1917, 1802, 512, 2732, 1795, 1549, 512, 2172,
		2375, 2604, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2374, 2446, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2813, 512, 2413,
		1798, 2529, 512, 1804, 2344, 1288, 512, 2404, 2156, 2743, 512, 1281, 1640, 2748, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2395, 1921, 512, 2637, 2319, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2812, 512, 1281, 2365, 2410, 512, 1543,
		1909, 2799, 512, 2097, 2411, 2802, 512, 2396, 1794, 2024, 512, 2649, 1922, 2595, 512, 2112,
		1857, 2528, 512, 2790, 2079, 1288, 512, 2634, 2143, 1908, 512, 1281, 1640, 2724, 512, 1664,
		1731, 2169, 512, 2730, 1791, 1919, 512, 2185, 1917, 1802, 512, 2398, 1795, 1549, 512, 2098,
		2605, 2361, 512, 2400, 2328, 1288, 512, 1568, 2787, 2810, 512, 1281, 1858, 1923, 512, 1543,
		2803, 2182, 512, 2497, 1859, 2397, 512, 2758, 1918, 1988, 512, 1803, 2158, 2598, 512, 2180,
		1798, 2053, 512, 1804, 2464, 1288, 512, 2166, 2285, 2167, 512, 1281, 1640, 2726, 512, 1664,
		1731, 2116, 512, 2583, 1791, 1808, 512, 1840, 2153, 1921, 512, 2712, 2384, 1549, 512, 2046,
		1893, 2448, 512, 2639, 1801, 1288, 512, 1568, 2472, 2062, 512, 1281, 2145, 2376, 512, 1543,
		1909, 2150, 512, 2077, 2366, 2731, 512, 2162, 1794, 2024, 512, 2168, 1922, 2766, 512, 2407,
		1857, 2117, 512, 2100, 2240, 1288, 512, 2186, 2809, 1908, 512, 1281, 1640, 2242, 512, 1664,
		1731, 2359, 512, 2587, 1791, 1919, 512, 2184, 1917, 1802, 512, 2643, 1795, 1549, 512, 2172,
		2394, 2635, 512, 2171, 2187, 1288, 512, 1568, 2095, 2163, 512, 1281, 1858, 1923, 512, 1543,
		2450, 2749, 512, 2181, 1859, 2160, 512, 2183, 1918, 1988, 512, 1803, 2161, 2778, 512, 2403,
		1798, 2791, 512, 1804, 2775, 1288, 512, 2355, 2156, 2362, 512, 1281, 1640, 2380, 512, 1664,
		1731, 2052, 512, 2170, 1791, 1808, 512, 1840, 2805, 1921, 512, 2402, 2741, 1549, 512, 2046,
		1893, 2101, 512, 2159, 1801, 1288, 512, 1568, 2247, 2769, 512, 1281, 2739, 2780, 512, 1543,
		1909, 2737, 512, 2097, 2445, 2596, 512, 2757, 1794, 2024, 512, 2444, 1922, 2599, 512, 2112,
		1857, 2804, 512, 2744, 2079, 1288, 512, 2707, 2143, 1908, 512, 1281, 1640, 2782, 512, 1664,
		1731, 2169, 512, 2742, 1791, 1919, 512, 2185, 1917, 1802, 512, 2718, 1795, 1549, 512, 2098,
		2322, 2504, 512, 2581, 2350, 1288, 512, 1568, 2323, 2597, 512, 1281, 1858, 1923, 512, 1543
	];




/**
 * Standalone Q3 Demo (.dm3) Network Telemetry Logger - Protocol 43 (Uncompressed)
 *
 * Parses early-era Quake 3 demo files using standard byte-alignment,
 * bypassing the need for Huffman bitstream decompression. Hardened against negative
 * jumps and desync crashing.
 *
 * @param {Uint8Array} bytes - Raw DM3 binary
 * @returns {string} Plain text diagnostic console log
 */
export function parseDM3Telemetry(bytes)
{
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let report = `========================================================================\n`;
	report += ` DM3 STANDALONE TELEMETRY EXTRACTOR (PROTOCOL 43 - UNCOMPRESSED)\n`;
	report += `========================================================================\n\n`;

	const svc_strings = {
		1: "svc_nop", 2: "svc_gamestate", 3: "svc_configstring", 4: "svc_baseline",
		5: "svc_serverCommand", 6: "svc_download", 7: "svc_snapshot", 8: "svc_EOF",
		9: "svc_voipSpeex", 10: "svc_voipOpus", 16: "svc_multiview", 17: "svc_zcmd"
	};

	/**
	 * Standard byte reader for early Q3 uncompressed network messages
	 */
	class Q3BufferReader
	{
		constructor(buffer, offset, length)
		{
			this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			this.offset = offset;
			this.endOffset = offset + length;
		}

		readByte()
		{
			if(this.offset >= this.endOffset || this.offset < 0) return 0;
			return this.view.getUint8(this.offset++);
		}

		readShort()
		{
			if(this.offset + 2 > this.endOffset || this.offset < 0) return 0;
			const val = this.view.getInt16(this.offset, true);
			this.offset += 2;
			return val;
		}

		readLong()
		{
			if(this.offset + 4 > this.endOffset || this.offset < 0) return 0;
			const val = this.view.getInt32(this.offset, true);
			this.offset += 4;
			return val;
		}

		readString()
		{
			let result = "";
			while(this.offset < this.endOffset)
			{
				let c = this.readByte();
				if(c === 0 || result.length >= 8192) break;
				// Translate potential crash specs as per Q3 spec
				if(c === 37 || c > 127) c = 46; // '.'
				result += String.fromCharCode(c);
			}
			return result;
		}
	}

	let offset = 0;
	let frameCount = 0;
	let cmdStats = {};

	report += `NETWORK MESSAGE LOG:\n`;
	report += `------------------------------------------------------------------------\n`;

	// Macro frame loop
	while(offset + 8 <= bytes.length)
	{
		const sequence = view.getInt32(offset, true);
		offset += 4;
		const length = view.getInt32(offset, true);
		offset += 4;

		if(sequence === -1 || length === -1)
		{
			report += `\n[EOF] End of Demo Reached. Offset: 0x${offset.toString(16)}\n`;
			break;
		}
		if(length < 0 || offset + length > bytes.length)
		{
			report += `\n[ERR] Malformed length bounds (${length}B). Stream halted.\n`;
			break;
		}

		const msg = new Q3BufferReader(bytes, offset, length);

		let frameLog = `[SEQ ${sequence.toString().padStart(6, '0')}] Size: ${length.toString().padStart(5, ' ')} | Operations: `;
		let commandsParsed = 0;

		// Parse inner commands up to EOF flag
		while(msg.offset < msg.endOffset)
		{
			const cmd = msg.readByte();
			if(cmd === 8)
			{ // svc_EOF
				commandsParsed++;
				cmdStats["svc_EOF"] = (cmdStats["svc_EOF"] || 0) + 1;
				break;
			}

			const cmdName = svc_strings[cmd] || `svc_unknown(${cmd})`;
			cmdStats[cmdName] = (cmdStats[cmdName] || 0) + 1;

			if(commandsParsed < 5 && frameCount < 50)
			{
				frameLog += `${cmdName} `;
			}

			// Command Payload Evaluator
			switch(cmd)
			{
				case 1: // svc_nop
					break;
				case 2: // svc_gamestate
					const serverCommandSequence = msg.readLong();

					while(msg.offset < msg.endOffset)
					{
						let subCmd = msg.readByte();
						if(subCmd === 8) break; // svc_EOF

						if(subCmd === 3)
						{ // svc_configstring
							msg.readShort();
							msg.readString(); // Skip over payload
						} else if(subCmd === 4)
						{ // svc_baseline
							if(frameCount < 50)
							{
								report += `\n  [WARN] Hit svc_baseline. Halting inner block to prevent desync.\n`;
							}
							// Force exit: Without a delta unpacker, the rest of this frame is unreadable
							msg.offset = msg.endOffset;
							break;
						} else
						{
							if(frameCount < 50)
							{
								report += `\n  [ERR] Unknown gamestate subCmd (${subCmd}). Ejecting frame.\n`;
							}
							// Force exit
							msg.offset = msg.endOffset;
							break;
						}
					}
					// Eject entirely out of the frame since gamestate lost alignment
					msg.offset = msg.endOffset;
					break;
				case 3: // svc_configstring
					msg.readShort();
					msg.readString();
					break;
				case 5: // svc_serverCommand
					const seq = msg.readLong();
					const commandStr = msg.readString();
					if(frameCount < 50)
					{
						report += `\n  => SERVER COMMAND [${seq}]: ${commandStr}`;
					}
					break;
				case 7: // svc_snapshot
					msg.readLong(); // serverTime
					msg.readByte(); // deltaNum
					msg.readByte(); // snapFlags
					const areabytes = msg.readByte();
					for(let a = 0; a < areabytes; a++) msg.readByte(); // skip areamask

					// Force exit: Without a delta unpacker, reading past the areamask causes instant desync
					msg.offset = msg.endOffset;
					break;
				case 6: // svc_download
					msg.readShort(); // block
					const size = msg.readShort(); // size
					if(size < 0)
					{
						msg.offset = msg.endOffset; // Prevent negative jumping crash
						break;
					}
					msg.offset += size; // skip data block
					break;
				default:
					// Unknown commands break byte alignment immediately. Eject the frame.
					msg.offset = msg.endOffset;
					break;
			}
			commandsParsed++;
		}

		if(frameCount < 50 || frameCount % 500 === 0)
		{
			report += frameLog + ` (+${commandsParsed} cmds)\n`;
		} else if(frameCount === 50)
		{
			report += `... [Silencing routine frame updates for performance] ...\n`;
		}

		// Outer sequence loop ensures we safely advance to the next frame envelope
		// ignoring any internal desyncs or forced ejections.
		offset += length;
		frameCount++;
	}

	report += `------------------------------------------------------------------------\n\n`;
	report += `DEMO PAYLOAD METRICS:\n`;
	report += `  Total Server Frames Evaluated: ${frameCount}\n`;
	for(const [cmd, count] of Object.entries(cmdStats))
	{
		report += `    -> ${cmd.padEnd(20, ' ')} : ${count}\n`;
	}
	report += `========================================================================\n`;

	return report;
}




/**
 * Standalone Q3 Font DAT Parser
 *
 * Parses Quake 3 / ioquake3 generated font dat files (e.g., fontImage_12.dat)
 * Extracts all 256 glyph boundaries, texture coordinates, and scaling data.
 *
 * @param {Uint8Array} bytes - Raw DAT binary
 * @returns {string} Plain text diagnostic console log
 */
export function parseQ3FontDat(bytes)
{
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	// Standard Quake 3 / idTech 3 Engine Constants
	const GLYPHS_PER_FONT = 256;
	const SHADER_NAME_LENGTH = 32;
	const MAX_QPATH = 64;

	let offset = 0;

	// Helper functions to simulate the C readInt() and readFloat()
	function readInt()
	{
		if(offset + 4 > bytes.length) return 0;
		const val = view.getInt32(offset, true); // Little Endian
		offset += 4;
		return val;
	}

	function readFloat()
	{
		if(offset + 4 > bytes.length) return 0;
		const val = view.getFloat32(offset, true); // Little Endian
		offset += 4;
		return val;
	}

	function readString(length)
	{
		let str = "";
		for(let i = 0; i < length; i++)
		{
			if(offset >= bytes.length) break;
			const charCode = view.getUint8(offset++);
			// Stop appending on null terminator, but we must advance the offset
			// by the full 'length' to maintain structure alignment
			if(charCode !== 0 && str.length === i)
			{
				str += String.fromCharCode(charCode);
			}
		}
		return str;
	}

	let report = `========================================================================\n`;
	report += ` Q3 FONT DAT PARSER\n`;
	report += `========================================================================\n\n`;

	const font = {
		glyphs: [],
		glyphScale: 0,
		name: ""
	};

	let populatedGlyphsCount = 0;

	report += `GLYPH METRICS:\n`;
	report += `---------------------------------------------------------------------------------\n`;
	report += `Char | Idx | Size (WxH) | Image (WxH) | UVs (S, T) -> (S2, T2)     | Shader\n`;
	report += `---------------------------------------------------------------------------------\n`;

	// 1. Read all 256 glyph structures
	for(let i = 0; i < GLYPHS_PER_FONT; i++)
	{
		const glyph = {
			index: i,
			char: String.fromCharCode(i),
			height: readInt(),
			top: readInt(),
			bottom: readInt(),
			pitch: readInt(),
			xSkip: readInt(),
			imageWidth: readInt(),
			imageHeight: readInt(),
			s: readFloat(),
			t: readFloat(),
			s2: readFloat(),
			t2: readFloat(),
			glyphHandle: readInt(), // OpenGL handle, usually useless offline
			shaderName: readString(SHADER_NAME_LENGTH)
		};

		font.glyphs.push(glyph);

		// Only print glyphs that actually have data (filtering out unprintable/empty blocks)
		if(glyph.imageWidth > 0 || glyph.imageHeight > 0 || glyph.xSkip > 0)
		{
			// Escape special chars for terminal printing
			let displayChar = glyph.char;
			if(i < 32 || i === 127 || i === 255) displayChar = `\\${i}`;

			const size = `${glyph.pitch}x${glyph.height}`.padEnd(10, ' ');
			const imgSize = `${glyph.imageWidth}x${glyph.imageHeight}`.padEnd(11, ' ');

			const s = glyph.s.toFixed(3);
			const t = glyph.t.toFixed(3);
			const s2 = glyph.s2.toFixed(3);
			const t2 = glyph.t2.toFixed(3);
			const uvs = `(${s}, ${t}) -> (${s2}, ${t2})`.padEnd(26, ' ');

			const shader = glyph.shaderName || "N/A";

			report += ` ${displayChar.padStart(3, ' ')} | ${i.toString().padStart(3, ' ')} | ${size} | ${imgSize} | ${uvs} | ${shader}\n`;
			populatedGlyphsCount++;
		}
	}

	// 2. Read the global Font metrics appended to the end of the file
	font.glyphScale = readFloat();
	font.name = readString(MAX_QPATH);

	report += `---------------------------------------------------------------------------------\n\n`;

	report += `FONT SUMMARY:\n`;
	report += `  Name                 : ${font.name || "Unknown/Embedded"}\n`;
	report += `  Total Glyphs Populated: ${populatedGlyphsCount} / ${GLYPHS_PER_FONT}\n`;
	report += `  Global Glyph Scale   : ${font.glyphScale.toFixed(4)}\n`;
	report += `  Final Byte Offset    : 0x${offset.toString(16)} / 0x${bytes.length.toString(16)}\n`;
	report += `========================================================================\n`;

	// You can also return 'font' as an object if you want to use the JSON data downstream.
	// For now, we print the diagnostic text.
	return report;
}


export function arrayBufferToDataUri(buffer, filename)
{
	// Determine MIME type based on extension (fallback to png)
	let type = "image/png";
	if(filename.endsWith('.jpg') || filename.endsWith('.jpeg')) type = "image/jpeg";
	if(filename.endsWith('.gif')) type = "image/gif";
	if(filename.endsWith('.webp')) type = "image/webp";

	const bytes = new Uint8Array(buffer);
	let binary = '';
	for(let i = 0; i < bytes.byteLength; i++)
	{
		binary += String.fromCharCode(bytes[i]);
	}
	const base64 = btoa(binary);
	return `data:${type};base64,${base64}`;
}



// Quick helper to evaluate header buffers using your existing magics
export function isQuakeBinaryMagic(bytes)
{
	const magicStr = Array.from(bytes.subarray(0, 4)).map(b => String.fromCharCode(b)).join('');
	// "IBSP" = Map, "IDP3" = Mesh, "EAAS" = Bot AI navigation
	return ['IBSP', 'IDP3', 'EAAS'].includes(magicStr) ||
		(bytes[0] === 0x44 && bytes[1] === 0x14 && bytes[2] === 0x72 && bytes[3] === 0x12); // QVM
}



(function (root)
{
	const exportsObject = {
		hasSequentialBinaryRegex,
		hexDump,
		AssetInspector,
		arrayBufferToDataUri
	};

	// 1. CommonJS Node environment
	if(typeof module !== 'undefined' && module.exports)
	{
		module.exports = exportsObject;
	}
	// 2. Bare exports environment
	else if(typeof exports !== 'undefined')
	{
		Object.assign(exports, exportsObject);
	}
	// 3. Web Worker context (Classic or Module)
	else if(typeof self !== 'undefined' && typeof self.importScripts === 'function')
	{
		Object.assign(self || root || {}, exportsObject);
	}
	// 4. Standard Browser UI Thread fallback
	else
	{
		Object.assign(root || {}, exportsObject);
	}
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
