
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

var users = {};
var rooms = {};

dotdata.init({
	data_dir: path.dirname(__dirname) + '/.data',
	setup_db: function(db) {
		db.run(
			"CREATE TABLE message (" +
				"id INTEGER PRIMARY KEY, " +
				"user_id INTEGER, " +
				"type VARCHAR(32), " +
				"room VARCHAR(32), " +
				"message TEXT, " +
				"created DATETIME," +
				"updated DATETIME" +
			");"
		);
		db.run(
			"CREATE INDEX message_idx (" +
				"id, room, created" +
			");"
		);
	}
});

// For now we re-index on startup
dotdata.db.run("DELETE FROM message;");
sequence.init(dotdata);

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

		var msg_stmt = dotdata.db.prepare(
			"INSERT INTO message " +
			"(id, user_id, type, room, message, created, updated) " +
			"VALUES (?, ?, ?, ?, ?, ?, ?);"
		);

		var name, filename, json, user, msg_message;
		var count = 0;
		for (var i = 0; i < index.data.length; i++) {
			try {

				name = 'rooms:' + room + ':' + index.data[i];
				filename = dotdata.filename(name);
				json = fs.readFileSync(filename);
				msg = JSON.parse(json);

				// Index into db
				msg_message = null;
				if (msg.message) {
					// Ok this is going to sound weird but not all messages
					// have ... message properties. I know I know, it's because
					// some messages are about people joining and leaving rooms.
					// (20180214/dphiffer)
					msg_message = msg.message;
				}
				msg_stmt.run(
					msg.id, msg.user_id, msg.type, msg.room,
					msg_message, msg.created, msg.updated
				);
				count++;

			} catch (err) {
				console.log('Error loading message ' + index.data[i] + ':');
				console.log(err);
			}
		}

		msg_stmt.finalize();
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

	var onsuccess = function() {
		response.send({
			ok: 1,
			messages: msgs
		});
	};

	var where_clause = "WHERE room = $room ";
	var params = {
		$room: request.params.room
	};
	if (request.query.before_id) {
		params['$id'] = parseInt(request.query.before_id);
		where_clause += "AND id < $id ";
	}

	var sql = "SELECT * FROM message " +
	          where_clause +
	          "ORDER BY created DESC " +
	          "LIMIT 100;";

	dotdata.db.each(sql, params, function(err, row) {
		if (err) {
			console.log(err);
		} else {
			msgs.unshift(row);
		}
	}, onsuccess);
});

app.get("/api/users", function(request, response) {
	response.send({
		ok: 1,
		users: users
	});
});

function db_insert_message(msg, user_id) {
	var sql =
		"INSERT INTO message " +
		"(id, user_id, type, room, message, created, updated) " +
		"VALUES (?, ?, ?, ?, ?, ?, ?);";
	dotdata.db.run(sql,
		msg.id, user_id, msg.type, msg.room,
		msg.message, msg.created, msg.updated
	);
}

function db_update_message(msg, user_id) {
	var sql =
		"UPDATE message " +
		"SET " +
			"message = ?, " +
			"updated = ?" +
		"WHERE id = ? AND user_id = ?;";
	dotdata.db.run(sql, msg.message, msg.updated, msg.id, user_id);
}

io.on('connection', function(socket) {

	var user_id;

	var join_room = function(room) {

		if (! user_id || ! users[user_id]) {
			// Wait to join the room until the user fully exists
			return;
		}

		socket.join(room);

		if (! rooms[room]) {
			rooms[room] = [];
		}

		// If this user wasn't already known to be in this room ... we do stuff!
		if (rooms[room].indexOf(user_id) == -1) {

			rooms[room].push(user_id);
			dotdata.set('rooms:' + room, {
				users: rooms[room]
			});

			var created = (new Date()).toJSON();
			var msg = {
				id: sequence.next(),
				user_id: user_id,
				type: 'join_room',
				room: room,
				created: created,
				updated: created
			};
			io.to(room).emit('message', msg);
			dotdata.set('rooms:' + room + ':' + parseInt(msg.id), msg);
			db_insert_message(msg, user_id);
		}
	};

	var leave_room = function(room) {

		socket.leave(room);

		if (! rooms[room]) {
			console.log(user_id + ' leaving room ' + room + ' that ... does not exist?');
			return;
		}

		var index = rooms[room].indexOf(user_id);
		if (index == -1) {
			console.log(user_id + ' leaving room ' + room + ' that ... they are not in?');
			return;
		}

		rooms[room].splice(index, 1);
		dotdata.set('rooms:' + room, {
			users: rooms[room]
		});

		var created = (new Date()).toJSON();
		var msg = {
			id: sequence.next(),
			user_id: user_id,
			type: 'leave_room',
			room: room,
			created: created,
			updated: created
		};
		io.to(room).emit('message', msg);
		dotdata.set('rooms:' + room + ':' + parseInt(msg.id), msg);
		db_insert_message(msg, user_id);
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
		io.emit('user', user);

		for (var i = 0; i < data.rooms.length; i++) {
			join_room(data.rooms[i]);
		}
	});

	socket.on('message', function(data) {
		var user = users[user_id];
		if (data.id) {
			// update message
			var msg = {
				id: parseInt(data.id),
				user_id: parseInt(user_id),
				type: 'message',
				room: user.room,
				message: data.message,
				created: data.created,
				updated: (new Date()).toJSON()
			};
			db_update_message(msg, user_id);
		} else {
			// new message
			var created = (new Date()).toJSON();
			var msg = {
				id: sequence.next(),
				user_id: parseInt(user_id),
				type: 'message',
				room: user.room,
				message: data.message,
				created: created,
				updated: created
			};
			db_insert_message(msg, user_id);
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
