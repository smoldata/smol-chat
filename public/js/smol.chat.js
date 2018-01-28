var smol = smol || {};

smol.chat = (function() {

	var sending_timeout = null;
	var last_message = null;
	var users = {};

	var self = {

		user: null,

		init: function() {
			self.setup_users(function() {
				self.setup_messages();
			});
			self.setup_socket();
			self.setup_form();
			self.setup_avatar();
			self.setup_colors();
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
				if (typeof cb == 'function') {
					cb();
				}
			});
		},

		setup_form: function() {
			$('#message-form').submit(function(e) {
				e.preventDefault();
				var msg = $('#message-input').val();
				if (self.message_command(msg)) {
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
		},

		setup_avatar: function() {
			self.user = self.get_user();
			self.socket.emit('user', self.user);
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
			self.socket.on('message', function(data) {
				self.add_message(data);
				self.update_messages_scroll();
				if (self.socket.id == data.socket_id) {
					$('#message-input').attr('disabled', null);
					$('#message-input').val('');
					clearTimeout(sending_timeout);
				}
			});
			self.socket.on('user', function(data) {
				users[data.socket_id] = data;
				var esc_nickname = smol.esc_html(data.nickname);
				$('.user-' + data.socket_id + ' .nickname').html(esc_nickname);
			});
			$('#msg').focus();
		},

		add_message: function(msg) {
			var user = users[msg.socket_id];
			if (! user) {
				console.error('Could not find user ' + msg.socket_id);
				console.log('msg', msg);
				return;
			}
			var esc_id = smol.esc_html(msg.socket_id);
			var classname = 'message user-' + esc_id;
			var esc_message = smol.esc_html(msg.message);
			esc_message = self.format_message(esc_message);
			var esc_created = smol.esc_html(msg.created);
			var esc_nickname = smol.esc_html(user.nickname);
			var esc_color = smol.esc_html(user.color);
			var esc_icon = smol.esc_html(user.icon);

			if (last_message && last_message.socket_id == msg.socket_id) {
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

		format_message: function(msg) {
			msg = msg.replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank">$1</a>');
			msg = msg.replace(/`([^`]+)`/g, '<code>$1</code>');
			msg = msg.replace(/_([^_]+)_/g, '<em>$1</em>');
			msg = msg.replace(new RegExp('\\*([^*]+)\\*', 'g'), '<strong>$1</strong>');
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
			if (nick) {
				self.set_nickname(nick[1]);
				return true;
			}
			return false;
		},

		get_user: function() {

			if (self.user) {
				return self.user;
			}

			if (window.localStorage && localStorage.user) {
				try {
					self.user = JSON.parse(localStorage.user);
				} catch(err) {
					console.error(err);
				}
			}

			if (! self.user) {
				self.set_user({
					nickname: smol.names.pick_random(),
					color: Math.ceil(Math.random() * 10),
					icon: Math.ceil(Math.random() * 25)
				});
				$('#menu').addClass('no-animation');
				smol.menu.show('user');
				setTimeout(function() {
					$('#menu').removeClass('no-animation');
				}, 1000);
			}

			return self.user;
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
			$('#avatar').data('nickname', nickname);
			self.set_user({
				nickname: nickname
			});
		}

	};

	$(document).ready(self.init);

	return self;
})();
