// @ts-check

import { IncomingMessage, ServerResponse } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { StatusDataGenerator } from './generate';

const CACHE_TTL_MS = 30000;
/** @type {string | null} */
let cachedPayload = null;
let lastGeneratedAt = 0;

/**
 *
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @returns {Promise<void>}
 */
export async function handleStatusStreamMiddleware(req, res)  {
  const url = req.url || '';

  if (!url.startsWith('/components/status/status-data.json')) {
    return;
  }

  // Set HTTP headers for stream chunk transfers (no WebSockets needed)
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const startTime = Date.now();
  const maxExecutionTimeMs = 30000;
  const intervalMs = 3000; // Emit snapshot increments every 3s

  const streamInterval = setInterval(async () => {
    const now = Date.now();

    // Check if 30 second streaming task window exceeded
    if (now - startTime >= maxExecutionTimeMs) {
      clearInterval(streamInterval);
      res.end();
      return;
    }

    try {
      let dataStr = '';
      if (now - lastGeneratedAt > CACHE_TTL_MS || !cachedPayload) {
        const payload = await StatusDataGenerator.IGenerate();
        cachedPayload = JSON.stringify(payload);
        lastGeneratedAt = now;

        // Persist to static file concurrently
        fs.writeFile(path.join(process.cwd(), 'status-data.json'), cachedPayload, () => {});
      }

      dataStr = cachedPayload;
      // Write line-delimited NDJSON stream chunk
      res.write(`${dataStr}\n`);
    } catch (err) {
      res.write(JSON.stringify({ error: String(err), timestamp: Date.now() }) + '\n');
    }
  }, intervalMs);

  req.on('close', () => {
    clearInterval(streamInterval);
  });
}
