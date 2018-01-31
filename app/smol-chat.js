
// First off, tabs not spaces (except to align things). Make it work, then
// make it pretty. Keep it simple and dumb, no magic. (20171210/dphiffer)

var express = require('express');
var body_parser = require('body-parser');
var path = require('path');
var fs = require('fs');
var dotdata = require('./dotdata');
var sequence = require('./sequence');

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
var users = {};

dotdata.index('users').then(function(index) {
	var filename, json, user;
	for (var i = 0; i < index.data.length; i++) {
		filename = dotdata.filename('users:' + index.data[i]);
		try {
			json = fs.readFileSync(filename);
			user = JSON.parse(json);
			users[user.id] = user;
		} catch (err) {
			console.log('Error loading user ' + index.data[i] + ':');
			console.log(err);
		}
	}
});

dotdata.index('messages').then(function(index) {
	var filename, json, user;
	for (var i = 0; i < index.data.length; i++) {
		filename = dotdata.filename('messages:' + index.data[i]);
		try {
			json = fs.readFileSync(filename);
			msg = JSON.parse(json);
			messages.push(msg);
		} catch (err) {
			console.log('Error loading message ' + index.data[i] + ':');
			console.log(err);
		}
	}
});

// Inspired by Artisinal Integers, this just returns an incrementing integer
app.get("/api/id", function(request, response) {
	response.send({
		ok: 1,
		id: sequence.next()
	});
});

app.get("/api/messages", function(request, response) {
	response.send({
		ok: 1,
		messages: messages
	});
});

app.get("/api/users", function(request, response) {
	response.send({
		ok: 1,
		users: users
	});
});

io.on('connection', function(socket) {

	var user_id;

	socket.on('user', function(data) {
		if (! data || ! data.id || ! data.color || ! data.icon || ! data.nickname) {
			console.log('invalid user event:');
			console.log(data);
			return;
		}
		var user = {
			id: parseInt(data.id),
			color: parseInt(data.color),
			icon: parseInt(data.icon),
			nickname: data.nickname
		};
		users[data.id] = user;
		io.emit('user', user);
		dotdata.set('users:' + data.id, user);
		user_id = parseInt(data.id);
	});

	socket.on('message', function(data) {
		var user = users[user_id];
		var msg = {
			id: sequence.next(),
			user_id: parseInt(user.id),
			created: (new Date()).toJSON(),
			message: data.message
		};
		messages.push(msg);
		io.emit('message', msg);
		dotdata.set('messages:' + parseInt(msg.id), msg);
	});
});

// listen for requests :)
var port = process.env.PORT || 4433;
var listener = server.listen(port, function() {
	console.log('Your app is listening on port ' + listener.address().port);
});
