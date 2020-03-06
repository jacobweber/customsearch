const path = require('path');

module.exports = {
	'id': 'confluence',
	'label': 'Confluence',
	'icon': 'icon.png',
	'maskIcon': true,
	'autoUpdate': true,
	'customParams': [
		{
			id: 'url',
			label: 'URL'
		},
		{
			id: 'username',
			label: 'Username'
		},
		{
			id: 'password',
			label: 'Password',
			password: true
		}
	],
	'search': async function(search, customParams, getPassword, modulesPath) {
		const fetch = require(path.join(modulesPath, 'node-fetch'));

		if (!customParams.url) {
			throw new Error('URL required.');
		}
		if (!customParams.username) {
			throw new Error('Username required.');
		}
		const instance = customParams.url;
		const username = customParams.username;
		const password = await getPassword('password');

		if (search == '') {
			return [];
		}

		// TODO: improve escaping
		let cql;
		let words = search.split(/ +/);
		const text = [];
		let space = null;
		let recent = false;
		for (let i = 0; i < words.length; i++) {
			let word = words[i];
			if (/^[A-Z]+$/.test(word)) {
				space = word;
			} else if (word === '^') {
				recent = true;
			} else {
				text.push(word);
			}
		}
		if (text.length === 0) {
			return [];
		}
		cql = 'siteSearch ~ "' + text.join(' ').replace(/([\\"])/g, '\\$1') + '"';
		if (space !== null) {
			cql += ' AND space = "' + space + '"'
		}
		if (recent) {
			cql += ' ORDER BY lastmodified DESC';
		}

		const options = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
			}
		};
		const response = await fetch(instance + '/rest/api/content/search?limit=20&cql=' + encodeURIComponent(cql), options);
		if (response.status === 401) {
			throw new Error('Authorization failed.');
		}
		const result = await response.json();

		const output = [];
		let confSplace;
		if (result.results) {
			result.results.forEach(function(item) {
				confSplace = item._expandable.space;
				output.push({
					'title': item.title,
					'url': instance + item._links.webui,
					'badge': confSplace.substring(confSplace.lastIndexOf('/') + 1),
					'icon': item.type + '.png'
				});
			});
		}
		return output;
	}
};
