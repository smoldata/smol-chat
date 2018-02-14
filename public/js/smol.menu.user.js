var smol = smol || {};
smol.menu = smol.menu || {};

smol.menu.user = (function() {

	var notify_status = 'mentions';

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
				var select_html = '<select>' +
				                  '<option value="all">enabled: all messages</option>' +
				                  '<option value="mentions">enabled: @user mentions</option>' +
				                  '<option>disabled</option>' +
				                  '</select>';
				if (Notification.permission == 'granted') {
					$('#user-notifications').html(select_html);
					$('#user-notifications select').val(self.get_notify_status());
				} else {
					$('#user-notifications a').click(function(e) {
						console.log('clicked notification button');
						e.preventDefault();
						Notification.requestPermission(function(permission) {
							console.log('notification permission = ' + permission);
							if (permission == 'granted') {
								$('#user-notifications').html(select_html);
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
			var icon = $('#user-icon').val();
			var color = $('#user-color').val();
			var user = {
				nickname: nickname,
				icon: icon,
				color: color
			};
			if (! smol.chat.set_user(user)) {
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
			if (notify_status == 'enabled') {
				notify_status = 'mentions';
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
