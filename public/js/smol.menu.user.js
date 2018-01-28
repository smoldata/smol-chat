var smol = smol || {};
smol.menu = smol.menu || {};

smol.menu.user = (function() {

	var self = {

		show: function() {
			$('#user-nickname').val(smol.chat.user.nickname);
		},

		validate: function() {
			var nickname = $('#user-nickname').val();
			smol.chat.set_user({
				nickname: nickname
			});
			smol.menu.hide();
			return {
				ok: 0 // i.e., don't submit the form data
			};
		}

	};

	return self;
})();
