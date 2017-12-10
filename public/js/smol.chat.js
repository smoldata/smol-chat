var smol = smol || {};

smol.chat = (function() {

	var self = {

		init: function() {
			$.get('/api/messages').then(function(rsp) {

				var html = '';
				$.each(rsp.messages, function(i, msg) {
					var esc_message = smol.esc_html(msg.message);
					var esc_when = smol.esc_html(msg.when);
					html += '<li title="' + esc_when + '">' + esc_message + '</li>';
				});
				$('#messages').html(html);

				var height = $('#messages').height();
				var scroll = $('#messages')[0].scrollHeight;
				if (scroll > height) {
					$('#messages').scrollTop(scroll - height);
				}
			});

			$('#msg').focus();
		}

	};

	$(document).ready(self.init);

	return self;
})();
