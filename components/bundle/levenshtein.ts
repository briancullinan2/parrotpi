import type { LevenshteinWindow } from "./lumino.d";

export interface LevSearchConfig
{
	keys: string | string[];
	id?: string;
}

const compileSelf: LevenshteinWindow = self as unknown as any;


/**
 * Calculates the Levenshtein / Damerau-Levenshtein distance between two strings.
 */
export function levDist(s: string, t: string): number
{
	const d: number[][] = []; // 2D matrix

	// Step 1
	const n = s.length;
	const m = t.length;

	if(n === 0) return m;
	if(m === 0) return n;

	// Create a 2D array matrix
	for(let i = n; i >= 0; i--)
	{
		d[i] = [];
	}

	// Step 2
	for(let i = n; i >= 0; i--) d[i][0] = i;
	for(let j = m; j >= 0; j--) d[0][j] = j;

	// Step 3
	for(let i = 1; i <= n; i++)
	{
		const s_i = s.charAt(i - 1);

		// Step 4
		for(let j = 1; j <= m; j++)
		{
			// Check the jagged ld total so far
			if(i === j && d[i][j] > 4) return n;

			const t_j = t.charAt(j - 1);
			const cost = (s_i === t_j) ? 0 : 1; // Step 5

			// Calculate the minimum
			let mi = d[i - 1][j] + 1;
			const b = d[i][j - 1] + 1;
			const c = d[i - 1][j - 1] + cost;

			if(b < mi) mi = b;
			if(c < mi) mi = c;

			d[i][j] = mi; // Step 6

			// Damerau transposition
			if(i > 1 && j > 1 && s_i === t.charAt(j - 2) && s.charAt(i - 2) === t_j)
			{
				d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
			}
		}
	}

	// Step 7
	return d[n][m];
}

compileSelf.levDist = levDist;


/**
 * Sorts an array of items by their Levenshtein distance relative to a search string.
 */
export function levSort<T>(
	arr: T[],
	search: string,
	getStr: (item: T) => string = (a: any) => String(a)
): T[]
{
	const result = [...arr]; // Copy input array

	result.sort((a, b) =>
	{
		return levDist(getStr(a), search) - levDist(getStr(b), search);
	});

	return result;
}

compileSelf.levSort = levSort;



export interface LevSearchConfig
{
	keys: string | string[];
	id?: string;
}

/**
 * Safely resolves nested object paths (e.g., "meta.info.name") from a target object.
 */
function getPropertyByPath(obj: any, path: string): any
{
	if(!obj || typeof obj !== 'object') return undefined;
	return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

/**
 * Extracts string values from target keys (or dot-notation object paths) on an object.
 */
export function getStr(keys: string | string[], obj: Record<string, any>): string[]
{
	const keyList = typeof keys === 'string' ? [keys] : keys;

	return keyList.reduce<string[]>((arr, id) =>
	{
		const value = getPropertyByPath(obj, id);
		if(value === undefined || value === null) return arr;

		return arr.concat(Array.isArray(value) ? value.map(String) : [String(value)]);
	}, []);
}

compileSelf.getStr = getStr;


/**
 * Searches and sorts a dataset by distance matching across specified key paths.
 */
export function levSearch<T extends Record<string, any>>(
	cache: T[],
	config: LevSearchConfig,
	search: string
): any[]
{
	const result = [...cache];

	// TODO: tokenize search query
	result.sort((a, b) =>
	{
		const stringsA = getStr(config.keys, a);
		const stringsB = getStr(config.keys, b);

		const minA = stringsA.length > 0
			? Math.min(...stringsA.map(s => levDist(s, search)))
			: Infinity;

		const minB = stringsB.length > 0
			? Math.min(...stringsB.map(s => levDist(s, search)))
			: Infinity;

		return minA - minB;
	});

	return result;
}

compileSelf.levSearch = levSearch;


/**
 * Resolves prefix matches or falls back to Levenshtein <= 25% threshold
 */
function findMatchesWithFuzzy(currentValue: string, candidatesPool: string[]): string[]
{
	if(!currentValue) return candidatesPool;

	const lowerCurrent = currentValue.toLowerCase();
	const prefixMatches = candidatesPool.filter(c => c.toLowerCase().startsWith(lowerCurrent));

	if(prefixMatches.length > 0)
	{
		return prefixMatches;
	}

	// Levenshtein fallback check (q3e threshold: dist / length <= 0.25)
	if(typeof levDist !== 'function') return [];

	const fuzzyMatches: string[] = [];
	for(const candidate of candidatesPool)
	{
		if(!candidate) continue;
		const len = candidate.length;
		if(len === 0) continue;

		const dist = levDist(lowerCurrent, candidate.toLowerCase());
		if(dist / len <= 0.25)
		{
			fuzzyMatches.push(candidate);
		}
	}

	return fuzzyMatches;
}

compileSelf.findMatchesWithFuzzy = findMatchesWithFuzzy;

