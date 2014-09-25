/*jshint unused:strict, undef:true, bitwise:true, eqeqeq:true, latedef:true, eqnull:true */
/* global require, console, module */

var methods = require('methods');
// var http = require('http');
var bodyParser = require('body-parser');
var express = require('express');

/**
 * return an array of function parameters names, so we can match up to the spec
 * Stolen from http://www.2ality.com/2011/01/reflection-and-meta-programming-in.html
 * @param {function(*):*} fun The function to look at
 * @returns {[string]} An array of parameter names
 */
function argumentNames(fun) {
	var names = fun.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
		.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
		.replace(/\s+/g, '').split(',');
	return names.length === 1 && !names[0] ? [] : names;
}

/**
 * Converts a string value to the type specified by parameter.type
 * If parameter.type === "array", parameter.collectionFormat is examined
 * and subitems are parsed with parameter.items as the parameter.
 * @param  {string} value The value to be parsed
 * @param  {Swagger Parameter Object (https://github.com/wordnik/swagger-spec/blob/master/versions/2.0.md#parameterObject)} parameter The parameter to parse with respect to
 * @return {*} A correctly-typed version of value
 */
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
			// further parse array items
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

/**
 * Obtain the value from the request, by looking in the places suggested by parameter.in,
 *  parsing as appropriate
 * @param  {Express Request} req
 * @param  {Swagger Parameter Object} parameter
 * @return {*} A value of type specified by parameter.type
 * @see parseAs
 */
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

/**
 * Add a handler from apiImpl for the given method on the given route. 
 * @param  {string} method The HTTP method for express to listen for
 * @param  {Express Route Object} expressRoute The route to listen on (the result of express.Router().route(...))
 * @param  {Swagger Path Object} specPath The path object from the swagger spec file
 * @param  {Implementation Object} apiImpl
 */
function createRoutingMethod(method, expressRoute, specPath, apiImpl) {
	var pathParams = specPath.parameters ? specPath.parameters : [];
	// check whether this method is defined for this path in the spec
	if (specPath[method] !== undefined) {

		// check the spec provides an operationId (swagger does not require it, but we do)
		// TODO?: parse operationId for namespacing (e.g. 'pet.getById' would use apiImpl['pet']['getById'])
		var operation = specPath[method];
		if (typeof operation.operationId !== 'string')
			throw new Error("Fail, operationId not provided for '" + method + "'");

		// check if we have been provided with an implementation for this operation
		var implementation = apiImpl[operation.operationId];
		if (typeof implementation !== 'function')
			throw new Error("Fail, implementation of " + operation.operationId + " not given for '" + method + "'");

		// actually add the route method
		expressRoute[method](function(req, res) {

			// combine parameter definitions 
			var opParams = operation.parameters ? operation.parameters : [];
			var allParams = pathParams.concat(opParams);

			// obtain the values for each parameter
			var paramValues = {};
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
			var result = implementation.apply(implementation, actualParams);

			// finally return result to the user
			res.status(result.status)
				.set(result.headers)
				.send(result.content);
		});
	}
}

/**
 * Set up express to respond to calls according to the API described in the swagger spec
 * @param  {Express App} app     The express app to use (result of require("express")())
 * @param  {string, object} spec    Either a string containing the location of spec on the filesystem, or the spec object itself
 * @param  {object} apiImpl An object with function members corresponding to operationIds referenced in the spec file
 */
module.exports = function(app, spec, apiImpl) {
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	app.use(bodyParser.json());

	// interpret 'spec' as either an object itself, or as the location of the json spec on filesystem
	if (typeof spec === "string") {
		console.log("Reading spec from file: " + spec);
		spec = JSON.parse(fs.readFileSync(specLocation, 'utf8'));
	} else if (typeof spec === "object") {
		console.log("Treating the given spec as the object itself")
	} else {
		throw new Error("Fail, invalid spec format");
	}

	// verify that this is swagger 2.0 (we don't support <2)
	if (2 !== parseInt(spec.swagger))
		throw new Error("Fail, invalid version");

	// add an express route for every path in the spec
	var router = express.Router();
	for (var path in spec.paths) {

		// prepare Regex to convert /path/to/{id} to /path/to/:id (for express params)
		var pathReplace = new RegExp(/\{([^\}]*)\}/g);
		var route = router.route(path.replace(pathReplace, ":$1"));

		// try to add a handler for every HTTP method
		try {
			for (var i = methods.length - 1; i >= 0; i--) {
				createRoutingMethod(methods[i], route, spec.paths[path], apiImpl);
			}
		} catch (e) {
			e.message += " at path '" + path + "'";
			throw e;
		}
	}

	app.use(spec.basePath, router);
};

/**
 * Helper method for creating result objects in api handlers
 * @param  {int} statusCode The HTTP status code which should be returned from this API call
 * @param  {object} content    The JSON object to return as the body of this call
 * @param  {object} headers    A flat JSON object (i.e. only key-value pairs) to populate headers for the response to this API call
 * @return {Servergen Result Object}            A result object ready for swagger-servergen to return to the client
 */
module.exports.result = function(statusCode, content, headers) {

	// content and headers can be left empty, so populate defaults
	if (typeof content === "undefined") content = {};
	if (typeof headers === "undefined") headers = {};
	
	return {
		status: statusCode,
		content: content,
		headers: headers
	};
};
