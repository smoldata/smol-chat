
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
var rooms = {};

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
			if (! user.rooms) {
				user.rooms = ['commons'];
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

	dotdata.get('rooms:' + room).then(function(data) {
		rooms[room] = data.users;
	}).catch(function(err) {
		rooms[room] = [];
	});

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

app.get("/api/rooms", function(request, response) {
	var rooms = [];
	for (var room in messages) {
		rooms.push(room);
	}
	rooms.sort(function(a, b) {
		if (a == 'commons') {
			return -1;
		} else if (b == 'commons') {
			return 1;
		} else if (a.toLowerCase() < b.toLowerCase()) {
			return -1;
		} else {
			return 1;
		}
	});
	response.send({
		ok: 1,
		rooms: rooms
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

	var join_room = function(room) {
		console.log('join_room() ' + room + ' / ' + user_id);
		socket.join(room);

		if (! rooms[room]) {
			rooms[room] = [];
		}
		if (rooms[room].indexOf(user_id) == -1) {
			io.to(room).emit('join', users[user_id], room);
			rooms[room].push(user_id);
			dotdata.set('rooms:' + room, {
				users: rooms[room]
			});
		}
	};

	var leave_room = function(room) {
		console.log('leave_room() ' + room + ' / ' + user_id);
		socket.leave(room);
		if (rooms[room]) {
			var index = rooms[room].indexOf(user_id);
			if (index != -1) {
				io.to(room).emit('leave', users[user_id], room);
				rooms[room].splice(index, 1);
				dotdata.set('rooms:' + room, {
					users: rooms[room]
				});
			}
		}
	};

	socket.on('user', function(data) {
		if (! data ||
		    ! data.id ||
		    ! data.color ||
		    ! data.icon ||
		    ! data.nickname ||
		    ! data.room ||
		    ! data.rooms) {
			console.log('invalid user event:');
			console.log(data);
			return;
		}

		if (! data.nickname.match(/^[a-z0-9_-]+$/i)) {
			console.log('invalid nickname:');
			console.log(data);
			return;
		}
		if (! data.room.match(/^[a-z0-9_-]+$/i)) {
			console.log('invalid room:');
			console.log(data);
			return;
		}
		var user = {
			id: parseInt(data.id),
			color: parseInt(data.color),
			icon: parseInt(data.icon),
			nickname: data.nickname,
			room: data.room,
			rooms: data.rooms
		};
		users[data.id] = user;
		dotdata.set('users:' + data.id, user);
		user_id = parseInt(data.id);

		console.log(data.rooms);
		for (var i = 0; i < data.rooms.length; i++) {
			join_room(data.rooms[i]);
		}

		io.emit('user', user);
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
			if (! messages[user.room]) {
				messages[user.room] = [];
			}
			messages[user.room].push(msg);
		}
		io.to(user.room).emit('message', msg);
		dotdata.set('rooms:' + user.room + ':' + parseInt(msg.id), msg);
	});

	socket.on('join', function(user, room) {
		if (! room.match(/^[a-z0-9_-]+$/i)) {
			console.log('invalid room:');
			console.log(data);
			return;
		}
		if (! messages[room]) {
			messages[room] = [];
		}
		var rooms_dir = dotdata.dirname('rooms');
		if (! fs.existsSync(rooms_dir)) {
			self.mkdir(rooms_dir + '/' + room);
			dotdata.update_index(rooms_dir);
		}
		join_room(room);
	});

	socket.on('leave', function(user, room) {
		if (! room.match(/^[a-z0-9_-]+$/i)) {
			console.log('invalid room:');
			console.log(data);
			return;
		}
		leave_room(room);
	});
});

// listen for requests :)
var port = process.env.PORT || 4433;
var listener = server.listen(port, function() {
	console.log('listening on port ' + listener.address().port);
});
