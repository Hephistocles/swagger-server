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
	updatePet: function(pet) {
		return sg.result(200, {
			"success": "true",
			"petname": pet.name,
			"pet": pet
		});
	},
	getPetById: function(petId) {
		return sg.result(200, {
			name: "Hilary",
			"myid": "pet" + petId + ".1",
			"test": "true"
		});
	}
};

sg(app, 'spec.json', apiImpl);
app.listen(8181);

console.log('Magic happening on port 8181');