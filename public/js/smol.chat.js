var smol = smol || {};

smol.chat = (function() {

	var sending_timeout = null;
	var last_message = null;

	var self = {

		init: function() {
			self.setup_messages();
			self.setup_form();
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

		setup_form: function() {
			$('#message-form').submit(function(e) {
				e.preventDefault();
				var msg = $('#message-input').val();
				self.socket.emit('message', {
					sender: 'dphiffer',
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

			$('#msg').focus();
		},

		add_message: function(msg) {

			var classname = 'message';
			var esc_sender = smol.esc_html(msg.sender);
			var esc_message = smol.esc_html(msg.message);
			var esc_created = smol.esc_html(msg.created);

			if (last_message && last_message.sender == msg.sender) {
				classname += ' hide-sender';
			}

			var html = '<li class="' + classname + '" title="' + esc_created + '"><div class="sender">' + esc_sender + '</div>' + esc_message + '</li>';
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
