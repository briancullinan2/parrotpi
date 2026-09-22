import fs from 'fs/promises';
import path from 'path';

// Change 'dist' to match your build output folder (e.g., 'public', 'build')
const BUILD_DIR = path.resolve(__dirname, "../..");
const OUTPUT_FILE = path.join(BUILD_DIR, 'file-manifest.js');

/**
 * Recursively walks a directory and collects file info
 */
async function walkDirectory(dir: string)
{
	let files: any[] = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for(const entry of entries)
	{
		const fullPath = path.join(dir, entry.name);

		// Skip the manifest file if it already exists in the folder
		if(fullPath === OUTPUT_FILE) continue;
		if(entry.name.startsWith('.')) continue;
		if(entry.name === 'node_modules') continue;
		if(entry.name === '3rdparty') continue;
		if(entry.name === 'snippets') continue;
		if(entry.name === 'dist') continue;
		if(entry.name.includes('Screenshot')) continue;

		if(entry.isDirectory())
		{
			files = files.concat(await walkDirectory(fullPath));
		} else if(entry.isFile())
		{
			const stats = await fs.stat(fullPath);
			// Get relative path for browser routing (e.g., /js/main.js)
			const relativePath = '/' + path.relative(BUILD_DIR, fullPath).replace(/\\/g, '/');

			files.push({
				path: relativePath,
				size: stats.size // Size in bytes
			});
		}
	}
	return files;
}

async function run()
{
	try
	{
		console.log(`Scanning directory: ${BUILD_DIR}...`);
		const fileList = await walkDirectory(BUILD_DIR);

		// Format the JavaScript payload for the service worker
		const fileContent = `// Generated automatically by npm build script. Do not modify manually.\nself.__assetsManifest = ${JSON.stringify(fileList, null, 2)};\n`;

		await fs.writeFile(OUTPUT_FILE, fileContent, 'utf8');
		console.log(`Success! Manifest created with ${fileList.length} files at: ${OUTPUT_FILE}`);
	} catch(error)
	{
		console.error('Error generating asset manifest:', error);
		process.exit(1);
	}
}

run();
