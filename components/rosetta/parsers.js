
if(typeof window === 'undefined')
{
	const window = {

	};
	self.window = window;
}

// Add these to your Diagnostic Bridge configuration
const DIAGNOSTIC_PARSERS = [
	{
		name: "clang_lcc",
		// Matches: code/game/g_main.c:25: error: missing semi-colon
		pattern: /^([^:\n]+):(\d+):\s*(error|warning):\s*(.+)$/i,
		resolve: function (match, bridge)
		{
			return {
				filePath: match[1].trim(),
				row: parseInt(match[2], 10) - 1,
				type: match[3].toLowerCase() === 'error' ? 'error' : 'warning',
				text: match[4].trim()
			};
		}
	},
	{
		name: "quake_shader_parser",
		// Matches: WARNING: expecting '{', found 'INVALID' instead in shader 'textures/gothic/floor'
		// Or: WARNING: unknown general shader parameter 'bad_keyword' in 'scripts/sfx.shader'
		pattern: /WARNING:\s*([^'\n]+)'\s*instead\s*in\s*shader\s*'([^']+)'|WARNING:\s*unknown\s*general\s*shader\s*parameter\s*'([^']+)'\s*in\s*'([^']+)'/i,
		resolve: function (match, bridge)
		{
			// Check which capture group hit based on the Printf outputs in ParseShader
			let infoText = match[1] ? `Expecting '{', found '${match[1]}'` : `Unknown general shader parameter '${match[3]}'`;
			let shaderOrFile = match[2] || match[4];

			// Shaders are named by texture path, but we map them to their script definition file
			let filePath = shaderOrFile.endsWith('.shader') ? shaderOrFile : bridge.lookupShaderFile(shaderOrFile);

			return {
				filePath: filePath,
				row: bridge.findLineInFile(filePath, match[2] || match[3]) || 0, // Fallback locator strategy
				type: "warning",
				text: infoText
			};
		}
	},
	{
		name: "quake_asset_missing",
		// Matches: Couldn't find image file for shader gfx/2d/sunflare
		// Or: WARNING: models/mapobjects/energy.tga not present, using .jpg instead
		pattern: /(?:Couldn't find image file for shader|WARNING:)\s*([^\s\n]+)(?:\s*not present)?/i,
		resolve: function (match, bridge)
		{
			let assetPath = match[1];
			// Identify which shader is crying about the missing asset texture dependency
			let filePath = bridge.findShaderByAssetDependency(assetPath);

			return {
				filePath: filePath,
				row: bridge.findLineInFile(filePath, assetPath) || 0,
				type: "error",
				text: `Missing Asset Dependency: Could not resolve binary path for [${assetPath}]`
			};
		}
	},
	{
		name: "quake_skin_failure",
		// Matches: Torso skin load failure: models/players/doom/upper_red.skin
		pattern: /(Leg|Torso|Head)\s*skin\s*load\s*failure:\s*([^\s\n]+)/i,
		resolve: function (match, bridge)
		{
			let component = match[1];
			let skinFile = match[2];
			return {
				filePath: skinFile,
				row: 0, // Skin files are often single line registrations, highlight header
				type: "error",
				text: `${component} model segment mapping failed to bind cleanly.`
			};
		}
	}
];
