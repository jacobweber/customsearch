const path = require('path');

module.exports = {
	'id': 'itunes',
	'label': 'iTunes',
	'icon': 'icon.png',
	'autoUpdate': true,
	'version': 1.0,
	'search': async function(search, customParams, getPassword, modulesPath) {
		const fetch = require(path.join(modulesPath, 'node-fetch'));

		if (search == '') {
			return [];
		}

		const response = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(search) + '&media=music&limit=10');
		const result = await response.json();

		const output = [];
		if (result.results) {
			result.results.forEach(function(item) {
				output.push({
					'title': item.trackName || item.collectionName,
					'subtitle': item.artistName,
					'url': item.trackViewUrl || item.collectionViewUrl,
					'badge': item.primaryGenreName,
					'icon': item.artworkUrl30 || item.artworkUrl60
				});
			});
		}
		return output;
	}
};
