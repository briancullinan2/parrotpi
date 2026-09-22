
const path = require('path');
const fs = require('fs');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
	mode: 'production',
	devtool: 'inline-source-map',
	entry: [
		'./components/bundle/lumino.ts',
		'./components/bundle/lumino-files.ts'
	], // Aligned with your actual entry location
	target: 'web',
	output: {
		filename: 'app.bundle.js',
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	stats: 'verbose', // Generates comprehensive build stream analytics
	stats: {
		errorDetails: true, // Forces display of exact file resolution traces
		colors: true,
		modules: true,
		reasons: true
	},
	resolve: {
		extensions: ['.ts', '.js', '.css'],
	},
	module: {
		noParse: [/[\\/]node_modules[\\/]@babel[\\/]standalone[\\/]/],
		rules: [
			{
				test: /rosetta\/binary/,
				type: 'javascript/auto', // Resets the module type configuration
				parser: {
					sourceType: 'module' // Explicitly forces webpack to permit import/export
				}
			},
			{
				// require.resolve returns the exact absolute path to the node_modules entrypoint
				test: require.resolve('diff'),
				use: [
					{
						loader: 'expose-loader',
						options: {
							// This registers it directly on window.diff and globalThis.diff
							exposes: ['diff'],
						},
					},
				],
			},
			{
				test: path.resolve(__dirname, './components/bundle/lumino-files.ts'),
				use: [
					{
						loader: 'expose-loader',
						options: {
							exposes: ['FileManager'],
						},
					},
				],
			},
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.css$/,
				use: [
					'style-loader',
					{
						loader: 'css-loader',
						options: { sourceMap: true }
					}
				]
			},
		],
	},
	plugins: [
		new webpack.ProvidePlugin({
			diff: 'diff',
		}),
		new CopyWebpackPlugin({
			patterns: [
				{
					from: path.resolve(__dirname, 'node_modules/@babel/standalone/babel.min.js'),
					to: path.resolve(__dirname, 'babel.min.js'),
				},
			],
		}),
		new HtmlWebpackPlugin({
			template: 'index.html', // Path to your source HTML file
			filename: 'index.html',
			inject: false, // Prevents duplicating script tags since they are hardcoded in your HTML
		}),
		{
			apply: (compiler) =>
			{
				compiler.hooks.compilation.tap('CacheBusterPlugin', (compilation) =>
				{
					HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
						'CacheBusterPlugin',
						(data, cb) =>
						{
							const timestamp = Date.now();

							// Regex to catch href="..." and src="..." (ignoring external absolute URLs starting with http/https)
							// This appends or replaces the query param with ?t=timestamp
							data.html = data.html.replace(
								(/(href|src)=["'](?!http|\/\/)([^"'\s?]+)(?:\?[^"']*)?["']/g),
								(match, attribute, path) =>
								{
									return `${attribute}="${path}?t=${timestamp}"`;
								}
							);

							cb(null, data);
						}
					);
				});
			},
		},
		{
			apply: (compiler) =>
			{
				// 'afterDone' triggers ONLY after the entire build is finished and written to disk
				compiler.hooks.afterDone.tap('CopyToDocsPlugin', () =>
				{
					try
					{
						// Deep copy the fresh dist folder to docs
						fs.copyFileSync(path.resolve(__dirname, 'dist/index.html'), path.resolve(__dirname, 'index.html'));
						fs.copyFileSync(path.resolve(__dirname, 'dist/app.bundle.js'), path.resolve(__dirname, 'app.bundle.js'));
						console.log('\n🚀 Success: Dynamically mirrored "dist" into "docs" folder.');
					} catch(err)
					{
						console.error('\n❌ Failed to copy assets to docs directory:', err);
					}
				});
			},
		},
	],
	performance: {
		hints: false,
	},
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				exclude: /babel\.min\.js$/,
				parallel: true,
				terserOptions: {
					// Prevents name mangling stripping
					mangle: {
						keep_fnames: true,
						keep_classnames: true, // Optional: keeps class names intact too
					},
					// Prevents optimization passes from discarding or renaming structures
					compress: {
						keep_fnames: true,
						keep_classnames: true,
					}
				},
			}),
		],
	},
};
