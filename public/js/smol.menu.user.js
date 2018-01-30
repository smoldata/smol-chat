var smol = smol || {};
smol.menu = smol.menu || {};

smol.menu.user = (function() {

	var notify_status = 'enabled';

	var self = {

		init: function() {

			$('#user-icon').change(function() {
				var icon = $('#user-avatar-preview .avatar-icon')[0].className.match(/icon\d+/);
				if (icon) {
					$('#user-avatar-preview .avatar-icon').removeClass(icon[0]);
				}
				icon = $('#user-icon').val();
				$('#user-avatar-preview .avatar-icon').addClass('icon' + parseInt(icon));
			});

			$('#user-color').change(function() {
				var color = $('#user-avatar-preview')[0].className.match(/color\d+/);
				if (color) {
					$('#user-avatar-preview').removeClass(color[0]);
				}
				color = $('#user-color').val();
				$('#user-avatar-preview').addClass('color' + parseInt(color));
			});

			if ('Notification' in window) {
				if (Notification.permission == 'granted') {
					$('#user-notifications').html('<select><option>enabled</option><option>disabled</option></select>');
					$('#user-notifications select').val(self.get_notify_status());
				} else {
					$('#user-notifications a').click(function(e) {
						e.preventDefault();
						Notification.requestPermission(function(permission) {
							if (permission == 'granted') {
								$('#user-notifications').html('<select><option>enabled</option><option>disabled</option></select>');
								$('#user-notifications select').val(self.get_notify_status());
							}
						});
					});
				}
			} else {
				$('#user-notifications').html('<div class="user-notification-status">Your browser does not support notifications</div>');
			}
		},

		show: function() {

			var user = smol.chat.user;
			$('#user-nickname').val(user.nickname);

			var icon = $('#user-avatar-preview .avatar-icon')[0].className.match(/icon\d+/);
			if (icon) {
				$('#user-avatar-preview .avatar-icon').removeClass(icon[0]);
			}
			$('#user-avatar-preview .avatar-icon').addClass('icon' + parseInt(user.icon));
			$('#user-icon').val(user.icon);

			var color = $('#user-avatar-preview')[0].className.match(/color\d+/);
			if (color) {
				$('#user-avatar-preview').removeClass(color[0]);
			}
			$('#user-avatar-preview').addClass('color' + parseInt(user.color));
			$('#user-color').val(user.color);
		},

		validate: function() {

			var nickname = $('#user-nickname').val();
			if (! smol.chat.set_nickname(nickname)) {
				return {
					ok: 0
				};
			}

			var icon = $('#user-icon').val();
			if (! smol.chat.set_icon(icon)) {
				return {
					ok: 0
				};
			}

			var color = $('#user-color').val();
			if (! smol.chat.set_color(color)) {
				return {
					ok: 0
				};
			}

			self.set_notify_status($('#user-notifications select').val());
			smol.menu.hide();

			return {
				ok: 0 // i.e., don't submit the form data
			};
		},

		get_notify_status: function() {
			if ('localStorage' in window) {
				if (localStorage.notify_status) {
					notify_status = localStorage.notify_status;
				}
			}
			return notify_status;
		},

		set_notify_status: function(status) {
			notify_status = status;
			if ('localStorage' in window) {
				localStorage.notify_status = status;
			}
		}

	};

	return self;
})();
