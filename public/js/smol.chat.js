var smol = smol || {};

smol.chat = (function() {

	var sending_timeout = null;
	var last_message = null;
	var users = {};

	var self = {

		init: function() {
			self.setup_users(function() {
				self.setup_messages();
			});
			self.setup_form();
			self.setup_avatar();
			self.setup_colors();
			self.setup_socket();
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

			if (window.localStorage && localStorage.user) {
				try {
					var user = JSON.parse(localStorage.user);
					var nickname = user.nickname;
					var color = user.color;
					var icon = user.icon;
				} catch (err) {
					console.error('Could not restore user from localStorage');
				}
			}

			if (! user) {
				var nickname = smol.names.pick_random();
				var color = Math.ceil(Math.random() * 10);
				var icon = Math.ceil(Math.random() * 25);
				if (window.localStorage) {
					console.log('saving user');
					localStorage.user = JSON.stringify({
						nickname: nickname,
						color: color,
						icon: icon
					});
				}
			}

			$('#avatar').addClass('color' + color);
			$('#avatar-icon').addClass('icon' + icon);
			$('#avatar').data('color', color);
			$('#avatar').data('icon', icon);
			$('#avatar').data('nickname', nickname);
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
			});
			self.socket.emit('user', {
				color: $('#avatar').data('color'),
				icon: $('#avatar').data('icon'),
				nickname: $('#avatar').data('nickname')
			});

			$('#msg').focus();
		},

		add_message: function(msg) {
			var user = users[msg.socket_id];
			if (! user) {
				console.error('Could not find user ' + msg.socket_id);
				return;
			}
			var classname = 'message';
			var esc_message = smol.esc_html(msg.message);
			var esc_created = smol.esc_html(msg.created);
			var esc_nickname = smol.esc_html(user.nickname);
			var esc_color = smol.esc_html(user.color);
			var esc_icon = smol.esc_html(user.icon);

			if (last_message && last_message.socket_id == msg.socket_id) {
				classname += ' hide-sender';
			}

			var html = '<li class="' + classname + '" title="' + esc_created + '">' +
			           '<div class="avatar color' + esc_color + '">' +
			           '<div class="avatar-icon icon' + esc_icon + '"></div></div>' +
			           '<div class="nickname">' + esc_nickname + '</div>' +
			           esc_message + '</li>';
			$('#messages').append(html);
			last_message = msg;
		},

		update_messages_scroll: function() {
			var height = $('#messages').height();
			var scroll = $('#messages')[0].scrollHeight;
			if (scroll > height) {
				$('#messages').scrollTop(scroll - height);
			}
		}

	};

	$(document).ready(self.init);

	return self;
})();
