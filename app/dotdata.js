var fs = require('fs');
var path = require('path');

var options = {
	data_dir: __dirname + '/.data'
};

var dotdata = {

	init: function(opt) {
		if (opt) {
			for (var key in opt) {
				options[key] = opt[key];
			}
		}
		dotdata.mkdir(options.data_dir);
	},

	get: function(name) {
		return new Promise(function(resolve, reject) {
			var filename = dotdata.filename(name);
			if (! filename) {
				return reject({
					error: 'Invalid name: ' + name
				});
			}
			fs.readFile(filename, 'utf8', function(err, json) {
				if (err) {
					return reject(err);
				}
				try {
					var data = JSON.parse(json);
				} catch (e) {

					// OK, so this is bad. We were not able to parse the JSON.
					// What happens next is up to whoever called .get(), but
					// we will leave a clue by setting e.code to EJSON. That
					// is a totally made up error code, but it doesn't seem
					// like the e object gets any code as-is.
					// (20180118/dphiffer)

					e.code = 'EJSON';
					reject(e);
					return;
				}
				resolve(data);
			});
		});
	},

	set: function(name, data) {

		return new Promise(function(resolve, reject) {

			var json = JSON.stringify(data, null, 4);
			var filename = dotdata.filename(name);
			if (! filename) {
				return reject({
					error: 'Invalid name: ' + name
				});
			}

			var write_to_disk = function() {
				var dir = path.dirname(filename);
				dotdata.mkdir(dir);
				fs.writeFile(filename, json, 'utf8', function(err) {
					if (err) {
						return reject(err);
					}
					dotdata.snapshot(name, json).then(function() {
						resolve(data);
					});
					if (! filename.match(/\.index\.json$/)) {
						dotdata.update_index(dir);
					}
				});
			}

			// This is a little weird: if a document exists already, and it has
			// the wrong 'id' property, then we treat that as an error. However,
			// not all documents have 'id' properties, so this won't catch all
			// cases of document clobbering. (20171129/dphiffer)

			var onsuccess = function(existing) {

				if (existing.id && data.id &&
				    existing.id != data.id) {
					return reject({
						error: name + ' exists with a different id number.'
					});
				}

				write_to_disk();
			};

			var onerror = function() {

				// We don't actually care that we hit an error here, it just
				// means the document doesn't exist yet. (20171129/dphiffer)

				write_to_disk();
			}

			dotdata.get(name).then(onsuccess, onerror);
		});
	},

	rename: function(from, to) {
		return new Promise(function(resolve, reject) {
			var from_filename = dotdata.filename(from);
			var to_filename = dotdata.filename(to);
			if (! from_filename) {
				return reject({
					error: 'Invalid name: ' + from
				});
			}
			if (! to_filename) {
				return reject({
					error: 'Invalid name: ' + to
				});
			}
			if (fs.existsSync(to_filename)) {
				return reject({
					error: "'" + to + "' already exists."
				});
			}
			fs.rename(from_filename, to_filename, function(err) {
				if (err) {
					return reject({
						error: 'Could not rename ' + from + '.',
						details: err
					});
				} else {
					dotdata.update_index(path.dirname(to_filename));
					return resolve();
				}
			});
		});
	},

	snapshot: function(name, json) {

		return new Promise(function(resolve, reject) {

			var filename = dotdata.snapshot_filename(name);
			if (! filename) {
				return resolve();
			}

			var dir = path.dirname(filename);
			dotdata.mkdir(dir);

			fs.writeFile(filename, json, 'utf8', function(err) {
				if (err) {
					reject(err);
					console.log('Error writing snapshot ' + filename + ': ' + err.message);
				} else {
					resolve();
					dotdata.update_index(dir, dotdata.summarize_snapshots);
				}
			});

		});
	},

	update_index: function(dir, index_filter) {

		return new Promise(function(resolve, reject) {

			fs.readdir(dir, function(err, files) {

				var root = path.dirname(__dirname);
				var name = dir.replace(options.data_dir, '')
				              .replace(/\//g, ':') + ':.index';

				if (name.substr(0, 1) == ':') {
					name = name.substr(1);
				}

				var index = {
					data: [],
					dirs: []
				};

				var write_to_disk = function() {
					dotdata.set(name, index)
						.then(function() {
							resolve(index);
						})
						.catch(function(err) {
							reject(err);
						});
				};

				for (var file, i = 0; i < files.length; i++) {
					file = files[i];
					if (file.substr(0, 1) == '.') {
						continue;
					} else if (file.substr(-5, 5) == '.json') {
						index.data.push(file.substr(0, file.length - 5));
					} else {
						index.dirs.push(file);
					}
				}

				if (typeof index_filter == 'function') {
					index_filter(dir, index)
						.then(function(index) {
							write_to_disk();
						})
						.catch(function(err) {
							reject(err);
						});
				} else {
					write_to_disk();
				}
			});
		});
	},

	index: function(name) {

		return new Promise(function(resolve, reject) {

			if (! name) {
				name = '';
			} else {
				name += ':';
			}
			name += '.index';

			var dir = path.dirname(dotdata.filename(name));

			var onsuccess = function(data) {
				resolve(data);
			};

			var onerror = function(err) {
				if (err.code == 'ENOENT') {
					resolve({
						data: [],
						dirs: []
					});
				} else if (err.code == 'EJSON') {
					var filename = dotdata.filename(name);
					console.log('Error parsing ' + filename + ': ' + err.message);
					console.log('Regenerating the index...');
					dotdata.update_index(dir).then(function(index) {
						if (typeof index == 'object' &&
						    typeof index.data == 'object') {
							console.log('Index regenerated.');
							resolve(index);
						} else {
							reject(err);
						}
					});
				} else {
					reject(err);
				}
			};
			dotdata.get(name).then(onsuccess, onerror);

		});
	},

	filename: function(name) {
		if (! name) {
			return null;
		}
		if (! name.match(/^[a-z0-9_:.-]+$/i)) {
			return null;
		}
		if (name.indexOf('..') != -1) {
			return null;
		}
		name = name.replace(/:/g, '/');
		var filename = options.data_dir + '/' + name + '.json';
		return filename;
	},

	snapshot_filename: function(name, rev) {

		var base_filename = dotdata.filename(name);
		var root = path.dirname(base_filename);

		// If any of these pre-conditions fail, return null, meaning "don't
		// snapshot this file." (20180118/dphiffer)

		if (! base_filename) {
			return null;
		}
		if (! name.match(/^[a-z0-9_:.-]+$/i)) {
			return null;
		}
		if (name.indexOf('..') != -1) {
			return null;
		}
		if (name.indexOf('.snapshots') != -1) {
			return null;
		}
		if (name.indexOf('.index') != -1) {
			return null;
		}
		if (name == 'sequence') {
			return null;
		}

		var base_name = name.match(/([^:]+)$/)[1];

		// If the user passed in a revision number, we're done!
		if (rev) {
			return root + '/.snapshots/' + base_name + '/' + rev + '.json';
		}

		// Check for the next available revision number.
		var rev = 1;
		var check = root + '/.snapshots/' + base_name + '/' + rev + '.json';
		while (fs.existsSync(check)) {
			rev++;
			check = root + '/.snapshots/' + base_name + '/' + rev + '.json';
		}
		return check;

	},

	summarize_snapshots: function(dir, index) {

		return new Promise(function(resolve, reject) {

			// First, let's turn all the .data entries into integers.
			for (var i = 0; i < index.data.length; i++) {
				index.data[i] = parseInt(index.data[i]);
			}

			// last will be used to compare one revision to another.
			var last = null;

			function summarize_diff(rev, a, b, stats) {

				var summary = {
					rev: rev,
					created: stats.ctime,
					description: 'First revision',
					total: 0,
					added: [],
					modified: [],
					removed: []
				};

				if (! a) {
					for (var key in b) {
						summary.added.push(key);
						summary.total++;
					}
					return summary;
				}

				for (var key in b) {
					if (! key in a) {
						summary.added.push(key);
						summary.total++;
					}
				}

				for (var key in a) {
					if (key in b) {
						if (JSON.stringify(a[key]) != JSON.stringify(b[key])) {
							summary.modified.push(key);
							summary.total++;
						}
					} else {
						summary.removed.push(key);
						summary.total++;
					}
				}

				if (summary.total == 0) {
					summary.description = 'No changes';
				} else if (summary.total > 3) {
					summary.description = summary.total + ' properties changed';
				} else {
					var descriptions = [];
					if (summary.added.length > 0) {
						descriptions.push('Added: ' + summary.added.join(', '));
					}
					if (summary.modified.length > 0) {
						descriptions.push('Modified: ' + summary.modified.join(', '));
					}
					if (summary.removed.length > 0) {
						descriptions.push('Removed: ' + summary.removed.join(', '));
					}
					if (descriptions.length == 0) {
						summary.description = 'No changes';
					} else {
						summary.description = descriptions.join(', ');
					}
				}

				return summary;
			}

			function summarize_revision(rev) {

				var path = dir + '/' + rev + '.json';
				fs.readFile(path, function(err, json) {

					if (err) {
						return reject(err);
					}

					try {
						var data = JSON.parse(json);
					} catch (err) {
						return reject(err);
					}

					var stats = fs.statSync(path);
					index.summary.push(summarize_diff(rev, last, data, stats));

					if (index.data.indexOf(rev + 1) == -1) {
						// We are done!
						resolve(index);
					} else {
						last = data;
						summarize_revision(rev + 1);
					}
				});
			}

			index.summary = [];
			summarize_revision(1);

		});
	},

	mkdir: function(dir) {

		// This behaves like `mkdir -p` where recursively calls mkdir on each
		// parent directory. It uses mkdirSync, so perhaps it should be improved
		// by making an async version. (20180123/dphiffer)

		if (fs.existsSync(dir)) {
			// It already exists!
			return true;
		}

		try {
			fs.mkdirSync(dir, 0o755);
		} catch(err) {
			if (err.code == 'ENOENT') {
				var parent_dir = path.dirname(dir);
				if (parent_dir == path.dirname(__dirname)) {
					console.log('Tried to mkdir on root: ' + dir);
					return false;
				}
				dotdata.mkdir(parent_dir);
				dotdata.mkdir(dir);
			} else {
				console.log('Could not mkdir: ' + dir);
				console.log(err);
				return false;
			}
		}
		return true;
	}
};

module.exports = dotdata;
