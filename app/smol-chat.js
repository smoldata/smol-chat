
// First off, tabs not spaces (except to align things). Make it work, then
// make it pretty. Keep it simple and dumb, no magic. (20171210/dphiffer)

var express = require('express');
var body_parser = require('body-parser');
var path = require('path');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(body_parser.json()); // application/json
app.use(body_parser.urlencoded({ extended: true })); // application/x-www-form-urlencoded

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
	var root = path.dirname(__dirname);
	response.sendFile(root + '/views/index.html');
});

var messages = [];

app.get("/api/messages", function(request, response) {
	response.send({
		ok: 1,
		messages: messages
	});
});

app.post("/api/message", function(request, response) {
	if (request.body.message) {
		messages.push({
			message: request.body.message,
			when: (new Date()).toJSON()
		});
	}
	response.redirect('/');
});

io.on('connection', function(socket) {
	socket.on('message', function(data) {
		var msg = {
			from: socket.id,
			message: data.message,
			when: (new Date()).toJSON()
		};
		messages.push(msg);
		io.emit('message', msg);
	});
});

// listen for requests :)
var port = process.env.PORT || 4433;
var listener = server.listen(port, function() {
	console.log('Your app is listening on port ' + listener.address().port);
});
