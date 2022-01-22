const path = require('path');

module.exports = {
	'id': 'github',
	'label': 'Github',
	'icon': 'icon.png',
	'version': 1.0,
	'customParams': [
		{
			id: 'url',
			label: 'URL',
			default: 'https://api.github.com'
		},
		{
			id: 'username',
			label: 'Username'
		},
		{
			id: 'token',
			label: 'Token',
			password: true
		},
		{
			id: 'query',
			label: 'Query Defaults'
		}
	],
	'search': async function(search, customParams, getPassword, modulesPath) {
		const fetch = require(path.join(modulesPath, 'node-fetch'));

		if (!customParams.url) {
			throw new Error('URL required.');
		}
		if (!customParams.token) {
			throw new Error('Token required.');
		}
		const instance = customParams.url;
		const username = customParams.username;
		const token = await getPassword('token');

		if (search == '') {
			return [];
		}

		let query = search;
		if (customParams.query) {
			query += " " + customParams.query;
		}

		const options = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Basic ' + Buffer.from(username + ':' + token).toString('base64')
			}
		};
		const response = await fetch(instance + '/search/issues?per_page=20&q=' + encodeURIComponent(query), options);
		if (response.status === 401) {
			throw new Error('Authorization failed.');
		}
		const result = await response.json();

		const output = [];
		if (result.items) {
			result.items.forEach(function(item) {
				output.push({
					'title': item.title,
					'subtitle': item.body ? item.body.substring(0, 200) : '',
					'url': item.html_url,
					'badge': item.number
				});
			});
		}
		return output;
	}
};
