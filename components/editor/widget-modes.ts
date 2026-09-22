
export const EXTENSION_TO_MODE: Record<string, string> = {
	// =====================================================================
	// 1. ACTIVE ANTLR PIPELINE ROUTING LAYER ('antlr_worker')
	// =====================================================================
	'c': 'antlr_worker', 'cc': 'antlr_worker', 'cpp': 'antlr_worker',
	'cxx': 'antlr_worker', 'h': 'antlr_worker', 'hh': 'antlr_worker',
	'hpp': 'antlr_worker', 'hxx': 'antlr_worker', 'i': 'antlr_worker',
	'ino': 'antlr_worker',

	'angelscript': 'antlr_worker', 'lua': 'antlr_worker',

	'wat': 'antlr_worker', 'asm': 'antlr_worker', 's': 'antlr_worker',
	'pdp7': 'antlr_worker',

	'js': 'antlr_worker', 'cjs': 'antlr_worker', 'mjs': 'antlr_worker',
	'jsm': 'antlr_worker', 'ts': 'antlr_worker', 'html': 'antlr_worker',
	'htm': 'antlr_worker', 'xhtml': 'antlr_worker', 'css': 'antlr_worker',
	'json': 'antlr_worker', 'gql': 'antlr_worker', 'graphql': 'antlr_worker',

	'php': 'antlr_worker', 'phtml': 'antlr_worker', 'cs': 'antlr_worker',
	'csx': 'antlr_worker', 'go': 'antlr_worker', 'rs': 'antlr_worker',

	'java': 'antlr_worker', 'py': 'antlr_worker', 'pyw': 'antlr_worker',

	'postgresql': 'antlr_worker', 'pgsql': 'antlr_worker', 'sqlite': 'antlr_worker',
	'plsql': 'antlr_worker', 'tsql': 'antlr_worker', 'mysql': 'antlr_worker',
	'sql': 'antlr_worker',

	'cmakelists.txt': 'antlr_worker',
	'cmake': 'antlr_worker', 'proto': 'antlr_worker', 'toml': 'antlr_worker',
	'xml': 'antlr_worker', 'xsd': 'antlr_worker', 'xsl': 'antlr_worker',
	'csv': 'antlr_worker', 'properties': 'antlr_worker', 'props': 'antlr_worker',
	'terraform': 'antlr_worker',

	// =====================================================================
	// 2. ID TECH 3 / QUAKE DEDICATED ASSET PIPELINE LAYER ('antlr_worker')
	// =====================================================================
	'arena': 'antlr_worker',     // Q3ArenaParser
	'cam': 'antlr_worker',       // Q3CameraParser
	'cfg': 'antlr_worker',       // Q3ConfigParser
	'map': 'antlr_worker',       // Q3MapParser / QuakeMapParser
	'menu': 'antlr_worker',      // Q3MenuParser
	'shader': 'antlr_worker',    // Q3ShaderParser
	'shaderx': 'antlr_worker',   // Q3ShaderParser variant
	'skin': 'antlr_worker',      // Q3SkinParser

	// =====================================================================
	// 3. PRESERVED EXTENSIONS & FALLBACK MODES (UNCOVERED PIPELINES)
	// =====================================================================
	'abap': 'abap',
	'abc': 'abc',
	'ada': 'ada',
	'adb': 'ada',
	'ahk': 'autohotkey',
	'apex': 'apex',
	'applescript': 'applescript',
	'as': 'actionscript',
	'bat': 'batchfile',
	'cbl': 'cobol',
	'cfc': 'coldfusion',
	'cfm': 'coldfusion',
	'cl': 'lisp',
	'clj': 'clojure',
	'cljs': 'clojure',
	'cls': 'apex',
	'cmd': 'batchfile',
	'cob': 'cobol',
	'coffee': 'coffee',
	'conf': 'apache_conf',
	'd': 'd',
	'dart': 'dart',
	'diff': 'diff',
	'dockerfile': 'dockerfile',
	'dot': 'dot',
	'e': 'eiffel',
	'edn': 'clojure',
	'ejs': 'ejs',
	'erl': 'erlang',
	'ex': 'elixir',
	'exs': 'elixir',
	'f': 'fortran',
	'f90': 'fortran',
	'f95': 'fortran',
	'for': 'fortran',
	'forth': 'forth',
	'frag': 'glsl',
	'fs': 'fsharp',
	'fsi': 'fsharp',
	'fsx': 'fsharp',
	'fth': 'forth',
	'ftl': 'freemarker',
	'gcode': 'gcode',
	'gitignore': 'ini',
	'glsl': 'glsl',
	'vlsl': 'glsl',
	'hlsl': 'glsl',
	'groovy': 'groovy',
	'gsh': 'groovy',
	'gvy': 'groovy',
	'gy': 'groovy',
	'haml': 'haml',
	'handlebars': 'handlebars',
	'hbs': 'handlebars',
	'hjson': 'hjson',
	'hrl': 'erlang',
	'hs': 'haskell',
	'htaccess': 'apache_conf',
	'ini': 'ini',
	'jade': 'pug',
	'jl': 'julia',
	'jsp': 'jsp',
	'jsx': 'jsx',
	'kt': 'kotlin',
	'kts': 'kotlin',
	'less': 'less',
	'liquid': 'liquid',
	'lisp': 'lisp',
	'log': 'text',
	'ls': 'livescript',
	'lsp': 'lisp',
	'ltx': 'latex',
	'm': 'matlab',
	'makefile': 'makefile',
	'make': 'makefile',
	'markdown': 'markdown',
	'md': 'markdown',
	'mel': 'mel',
	'mk': 'makefile',
	'ml': 'ocaml',
	'mli': 'ocaml',
	'mm': 'objectivec',
	'nginx': 'nginx',
	'nim': 'nim',
	'nix': 'nix',
	'nsh': 'nsis',
	'nsi': 'nsis',
	'pas': 'pascal',
	'patch': 'diff',
	'perl': 'perl',
	'pig': 'pig',
	'pl': 'perl',
	'pm': 'perl',
	'pp': 'pascal',
	'powershell': 'powershell',
	'prefs': 'ini',
	'ps1': 'powershell',
	'psm1': 'powershell',
	'pug': 'pug',
	'puppet': 'puppet',
	'q': 'q',
	'r': 'r',
	'rb': 'ruby',
	'rdoc': 'rdoc',
	'rhtml': 'ruby',
	'rprofile': 'r',
	'sass': 'sass',
	'sbt': 'scala',
	'scad': 'scad',
	'scala': 'scala',
	'scheme': 'scheme',
	'scm': 'scheme',
	'scss': 'scss',
	'sh': 'sh',
	'sieve': 'sieve',
	'slim': 'slim',
	'smali': 'smali',
	'smarty': 'smarty',
	'ss': 'scheme',
	'styl': 'stylus',
	'svg': 'svg',
	'swift': 'swift',
	'tcl': 'tcl',
	'tex': 'latex',
	'tpl': 'smarty',
	'tsx': 'tsx',
	'twig': 'twig',
	'txt': 'text',
	'wasm': 'wasm_disassembly',
	'qvm': 'qvm_disassembly',
	'v': 'verilog',
	'vala': 'vala',
	'vapi': 'vala',
	'vbe': 'vbscript',
	'vbs': 'vbscript',
	'vert': 'glsl',
	'vh': 'verilog',
	'vhd': 'vhdl',
	'vhdl': 'vhdl',
	'vue': 'vue',
	'yaml': 'yaml',
	'yml': 'yaml',
	'zig': 'zig',
	'zsh': 'sh'
};

export function getModeByFilename(filePath: string)
{
	const ext = filePath.split('.').pop()?.toLowerCase();
	const filenameAsType = filePath.split('/').pop()?.toLowerCase();
	const modeKey = ((!ext || !EXTENSION_TO_MODE[ext] || ext === 'txt')
		&& filenameAsType && EXTENSION_TO_MODE[filenameAsType])
		? filenameAsType : ext;
	if(modeKey)
	{
		return `ace/mode/${EXTENSION_TO_MODE[modeKey] || 'text'}`;
	} else
	{
		return `ace/mode/'text'`;
	}
}
