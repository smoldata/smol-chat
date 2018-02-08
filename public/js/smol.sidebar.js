var smol = smol || {};
smol.sidebar = (function() {

	var self = {

		init: function() {
			$('#sidebar-new-room').click(function(e) {
				var room = prompt('Please choose a room name. (Use letters, numbers, hyphens, and underscores.)');
				if (room && room.match(/^[a-z0-9_]+$/i)) {
					smol.chat.join_room(room);
				}
			});
		},

		update_rooms: function(rooms) {
			rooms.sort(function(a, b) {
				if (a == 'commons') {
					return -1;
				} else if (b == 'commons') {
					return 1;
				} else if (a.toLowerCase() < b.toLowerCase()) {
					return -1;
				} else {
					return 1;
				}
			});
			var room, room_html;
			for (var i = rooms.length - 1; i >= 0; i--) {
				room = rooms[i];
				if ($('#sidebar-room-' + room).length == 0) {
					room_html = self.get_room_html(room);
					$('#sidebar-room-list').prepend(room_html);
					self.set_room_events(room);
				}
			}
		},

		set_room: function(room) {

			if ($('#sidebar-room-' + room).length == 0) {
				var room_html = self.get_room_html(room);
				$('#sidebar-room-list li').each(function(i, li) {
					if ($('#sidebar-room-' + room).length == 0 && (
					    $(li).attr('id') == 'sidebar-new-room' ||
					    ($(li).data('room').toLowerCase() > room.toLowerCase() &&
					     $(li).data('room') != 'commons'))) {
						$(li).before(room_html);
					}
				});
				self.set_room_events(room);
			}
			$('#sidebar-room-list .fa-check-circle').addClass('fa-circle-o');
			$('#sidebar-room-list .fa-check-circle').removeClass('fa-check-circle');
			$('#sidebar-room-list .selected').removeClass('selected');

			var $room_li = $('#sidebar-room-' + room);
			var $room_fa = $('#sidebar-room-' + room + ' .fa');

			if ($room_li.length == 0) {
				return;
			}

			$room_fa[0].className = 'fa fa-check-circle';
			$room_li.addClass('selected');
		},

		get_room_html: function(room) {
			var esc_room = smol.esc_html(room);
			var icon = '<span class="fa fa-circle-o"></span>';
			var html = '<li id="sidebar-room-' + esc_room +
			             '" data-room="' + esc_room + '"> ' +
			             icon + esc_room + '</li>';
			return html;
		},

		set_room_events: function(room) {
			$('#sidebar-room-' + room).click(self.room_click);
			$('#sidebar-room-' + room).mouseenter(function() {
				$('#sidebar-room-' + room).append('<span class="leave fa fa-close" title="Leave room"></span>');
			});
			$('#sidebar-room-' + room).mouseleave(function() {
				$('#sidebar-room-' + room + ' .leave').remove();
			});
		},

		room_click: function(e) {
			var room = $(e.target).data('room');
			if (room) {
				smol.chat.join_room(room);
				return;
			}
			if ($(e.target).hasClass('leave')) {
				var room = $(e.target).closest('li').data('room');
				smol.chat.leave_room(room);
				return;
			}
		},

		remove_room: function(room) {
			$('#sidebar-room-' + room).remove();
		}

	};

	$(document).ready(self.init);

	return self;

})();
