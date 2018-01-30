var smol = smol || {};
smol.menu = smol.menu || {};

smol.menu.user = (function() {

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

			smol.menu.hide();

			return {
				ok: 0 // i.e., don't submit the form data
			};
		}

	};

	return self;
})();
