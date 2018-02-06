
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

var messages = {};
var users = {};

dotdata.init({
	data_dir: path.dirname(__dirname) + '/.data'
});

dotdata.index('users').then(function(index) {
	var filename, json, user;
	var count = 0;
	for (var i = 0; i < index.data.length; i++) {
		filename = dotdata.filename('users:' + index.data[i]);
		try {
			json = fs.readFileSync(filename);
			user = JSON.parse(json);
			if (! user.room) {
				user.room = 'commons';
			}
			users[user.id] = user;
			count++;
		} catch (err) {
			console.log('Error loading user ' + index.data[i] + ':');
			console.log(err);
		}
	}
	console.log('loaded ' + count + ' users');
});

function index_room(room) {
	dotdata.index('rooms:' + room).then(function(index) {
		var name, filename, json, user;
		for (var i = 0; i < index.data.length; i++) {
			try {
				name = 'rooms:' + room + ':' + index.data[i];
				filename = dotdata.filename(name);
				json = fs.readFileSync(filename);
				msg = JSON.parse(json);
				if (! messages[room]) {
					messages[room] = [];
				}
				messages[room].push(msg);
			} catch (err) {
				console.log('Error loading message ' + index.data[i] + ':');
				console.log(err);
			}
		}
		if (messages[room]) {
			messages[room].sort(function(a, b) {
				if (a.created < b.created) {
					return -1;
				} else {
					return 1;
				}
			});
		}
		var count = messages[room].length;
		console.log('loaded ' + count + ' messages in ' + room);
	});
}

dotdata.index('rooms').then(function(index) {
	for (var i = 0; i < index.dirs.length; i++) {
		index_room(index.dirs[i]);
	}
});

// Homepage
app.get("/", function(request, response) {
	var root = path.dirname(__dirname);
	response.sendFile(root + '/views/index.html');
});

// Inspired by Artisinal Integers, this just returns an incrementing integer
app.get("/api/id", function(request, response) {
	response.send({
		ok: 1,
		id: sequence.next()
	});
});

app.get("/api/:room/messages", function(request, response) {
	var msgs = [];
	if (request.params.room in messages) {
		msgs = messages[request.params.room];
	}
	response.send({
		ok: 1,
		messages: msgs
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
		if (! data ||
		    ! data.id ||
		    ! data.color ||
		    ! data.icon ||
		    ! data.nickname ||
		    ! data.room) {
			console.log('invalid user event:');
			console.log(data);
			return;
		}
		if (! data.nickname.match(/^[a-z0-9_]+$/i)) {
			console.log('invalid nickname:');
			console.log(data);
			return;
		}
		if (! data.room.match(/^[a-z0-9_]+$/i)) {
			console.log('invalid room:');
			console.log(data);
			return;
		}
		var user = {
			id: parseInt(data.id),
			color: parseInt(data.color),
			icon: parseInt(data.icon),
			nickname: data.nickname,
			room: data.room
		};
		users[data.id] = user;
		dotdata.set('users:' + data.id, user);
		user_id = parseInt(data.id);
		io.emit('user', user);
		socket.join(data.room);
	});

	socket.on('message', function(data) {
		var user = users[user_id];
		if (data.id) {
			var msg = {
				id: parseInt(data.id),
				user_id: parseInt(user.id),
				room: user.room,
				message: data.message,
				created: data.created,
				updated: (new Date()).toJSON()
			};
			for (var i = 0; i < messages.length; i++) {
				if (messages[i].id == msg.id) {
					messages[i] = msg;
				}
			}
		} else {
			var created = (new Date()).toJSON();
			var msg = {
				id: sequence.next(),
				user_id: parseInt(user.id),
				room: user.room,
				message: data.message,
				created: created,
				updated: created
			};
			messages[user.room].push(msg);
		}
		io.to(user.room).emit('message', msg);
		dotdata.set('rooms:' + user.room + ':' + parseInt(msg.id), msg);
	});
});

// listen for requests :)
var port = process.env.PORT || 4433;
var listener = server.listen(port, function() {
	console.log('listening on port ' + listener.address().port);
});
