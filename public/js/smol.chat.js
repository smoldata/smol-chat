var smol = smol || {};

smol.chat = (function() {

	var self = {

		init: function() {
			$.get('/api/messages').then(function(rsp) {
				var html = '';
				$.each(rsp.messages, function(i, msg) {
					html += '<li title="' + msg.when + '">' + msg.message + '</li>';
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
