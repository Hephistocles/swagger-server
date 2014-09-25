/*jshint unused:strict, undef:true, bitwise:true, eqeqeq:true, latedef:true, eqnull:true */
/* global require, console */

var sg = require("./swagger-server");
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
	},
	getPetById: function(petId) {
		return sg.result(200, {
			"id": "pet_" + petId,
			"name": "Fido"
		});
	},

};

sg(app, 'spec.json', apiImpl);
app.listen(3002);

console.log('Magic happening on port 3002');
