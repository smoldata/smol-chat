var smol = smol || {};

smol.chat = (function() {

	var sending_timeout = null;
	var last_message = null;
	var last_time_marker = null;
	var users = {};
	var unread_messages = false;

	var self = {

		user: null,

		init: function() {
			self.setup_socket();
			self.setup_form();
			self.setup_visibility();
			self.setup_users(function() {
				self.setup_messages();
			});
			self.setup_user(function() {
				self.setup_avatar();
				self.setup_colors();
			});
		},

		setup_messages: function() {
			$.get('/api/messages').then(function(rsp) {
				$.each(rsp.messages, function(i, msg) {
					self.add_message(msg);
				});
				self.update_messages_scroll();
			});
		},

		setup_users: function(cb) {
			$.get('/api/users').then(function(rsp) {
				users = rsp.users;
				cb();
			});
		},

		setup_user: function(cb) {

			var new_user = false;
			if (! 'localStorage' in window || ! localStorage.user) {
				new_user = true;
			}

			self.get_user(function() {
				self.socket.emit('user', self.user);
				if (new_user) {
					$('#menu').addClass('no-animation');
					smol.menu.show('user');
					setTimeout(function() {
						$('#menu').removeClass('no-animation');
					}, 1000);
				}
				cb();
			});
		},

		setup_form: function() {
			$('#message-form').submit(function(e) {
				e.preventDefault();
				var msg = $('#message-input').val();
				if (! self.validate_message(msg)) {
					return;
				}
				var cmd = self.message_command(msg);
				if (cmd == -1) {
					return;
				} else if (cmd) {
					$('#message-input').val('');
					return;
				}
				self.socket.emit('message', {
					message: msg
				});
				$('#message-input').val(msg + ' (sending)');
				$('#message-input').attr('disabled', 'disabled');
				sending_timeout = setTimeout(function() {
					$('#message-input').val(msg);
					$('#message-input').attr('disabled', null);
				}, 5000);
			});
			$('#message-input').focus();

			$('#message-input').keypress(function(e) {
				if (e.keyCode == 38) { // up arrow
					var $msgs = $('.message.user-' + self.user.id);
					if ($msgs.length > 0) {
						var last_sent = $msgs[$msgs.length - 1];
						var id = parseInt($(last_sent).data('id'));
						self.edit_message(id);
					}
				}
			});
		},

		setup_avatar: function() {
			$('#avatar').addClass('color' + self.user.color);
			$('#avatar-icon').addClass('icon' + self.user.icon);
			$('#avatar').data('color', self.user.color);
			$('#avatar').data('icon', self.user.icon);
			$('#avatar').data('nickname', self.user.nickname);
			$('#avatar').click(function(e) {
				e.preventDefault();
				smol.menu.show('user');
			});
		},

		setup_colors: function() {
			$(document.body).addClass('color' + self.user.color);
			var rgb = smol.color.get_rgb('#avatar');
			var hsl = smol.color.rgb2hsl(rgb);
			hsl.l = 50;
			var dark = smol.color.hsl2rgb(hsl);
			var dark = 'rgb(' + dark.r + ', ' + dark.g + ', ' + dark.b + ')';
			hsl.l = 100;
			var light = smol.color.hsl2rgb(hsl);
			var light = 'rgb(' + light.r + ', ' + light.g + ', ' + light.b + ')';
			$('#message-input').css('background-color', dark);
			$('#message-submit').css('background-color', light);
			self.update_favicon();
		},

		setup_socket: function() {
			var base_url = window.location.href.match(/(https?:\/\/.+?)\//);
			self.socket = io.connect(base_url[1]);
			self.socket.on('reconnect', function(data) {
				self.socket.emit('user', self.user);
			});
			self.socket.on('message', function(data) {
				self.add_message(data);
				self.notify(data);
				self.update_messages_scroll();
				if (self.user.id == data.user_id) {
					$('#message-input').attr('disabled', null);
					$('#message-input').val('');
					clearTimeout(sending_timeout);
				}
			});
			self.socket.on('user', function(data) {
				users[data.id] = data;
				var esc_nickname = smol.esc_html(data.nickname);
				$('.user-' + data.id + ' .nickname').html(esc_nickname);
				$('.user-' + data.id + ' .avatar').each(function(i, el) {
					var old_color = el.className.match(/color\d+/);
					if (old_color) {
						$(el).removeClass(old_color[0]);
						$(el).addClass('color' + data.color);
					}
				});
				$('.user-' + data.id + ' .avatar-icon').each(function(i, el) {
					var old_icon = el.className.match(/icon\d+/);
					if (old_icon) {
						$(el).removeClass(old_icon[0]);
						$(el).addClass('icon' + data.icon);
					}
				});
			});
		},

		setup_visibility: function() {
			$(document).on('visibilitychange', function() {
				if (document.visibilityState == 'visible') {
					unread_messages = false;
				}
				self.update_favicon();
			});
		},

		validate_message: function(msg) {
			if (msg == '') {
				return false;
			}
			if (msg.match(/^\s+$/)) {
				return false;
			}
			return true;
		},

		add_message: function(msg) {

			var user = users[msg.user_id];
			if (! user) {
				console.error('Could not find user ' + msg.user_id);
				console.log('msg', msg);
				return;
			}

			// Editing an existing message
			if ($('#message-' + msg.id).length > 0) {
				var html = self.format_message(msg.message);
				var esc_html = smol.esc_html(html);
				$('#message-' + msg.id + ' .body').html(esc_html);
				$('#message-' + msg.id).addClass('edited');
				$('#message-' + msg.id).data('message', msg.message);
				return;
			}

			var curr_created = new Date(msg.created);
			var threshold = 1000 * 60 * 5;

			if (last_time_marker) {
				var time_diff = curr_created.getTime() - last_time_marker.getTime();
			}
			if (! last_time_marker || time_diff > threshold) {
				last_time_marker = curr_created;
				var curr_time = self.format_time(curr_created);
				self.add_system_message({
					message: curr_time
				});
			}

			var esc_id = smol.esc_html(msg.id);
			var esc_user_id = smol.esc_html(msg.user_id);
			var classname = 'message user-' + esc_user_id;
			var esc_message = smol.esc_html(msg.message);
			var esc_html_message = self.format_message(esc_message);
			var esc_created = smol.esc_html(msg.created);
			var esc_nickname = smol.esc_html(user.nickname);
			var esc_color = smol.esc_html(user.color);
			var esc_icon = smol.esc_html(user.icon);

			if (last_message && last_message.user_id == msg.user_id) {
				classname += ' hide-sender';
			}
			classname += ' color' + esc_color;

			if (msg.created && msg.updated && msg.created != msg.updated) {
				classname += ' edited';
			}

			var html = '<li id="message-' + esc_id + '" class="' + classname + '" ' +
			              ' data-message="' + esc_message + '" data-id="' + esc_id + '" data-created="' + esc_created + '">' +
			           '<div class="avatar color' + esc_color + '">' +
			           '<div class="avatar-icon icon' + esc_icon + '"></div></div>' +
			           '<div class="content">' +
			           '<div class="nickname">' + esc_nickname + '</div>' +
			           '<div class="body">' + esc_html_message + '</div>' +
			           '</div><br class="clear"></li>';
			$('#messages').append(html);
			last_message = msg;

			if (msg.user_id == self.user.id) {
				$('#message-' + esc_id).mouseenter(function() {
					$('#message-' + esc_id).append('<span class="edit">edit</span>');
				});
				$('#message-' + esc_id).mouseleave(function() {
					$('#message-' + esc_id + ' .edit').remove();
				});
				$('#message-' + esc_id).click(function(e) {
					if (! $(e.target).hasClass('edit')) {
						return true;
					}
					self.edit_message(parseInt(esc_id));
				});
			}
		},

		add_system_message: function(msg) {
			var esc_message = smol.esc_html(msg.message);
			var html = '<li class="system-message">' + esc_message + '</li>';
			$('#messages').append(html);
			last_message = msg;
			self.update_messages_scroll();
		},

		notify: function(data) {
			if (! 'Notification' in window) {
				return;
			}
			if (self.user.id == data.user_id) {
				return;
			}
			if (Notification.permission != 'granted') {
				return;
			}
			if (document.visibilityState == 'visible') {
				return;
			}

			unread_messages = true;
			self.update_favicon();
			$('#notify-audio')[0].play();

			if (smol.menu.user.get_notify_status() == 'disabled') {
				return;
			}
			if (smol.menu.user.get_notify_status() == 'mentions' &&
			    ! self.check_message_mention(data)) {
				return;
			}

			var user = users[data.user_id];
			var notification = new Notification(user.nickname, {
				body: data.message
			});
		},

		edit_message: function(id) {
			if ($('#message-' + id).length == 0) {
				return;
			}

			var msg = $('#message-' + id).data('message');
			$('#message-' + id).addClass('editing');

			var cancel_edit = function() {
				$('#message-' + id).removeClass('editing');
				var body = self.format_message(msg);
				$('#message-' + id + ' .body').html(body);
				$('#message-input').focus();
			}

			var html = '<form><input type="text">' +
			           '<div class="buttons">' +
			           '<button type="submit" class="btn btn-save">Update</button>' +
			           '<button class="btn btn-cancel">Cancel</button>' +
			           '</div></form>';
			$('#message-' + id + ' .body').html(html);
			$('#message-' + id + ' input').val(msg);
			$('#message-' + id + ' input').focus();

			$('#message-' + id + ' input').keypress(function(e) {
				if (e.keyCode == 27) {
					cancel_edit();
				}
			});

			$('#message-' + id + ' form').submit(function(e) {
				e.preventDefault();
				var message = $('#message-' + id + ' input').val();
				if (! self.validate_message(message)) {
					return;
				}
				self.socket.emit('message', {
					id: id,
					created: $('#message-' + id).data('created'),
					message: message
				});
				$('#message-' + id).removeClass('editing');
				$('#message-input').focus();
			});

			$('#message-' + id + ' .btn-cancel').click(function(e) {
				e.preventDefault();
				cancel_edit();
			});

			self.update_messages_scroll();
		},

		update_favicon: function() {
			var favicon = self.user.color;
			if (self.user.color % 2 == 1) {
				favicon++;
			}
			var status = '';
			if (unread_messages) {
				status = '-unread';
			}
			var url = '/img/favicon' + favicon + status + '.png';
			$('#favicon').attr('href', url);
		},

		format_message: function(msg) {
			msg = msg.replace(/https?:\/\/\S+/g, function(url) {
				var text = url;
				if (text.length > 64) {
					text = text.substr(0, 64) + '...';
				}
				return '<a href="' + url + '" target="_blank">' + text + '</a>';
			});
			msg = msg.replace(/`([^`]+)`/g, '<code>$1</code>');
			msg = msg.replace(/(\s)_([^_]+)_/g, '$1<em>$2</em>'); // make sure there's preceding whitespace
			msg = msg.replace(/^_([^_]+)_/g, '<em>$1</em>');      // ... or that it's at the beginning
			msg = msg.replace(new RegExp('(\\s)\\*([^*]+)\\*', 'g'), '$1<strong>$2</strong>');
			msg = msg.replace(new RegExp('^\\*([^*]+)\\*', 'g'), '<strong>$1</strong>');
			msg = msg.replace(/@(all|channel|everyone|here)/g, '<strong>@$1</strong>');
			for (id in users) {
				msg = msg.replace(new RegExp('@(' + users[id].nickname + ')', 'g'), '<strong>@$1</strong>');
			}
			return msg;
		},

		format_time: function(when) {
			var h = when.getHours();
			var mm = when.getMinutes();
			var a = 'am';
			if (h > 12) {
				h -= 12;
				a = 'pm';
			}
			if (mm < 10) {
				mm = '0' + mm;
			}
			var day = self.format_day(when);

			return day + h + ':' + mm + a;
		},

		format_day: function(when) {
			var date = self.get_iso_date(when);
			var today_date = self.get_iso_date(new Date());
			var yesterday_time = (new Date()).getTime() - 24 * 60 * 60 * 1000;
			var yesterday_date = self.get_iso_date(new Date(yesterday_time));
			if (date == today_date) {
				return '';
			}
			if (date == yesterday_date) {
				return 'yesterday, ';
			}
			var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			var month = months[when.getMonth()];
			return month + ' ' + when.getDate() + ', ';
		},

		get_iso_date: function(when) {
			// Returns YYYY-MM-DD
			var yyyy = when.getYear() + 1900;
			var mm = when.getMonth() + 1;
			if (mm < 10) {
				mm = '0' + mm;
			}
			var dd = when.getDate();
			if (dd < 10) {
				dd = '0' + dd;
			}
			return yyyy + '-' + mm + '-' + dd;
		},

		update_messages_scroll: function() {
			var height = $('#messages').height();
			var scroll = $('#messages')[0].scrollHeight;
			if (scroll > height) {
				$('#messages').scrollTop(scroll - height);
			}
		},

		message_command: function(msg) {
			var nick = msg.match(/^\/nick (.+)$/);
			var icon = msg.match(/^\/icon (\d+)$/);
			var color = msg.match(/^\/color (\d+)$/);
			if (nick) {
				if (! self.set_nickname(nick[1])) {
					return -1;
				}
				return true;
			} else if (icon) {
				if (! self.set_icon(icon[1])) {
					return -1;
				}
				return true;
			} else if (color) {
				if (! self.set_color(color[1])) {
					return -1;
				}
				return true;
			}
			return false;
		},

		get_user: function(cb) {

			if (typeof cb != 'function') {
				console.error('you have to call get_user with a callback');
				return false;
			}

			if (self.user) {
				if (! self.user.id) {
					// This is for backwards-compatibility.
					$.get('/api/id', function(data) {
						self.set_user({
							id: data.id
						});
						cb(self.user);
					});
				} else {
					cb(self.user);
				}
				return;
			}

			if (window.localStorage && localStorage.user) {
				try {
					self.user = JSON.parse(localStorage.user);
				} catch(err) {
					console.error(err);
				}
			}

			if (! self.user) {
				$.get('/api/id', function(data) {
					self.set_user({
						id: data.id,
						nickname: smol.names.pick_random(),
						color: Math.ceil(Math.random() * 10),
						icon: Math.ceil(Math.random() * 25)
					});
					cb(self.user);
				});
			} else if (! self.user.id) {
				// This is for backwards-compatibility.
				$.get('/api/id', function(data) {
					self.set_user({
						id: data.id
					});
					cb(self.user);
				});
			} else {
				cb(self.user);
			}
		},

		set_user: function(props) {

			var user = {};

			if (window.localStorage && localStorage.user) {
				try {
					user = JSON.parse(localStorage.user);
				} catch(err) {
					console.error(err);
				}
			}

			for (key in props) {
				user[key] = props[key];
			}

			if (window.localStorage) {
				localStorage.user = JSON.stringify(user);
			}

			self.user = user;
			self.socket.emit('user', user);

			return user;
		},

		set_nickname: function(nickname) {
			if (! nickname.match(/^[a-z0-9_]+$/i)) {
				alert('Sorry, your nickname can only include letters, numbers, or underscores.');
				return false;
			}
			self.set_user({
				nickname: nickname
			});
			return true;
		},

		set_icon: function(icon) {
			icon = parseInt(icon);
			if (icon < 1 || icon > 25) {
				alert('Sorry, your icon must be a number between 1 and 25.');
				return false;
			}
			$('#avatar-icon').removeClass('icon' + self.user.icon);
			$('#avatar-icon').addClass('icon' + icon);
			self.set_user({
				icon: icon
			});
			return true;
		},

		set_color: function(color) {
			color = parseInt(color);
			if (color < 1 || color > 10) {
				alert('Sorry, your color must be a number between 1 and 10.');
				return false;
			}
			$('#avatar').removeClass('color' + self.user.color);
			$('#avatar').addClass('color' + color);
			self.set_user({
				color: color
			});
			self.setup_colors();
			return true;
		},

		check_message_mention: function(data) {
			if (data.message.match(/@(all|channel|everyone|here)/)) {
				return true;
			}
			if (data.message.indexOf('@' + self.user.nickname) !== -1) {
				return true;
			}
			return false;
		}

	};

	$(document).ready(self.init);

	return self;
})();
