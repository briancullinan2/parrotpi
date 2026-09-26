/// <reference types="node" />
console.log("==========================================");
console.log("THE SCRIPT RECOVERY PROCESS IS EXECUTING!");
console.log("Current working path directory is:", process.cwd());
console.log("==========================================");

import * as fs from 'fs';
import * as path from 'path';
import { SettingConfig } from './settings';
import * as ts from 'typescript';
/**
 * Sweeps a directory, regex-extracts the IMPORT_SETTINGS declarations,
 * and compiles them into a unified dictionary file.
 */
function coalesceImportSettings(sourceFiles: string[], outputPath: string): void
{
	const unifiedSettings: Record<string, Record<string, SettingConfig>> = {};

	for(const filePath of sourceFiles)
	{
		if(!fs.existsSync(filePath))
		{
			console.warn(`File not found, skipping: "${filePath}"`);
			continue;
		}
		console.log('Scanning file: ' + filePath);

		const sourceText = fs.readFileSync(filePath, 'utf-8');
		const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

		// Helper to check modifiers for exports
		const isExported = (node: ts.Node): boolean =>
		{
			const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
			return !!modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
		};

		// Deep-walk the node tree to find variable statements
		const visit = (node: ts.Node): void =>
		{
			if(ts.isVariableStatement(node) || isExported(node))
			{
				let declarationList: ts.VariableDeclarationList | undefined;

				if(ts.isVariableStatement(node))
				{
					declarationList = node.declarationList;
				} else if(ts.isVariableDeclarationList(node))
				{
					declarationList = node;
				}

				if(declarationList)
				{
					for(const decl of declarationList.declarations)
					{
						if(
							ts.isIdentifier(decl.name) &&
							(decl.name.text === 'IMPORT_SETTINGS'
								|| decl.name.text === 'LOCAL_SETTINGS') &&
							decl.initializer &&
							ts.isObjectLiteralExpression(decl.initializer)
						)
						{
							parseRootObject(decl.initializer);
						}
					}
				}
			}
			ts.forEachChild(node, visit);
		};

		function parseRootObject(objLiteral: ts.ObjectLiteralExpression): void
		{
			for(const prop of objLiteral.properties)
			{
				if(!ts.isPropertyAssignment(prop)) continue;

				const moduleName = prop.name.getText(sourceFile).replace(/['"]/g, '');
				if(!prop.initializer || !ts.isObjectLiteralExpression(prop.initializer)) continue;

				if(!unifiedSettings[moduleName])
				{
					unifiedSettings[moduleName] = {};
				}

				for(const settingProp of prop.initializer.properties)
				{
					if(!ts.isPropertyAssignment(settingProp)) continue;

					const settingKey = settingProp.name.getText(sourceFile).replace(/['"]/g, '');
					if(!settingProp.initializer || !ts.isObjectLiteralExpression(settingProp.initializer)) continue;

					const settingData: Record<string, any> = {};

					for(const dataProp of settingProp.initializer.properties)
					{
						if(!ts.isPropertyAssignment(dataProp)) continue;

						const fieldName = dataProp.name.getText(sourceFile).replace(/['"]/g, '');
						const valueNode = dataProp.initializer;

						if(ts.isStringLiteral(valueNode))
						{
							settingData[fieldName] = valueNode.text;
						} else if(valueNode.kind === ts.SyntaxKind.TrueKeyword)
						{
							settingData[fieldName] = true;
						} else if(valueNode.kind === ts.SyntaxKind.FalseKeyword)
						{
							settingData[fieldName] = false;
						} else if(ts.isNumericLiteral(valueNode))
						{
							settingData[fieldName] = Number(valueNode.text);
						} else if(ts.isArrayLiteralExpression(valueNode))
						{
							settingData[fieldName] = valueNode.elements
								.filter(ts.isStringLiteral)
								.map(el => el.text);
						}
					}

					if(Object.keys(settingData).length > 0)
					{
						unifiedSettings[moduleName][settingKey] = settingData as SettingConfig;
					}
				}
			}
		}

		ts.forEachChild(sourceFile, visit);
	}

	const outputContent = `
import { SettingConfig } from "./settings";

// Automatically compiled workspace settings cache pass

export const IMPORT_SETTINGS: Record<string, Record<string, SettingConfig>> = ${JSON.stringify(unifiedSettings, null, 4)};
`;
	const dir = path.dirname(outputPath);
	if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

	fs.writeFileSync(outputPath, outputContent, 'utf-8');
	console.info(`Successfully coalesced configurations directly via AST to: ${outputPath}`);
}

// Example Pre-Webpack execution pass:
const componentScripts = [
	'./components/bundle/github-settings.ts',
	'./components/bundle/lumino.ts',
	'./components/editor/widget-settings.ts',
	'./components/terminal/widget.ts',
	'./components/paint/widget-settings.ts',
	'./components/map-loader/widget.ts',
	//'./components/engine/quake-config.ts'
];

console.log('Coalescing settings: ', componentScripts);
coalesceImportSettings(componentScripts, './components/bundle/settings-coalesced.ts');
