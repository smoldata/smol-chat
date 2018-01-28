var smol = smol || {};
smol.menu = (function() {

	var self = {

		init: function() {

			$('#menu-close').click(self.hide);
			$('.btn-cancel').click(function(e) {
				e.preventDefault();
				self.hide();
			});

			// Cancel button
			$(window).keypress(function(e) {
				if (e.keyCode == 27 &&
				    $('#menu').hasClass('active') &&
				    ! $('#menu-close').hasClass('hidden')) {
					e.preventDefault();
					self.hide();
				}
			});

			$('#menu .menu-page').each(function(index, form) {
				var page = $(form).attr('id');
				if (smol.menu[page] &&
				    typeof smol.menu[page].init == 'function') {
					smol.menu[page].init();
				}
			});

			$('#menu form').submit(self.submit);
		},

		show: function(page) {
			$('#menu .visible').removeClass('visible');
			$('#' + page).addClass('visible');
			$('#menu').addClass('active');
			$('#menu').scrollTop(0);

			if (smol.menu[page] &&
			    typeof smol.menu[page].show == 'function') {
				smol.menu[page].show();
			}
		},

		hide: function() {
			var $visible = $('.menu-page.visible');
			var page = $visible.attr('id');
			$('#menu').removeClass('active');

			if (smol.menu[page] &&
			    typeof smol.menu[page].hide == 'function') {
				smol.menu[page].hide();
			}
		},

		submit: function(e) {
			e.preventDefault();

			var $form = $(e.target);
			var page = $form.attr('id');
			var url = $form.attr('action');
			if ($form.attr('enctype') == 'multipart/form-data') {
				var data = new FormData($form[0]);
			} else {
				var data = $form.serialize();
			}

			if (smol.menu[page] &&
				typeof smol.menu[page].validate == 'function') {
				var rsp = smol.menu[page].validate(data);
				if (rsp.ok == -1) {
					// -1 means "mayyyybe?"
					// Wait a moment and then try again
					setTimeout(function() {
						self.submit(e)
					}, 250);
					return;
				} else if (! rsp.ok) {
					var esc_error = smol.esc_html(rsp.error);
					$form.find('.response').html(esc_error);
					return;
				}
			}

			var onerror = function(rsp) {
				var error = rsp.error || 'Error submitting data.';
				var esc_error = smol.esc_html(error);
				$form.find('.response').html(esc_error);
			};

			var onsuccess = function(rsp) {

				if (! rsp.ok) {
					return onerror(rsp);
				}

				var data = rsp.data;

				if (smol.menu[page] &&
				    typeof smol.menu[page].submit == 'function') {
					smol.menu[page].submit(data);
				}
			};

			$form.find('.response').html('Saving...');

			if ($form.attr('enctype') == 'multipart/form-data') {
				$.ajax({
					url: url,
					data: data,
					type: 'POST',
					contentType: false,
					processData: false
				}).then(onsuccess, onerror);
			} else {
				$.post(url, data).then(onsuccess, onerror);
			}
		}

	};

	$(document).ready(function() {
		self.init();
	});

	return self;
})();
