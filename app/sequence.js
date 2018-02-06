var path = require('path');
var dotdata = require('./dotdata');

dotdata.init({
	data_dir: path.dirname(__dirname) + '/.data'
});
var sequence = 0;

dotdata.get('sequence').then(function(data) {
	sequence = data.sequence;
}, function() {
	dotdata.set('sequence', {
		sequence: 0
	});
});

module.exports = {

	next: function() {
		var next = ++sequence;
		dotdata.set('sequence', {
			sequence: next
		});
		return next;
	}

};
