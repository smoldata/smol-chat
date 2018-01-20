var smol = smol || {};
smol.color = (function() {

	var self = {

		get_rgb(el) {
			var rgb = $(el).css('background-color');
			var rgb_list = rgb.match(/\d+/g);
			return {
				r: parseInt(rgb_list[0]),
				g: parseInt(rgb_list[1]),
				b: parseInt(rgb_list[2])
			};
		},

		// from https://stackoverflow.com/a/5624139/937170
		hex2rgb: function(hex) {
			// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
			var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
			hex = hex.replace(shorthandRegex, function(m, r, g, b) {
				return r + r + g + g + b + b;
			});

			var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
			return result ? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16)
			} : null;
		},

		// from https://gist.github.com/mjackson/5311256
		rgb2hsl: function(rgb) {
			var r = rgb.r / 255;
			var g = rgb.g / 255;
			var b = rgb.b / 255;
			var max = Math.max(r, g, b), min = Math.min(r, g, b);
			var h, s, l = (max + min) / 2;
			if (max == min) {
				h = s = 0; // achromatic
			} else {
				var d = max - min;
				s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

				switch (max) {
					case r: h = (g - b) / d + (g < b ? 6 : 0); break;
					case g: h = (b - r) / d + 2; break;
					case b: h = (r - g) / d + 4; break;
				}

				h /= 6;
			}
			return {
				h: Math.round(h * 360),
				s: Math.round(s * 255),
				l: Math.round(l * 255)
			};
		},

		// from https://stackoverflow.com/a/9493060
		hsl2rgb: function(hsl) {
			var h = hsl.h / 360;
			var s = hsl.s / 255;
			var l = hsl.l / 255;
			var r, g, b;

			if (hsl.s == 0) {
				r = g = b = l; // achromatic
			} else {
				var hue2rgb = function hue2rgb(p, q, t) {
					if (t < 0) t += 1;
					if (t > 1) t -= 1;
					if (t < 1/6) {
						return p + (q - p) * 6 * t;
					}
					if (t < 1/2) {
						return q;
					}
					if (t < 2/3) {
						return p + (q - p) * (2/3 - t) * 6;
					}
					return p;
				};

				var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
				var p = 2 * l - q;
				r = hue2rgb(p, q, h + 1/3);
				g = hue2rgb(p, q, h);
				b = hue2rgb(p, q, h - 1/3);
			}

			return {
				r: Math.round(r * 255),
				g: Math.round(g * 255),
				b: Math.round(b * 255)
			};
		},

		hex2hsl: function(hex) {
			var rgb = self.hex2rgb(hex);
			return self.rgb2hsl(rgb);
		}
	};

	return self;
})();
