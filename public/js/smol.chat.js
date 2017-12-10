var smol = smol || {};

smol.chat = (function() {

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
				self.socket.emit('message', {
					message: $('#message-input').val()
				});
				$('#message-input').attr('disabled', 'disabled');
			});
		},

		setup_socket: function() {
			var base_url = window.location.href.match(/(https?:\/\/.+?)\//);
			self.socket = io.connect(base_url[1]);
			self.socket.on('message', function(data) {
				self.add_message(data);
				self.update_messages_scroll();
				if (self.socket.id == data.from) {
					$('#message-input').attr('disabled', null);
					$('#message-input').val('');
				}
			});

			$('#msg').focus();
		},

		add_message: function(msg) {
			var esc_message = smol.esc_html(msg.message);
			var esc_when = smol.esc_html(msg.when);
			var html = '<li title="' + esc_when + '">' + esc_message + '</li>';
			$('#messages').append(html);
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
