swagger-server
==============

A node package which creates a RESTful express server stub from a swagger specification file [such as this one](https://github.com/wordnik/swagger-spec/blob/master/versions/2.0.md). 
The API creator can now define the API formally via a swagger specification file, and move 
straight on to API implementation without worrying about the details of the REST server itself.

This project is at a very early stage, and by no means supports the entire swagger specification yet.
It hopefully will soon, though!

Usage
-----

An example is included in spec.json, and is also reproduced below for good measure. This represents
all the code the API provider is expected to write - the rest just works.

#### Example spec file
Please note that this is not strictly speaking a valid Swagger specification at this point. This
demonstrates the set of properties which swagger-server currently supports, which is currently
smaller than the set of required properties for valid Swagger specifications. Your specification files 
can of course follow the actual Swagger specifications - the additional properties will simply be
ignored by swagger-server.

``` 
{
    "swagger": "2",
    "basePath": "/pet",
    "paths": {
        "/": {
            "get": {
                "operationId" : "getAllPets"
            },
            "post": {
                "operationId": "createPet",
                "parameters": [
                    {
                        "name": "pet",
                        "in": "body"
                    }
                ]
            }
        },
        "/{petId}": {
            "get": {
                "operationId": "changePetName",
                "parameters": [
                    {
                        "name": "petId",
                        "in": "path"
                    },
                    { 
                        "name": "petName",
                        "in":"body"
                    }
                ]
            }
        }
    }
}
```

#### Example Implementation
Here the specification file location is passed to swagger-server. It is also possible to pass a 
specification object directly.

```
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
app.listen(80);
```
