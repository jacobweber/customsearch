const path = require('path');

module.exports = {
	'id': 'wikipedia',
	'label': 'Wikipedia',
	'icon': 'icon.png',
	'maskIcon': true,
	'css': `.result .searchmatch {
		font-weight: bold;
	}`,
	'version': 1.0,
	'customParams': [
		{
			id: 'url',
			label: 'URL',
			default: 'https://en.wikipedia.org'
		}
	],
	'search': async function(search, customParams, getPassword, modulesPath) {
		const fetch = require(path.join(modulesPath, 'node-fetch'));

		let instance = 'https://en.wikipedia.org';
		if (customParams.url) {
			instance = customParams.url;
		}

		if (search == '') {
			return [];
		}

		const response = await fetch(instance + '/w/api.php?action=query&list=search&srwhat=text&format=json&srsearch=' + encodeURIComponent(search));
		const result = await response.json();

		const output = [];
		if (result.query && result.query.search) {
			result.query.search.forEach(function(item) {
				output.push({
					'title': item.title,
					'subtitleHTML': item.snippet,
					'url': instance + '/wiki/' + encodeURIComponent(item.title.replace(/ /g, '_')),
					'icon': 'document.png'
				});
			});
		}
		return output;
	}
};
