
/// <reference path="../bundle/global.d.ts" />


/**
 * Unzips a buffer and hydrates the virtual filesystem
 * @param {ArrayBuffer} buffer - The zip/pk3 file data
 * @param {string} rootPath - Where to mount in the virtual FS (e.g., 'baseq3')
 * @param {string | null} database
 */

async function unzipToVirtualFS(buffer, rootPath = 'baseq3', database = null)
{
	if(!database)
	{
		database = self.RepositoryToolbar?.owner?.value + '/' + self.RepositoryToolbar?.repository?.value;
	}
	const zip = new JSZip();
	const contents = await zip.loadAsync(buffer);

	console.log(`Extracting files to ${rootPath}...`);

	const promises = [];

	contents.forEach((relativePath, file) =>
	{
		if(file.dir) return; // Skip directories, we handle them via path logic

		const fullPath = path.join(rootPath, relativePath);

		const promise = file.async('uint8array').then(async data =>
		{
			// Mapping to your existing FS.virtual structure
			FS.virtual[fullPath] = {
				timestamp: new Date(),
				mode: self.FS_FILE, // Standard file mode (ST_FILE)
				contents: data,
				path: fullPath,
				sha: await self.getGitShaBrowser(data),
				parent: fullPath.substring(0, fullPath.lastIndexOf('/'))
			};
			self.getGitShaBrowser(data).then(sha => FS.virtual[fullPath].sha = sha);
			console.log(`Extracted: ${relativePath}`);
			self.putRecord(self.DB_STORE_NAME, FS.virtual[fullPath], database);
		});

		promises.push(promise);
	});

	await Promise.all(promises);
	console.log("Unzip complete.");
}

