const liveServer = require("live-server");
const cluster = require("cluster");
const os = require("os");
const config = require('./tsconfig.json');

// --- MULTI-THREADING (CONCURRENCY) FORK ---
// This acts like PHP's built-in server by spawning worker processes
// across your CPU cores to handle heavy HTTP request loads concurrently.
if(cluster.isMaster)
{
	const numCPUs = Math.min(os.cpus().length, 4); // Cap at 4 workers max for dev
	console.log(`[Master] Spawning ${numCPUs} concurrent server workers...`);

	for(let i = 0; i < numCPUs; i++)
	{
		cluster.fork();
	}

	cluster.on("exit", (worker) =>
	{
		console.log(`[Master] Worker ${worker.process.pid} died. Restarting...`);
		cluster.fork();
	});
} else
{
	// --- WORKER PROCESS: RUNS THE SERVER ---
	function middleware(req, res, next)
	{
		// Essential for CORS in Workers
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
		res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

		// Essential for SharedArrayBuffer / Cross-Origin Isolation
		res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
		res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
		res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

		res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-eval' 'sha256-iN7wpJdxHlpujRppkOA8N0+Mzp0ZqZr3lCtxM00Y63c='; worker-src 'self' blob:;");
		res.setHeader('Permissions-Policy', 'cross-origin-isolated=(*)');

		if(req.method === 'OPTIONS')
		{
			res.statusCode = 204;
			return res.end();
		}

		next();
	}

	const params = {
		port: 8080,
		host: "localhost",
		root: "./",
		open: cluster.worker.id === 1,
		logLevel: 2,
		fullReload: true,
		wait: 200,

		// 1. Keep this matching your project directory root
		watch: ['./*.js', './*.html', './components/**', './ace/**'],

		// 2. Add the ignore array right here.
		// This stops live-server/chokidar from crawling these directories entirely.
		ignore: config.exclude,

		middleware: [middleware]
	};

	liveServer.start(params);
	console.log(`[Worker ${process.pid}] Static file server ready on http://localhost:8080`);
}
