var dotdata = require('./dotdata');

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
		var next = sequence + 1;
		sequence++;
		dotdata.set('sequence', {
			sequence: next
		});
		return next;
	}

};
