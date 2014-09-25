/*jshint unused:strict, undef:true, bitwise:true, eqeqeq:true, latedef:true, eqnull:true */
/* global require, console, module */

var methods = require('methods');
var fs = require('fs');
// var http = require('http');
var bodyParser = require('body-parser');
var express = require('express');

// return an array of function parameters names, so we can match up to the spec
function argumentNames(fun) {
	var names = fun.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
		.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
		.replace(/\s+/g, '').split(',');
	return names.length === 1 && !names[0] ? [] : names;
}


function parseAs(value, parameter) {
	switch (parameter.type) {
		case "string":
			return value;
		case "number":
			return parseFloat(value);
		case "integer":
			return parseInt(value);
		case "boolean":
			return ("true" === value);
		case "array":
			switch (parameter.collectionFormat) {
				case "ssv":
					value = value.split(" ");
					break;
				case "tsv":
					value = value.split("\t");
					break;
				case "pipes":
					value = value.split("|");
					break;
				case "csv":
					/* falls through */
				default:
					value = value.split(",");
					break;
			}
			return value.map(function(item) {
				parseAs(item, parameter.items);
			});
		case "file":
			// TODO: handle these cases
			break;
		default:
			return value;
	}
}

function getValue(req, parameter) {
	var value;
	switch (parameter.in) {
		case "query":
			if (req.query[parameter.name] === undefined) {
				value = parameter.default;
				break;
			}
			value = req.query[parameter.name];
			break;
		case "header":
			if (req.header(parameter.name) === undefined) {
				value = parameter.default;
				break;
			}
			value = req.header(parameter.name);
			break;
		case "path":
			if (req.params[parameter.name] === undefined) {
				value = parameter.default;
				break;
			}
			value = req.params[parameter.name];
			break;
		case "formData":
			if (req.body[parameter.name] === undefined) {
				value = parameter.default;
				break;
			}
			value = req.body[parameter.name];
			break;
		case "body":
			// TODO: check up on the parameter.schema stuff
			if (req.body[parameter.name] === undefined) {
				value = parameter.schema.default;
				break;
			}
			value = req.body[parameter.name];
			break;
		default:
			// TODO: handle malformed spec
			value = null;
			break;
	}
	return parseAs(value, parameter);
}

function createRoutingMethod(expressRoute, specPath, apiImpl) {
	console.log(specPath);
	var pathParams = specPath.parameters;
	if (typeof pathParams === "undefined") pathParams = [];
	return function(method) {
		// check whether this method is defined for this path in the spec
		if (specPath[method] !== undefined) {

			// check the spec provides an operationId (swagger does not require it, but we do)
			var operation = specPath[method];
			if (typeof operation.operationId !== 'string')
				throw new Error("Fail, operationId not provided for '" + method + "'");

			// check if we have been provided with an implementation for this operation
			var implementation = apiImpl[operation.operationId];
			if (typeof implementation !== 'function')
				throw new Error("Fail, implementation of " + operation.operationId + " not given for '" + method + "'");

			// actually add the route method
			expressRoute[method](function(req, res) {
				var opParams = operation.parameters ? operation.parameters : [];
				var allParams = pathParams.concat(opParams);

				// obtain the values for each parameter
				var paramValues = {};
				console.log("\tConsidering: ");
				console.log(allParams);

				allParams.forEach(function(parameter) {
					// TODO?: validate value
					paramValues[parameter.name] = getValue(req, parameter);
				});

				// map the values to formal parameters by name
				var actualParams = [];
				var formalParams = argumentNames(implementation);
				for (var i = formalParams.length - 1; i >= 0; i--) {
					actualParams[i] = paramValues[formalParams[i]];
				}

				// call the implementation method
				var result = implementation.apply(implementation,actualParams);

				res.status(result.status)
					.set(result.headers)
					.send(result.content);
			});
		}
	};
}

module.exports = function (app, specLocation, apiImpl) {
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	app.use(bodyParser.json());

	var json = JSON.parse(fs.readFileSync(specLocation, 'utf8'));
	if (2 !== parseInt(json.swagger))
		throw new Error("Fail, invalid version");
	var pathReplace = new RegExp(/\{([^\}]*)\}/g);
	var router = express.Router();

	for (var path in json.paths) {
		var route = router.route(path.replace(pathReplace, ":$1"));
		console.log("looking at " + path);
		try {
			methods.forEach(createRoutingMethod(route, json.paths[path], apiImpl));
		} catch (e) {
			e.message += " at path '" + path + "'";
			throw e;
		}
	}

	app.use(json.basePath, router);
};

module.exports.result = function (statusCode, content, headers) {
	if (typeof content === "undefined") content = {};
	if (typeof headers === "undefined") headers = {};
	return {
		status: statusCode,
		content: content,
		headers: headers
	};
};