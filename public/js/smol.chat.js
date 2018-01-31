var smol = smol || {};

smol.chat = (function() {

	var sending_timeout = null;
	var last_message = null;
	var users = {};

	var self = {

		user: null,

		init: function() {
			self.setup_socket();
			self.setup_form();
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
			$('#msg').focus();
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

		add_message: function(msg) {
			var user = users[msg.user_id];
			if (! user) {
				console.error('Could not find user ' + msg.user_id);
				console.log('msg', msg);
				return;
			}
			var esc_id = smol.esc_html(msg.user_id);
			var classname = 'message user-' + esc_id;
			var esc_message = smol.esc_html(msg.message);
			esc_message = self.format_message(esc_message);
			var esc_created = smol.esc_html(msg.created);
			var esc_nickname = smol.esc_html(user.nickname);
			var esc_color = smol.esc_html(user.color);
			var esc_icon = smol.esc_html(user.icon);

			if (last_message && last_message.user_id == msg.user_id) {
				classname += ' hide-sender';
			}
			classname += ' color' + esc_color;

			var html = '<li class="' + classname + '" title="' + esc_created + '">' +
			           '<div class="avatar color' + esc_color + '">' +
			           '<div class="avatar-icon icon' + esc_icon + '"></div></div>' +
			           '<div class="nickname" title="Connection ' + esc_id + '">' + esc_nickname + '</div>' +
			           esc_message + '</li>';
			$('#messages').append(html);
			last_message = msg;
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
			if (smol.menu.user.get_notify_status() == 'enabled') {
				var user = users[data.user_id];
				var notification = new Notification(user.nickname, {
					body: data.message
				});
			}
		},

		format_message: function(msg) {
			msg = msg.replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank">$1</a>');
			msg = msg.replace(/`([^`]+)`/g, '<code>$1</code>');
			msg = msg.replace(/(\s)_([^_]+)_/g, '$1<em>$2</em>'); // make sure there's preceding whitespace
			msg = msg.replace(/^_([^_]+)_/g, '<em>$1</em>');      // ... or that it's at the beginning
			msg = msg.replace(new RegExp('(\\s)\\*([^*]+)\\*', 'g'), '$1<strong>$2</strong>');
			msg = msg.replace(new RegExp('^\\*([^*]+)\\*', 'g'), '<strong>$1</strong>');
			return msg;
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
						self.user.id = data.id;
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
		}

	};

	$(document).ready(self.init);

	return self;
})();
