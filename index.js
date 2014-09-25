/*jshint unused:strict, undef:true, bitwise:true, eqeqeq:true, latedef:true, eqnull:true */
/* global require, console */

var sg = require("./swagger-servergen");
var express = require("express");
var app = express();

var apiImpl = {
	getAllPets: function() {
		return sg.result(200, ["List", "of", "pets"]);
	},
	createPet: function(pet) {
		return sg.result(200, "Success!");
	},
	changePetName: function(petId, petName) {
		return sg.result(200, {
			"id": "pet_" + petId,
			"nameChangedTo": petName
		});
	}
};

sg(app, 'spec.json', apiImpl);
app.listen(8181);

console.log('Magic happening on port 8181');
