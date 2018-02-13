var path = require('path');

var dotdata = null;
var sequence = 0;

module.exports = {

	init: function(_dotdata) {
		dotdata = _dotdata;
		dotdata.get('sequence').then(function(data) {
			sequence = data.sequence;
		}, function() {
			dotdata.set('sequence', {
				sequence: 0
			});
		});
	},

	next: function() {
		var next = ++sequence;
		dotdata.set('sequence', {
			sequence: next
		});
		return next;
	}

};
