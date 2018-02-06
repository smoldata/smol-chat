var smol = smol || {};
smol.sidebar = (function() {

	var self = {

		update_rooms: function(rooms) {
			for (var i = rooms.length - 1; i >= 0; i--) {
				var esc_room = smol.esc_html(rooms[i]);
				if ($('#sidebar-room-' + esc_room).length == 0) {
					var icon = '<span class="fa fa-circle-o"></span>';
					var html = '<li id="sidebar-room-' + esc_room + '" data-room="' + esc_room + '"> ' + icon + esc_room + '</li>';
					$('#sidebar-room-list').prepend(html);
					$('#sidebar-room-' + esc_room).click(self.room_click);
				}
			}
		},

		set_room: function(room) {
			var esc_room = smol.esc_html(room);
			if ($('#sidebar-room-' + esc_room).length == 0) {
				var icon = '<span class="fa fa-circle"></span>';
				var html = '<li id="sidebar-room-' + esc_room + '" data-room="' + esc_room + '"> ' + icon + esc_room + '</li>';
				$('#sidebar-room-list').prepend(html);
				$('#sidebar-room-' + esc_room).click(self.room_click);
			}
			$('#sidebar-room-list .fa-check-circle').addClass('fa-circle-o');
			$('#sidebar-room-list .fa-check-circle').removeClass('fa-check-circle');
			$('#sidebar-room-list .selected').removeClass('selected');

			var $room_li = $('#sidebar-room-' + esc_room);
			var $room_fa = $('#sidebar-room-' + esc_room + ' .fa');

			if ($room_li.length == 0) {
				return;
			}

			$room_fa[0].className = 'fa fa-check-circle';
			$room_li.addClass('selected');
		},

		room_click: function(e) {
			var room = $(e.target).data('room');
			smol.chat.join_room(room);
		}

	};
	return self;

})();
