'use strict';

var fs = require('fs');
var path = require('path');
var resolve = require('require-resolve');

function HtmlWebpackExternalsPlugin (externals, options) {
	this._externals = externals;
	this._options = options;
}

HtmlWebpackExternalsPlugin.prototype.apply = function (compiler) {
	var self = this;
	compiler.options.externals = compiler.options.externals || {};

	if (Array.isArray(compiler.options.externals)) {
		self._externals.forEach(function (external) {
			var obj = {};
			obj[external.name] = external.var === undefined ? 'undefined' : external.var;
			compiler.options.externals.push(obj);
		});
	} else if (typeof compiler.options.externals === 'object') {
		self._externals.forEach(function (external) {
			compiler.options.externals[external.name] = external.var === undefined ? 'undefined' : external.var;
		});
	} else {
		throw new Error('This plugin only works if the existing `externals` is an object or array');
	}

	var assets = {};
	self._externals.forEach(function (external) {
		if (external.url !== undefined && external.path !== undefined) {
			throw new Error('Either `url` or `path` may be defined for a given external, but not both.');
		}

		if (external.path) {
			var absPath = resolve(external.path, self._options.basedir).src;
			var dest = path.join(self._options.dest || 'vendor', external.path);
			var stat = fs.statSync(absPath);
			assets[dest] = {
				size: function () {
					return stat.size;
				},
				source: function () {
					return fs.readFileSync(absPath);
				}
			};
			external._href = dest;
		} else if (external.url) {
			external._href = external.url;
		} else {
			throw new Error('Either `url` or `path` must be defined for a given external.');
		}
	});

	var externalChunks = self._externals
		.filter(function (external) {
			return !/\.css($|\?)$/.test(external._href);
		})
		.map(function (external) {
			return {
				names: [external.name],
				files: [external._href]
			};
		});

	var externalCssFiles = self._externals
		.filter(function (external) {
			return /\.css($|\?)$/.test(external._href);
		})
		.map(function (external) {
			return external._href;
		});

	compiler.plugin('compilation', function (compilation) {
		Object.assign(compilation.assets, assets);
		compilation.plugin('html-webpack-plugin-alter-chunks', function (chunks) {
			var entry = chunks[0].files.shift();
			chunks[0].files = externalCssFiles.concat(chunks[0].files);
			chunks[0].files.unshift(entry);

			chunks = externalChunks.concat(chunks);
			return chunks;
		});
	});
};

module.exports = HtmlWebpackExternalsPlugin;
