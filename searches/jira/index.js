const path = require('path');

module.exports = {
	'id': 'jira',
	'label': 'JIRA',
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
		let jql;
		if (/^[A-Z]+-\d+$/i.test(search)) {
			jql = 'issuekey = "' + search + '"';
		} else {
			const words = search.split(/ +/);
			const text = [];
			let project = null;
			let recent = false;
			for (let i = 0; i < words.length; i++) {
				let word = words[i];
				if (/^[A-Z]+$/.test(word)) {
					project = word;
				} else if (word === '^') {
					recent = true;
				} else {
					text.push(word);
				}
			}
			if (text.length === 0) {
				return [];
			}
			jql = 'text ~ "' + text.join(' ').replace(/([\\"])/g, '\\$1') + '"';
			if (project !== null) {
				jql += ' AND project = "' + project + '"';
			}
			if (recent) {
				jql += ' ORDER BY updated DESC';
			}
		}

		const options = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
			}
		};
		const response = await fetch(instance + '/rest/api/latest/search?fields=key,summary,description&maxResults=20&jql=' + encodeURIComponent(jql), options);
		if (response.status === 401) {
			throw new Error('Authorization failed.');
		}
		const result = await response.json();

		const output = [];
		if (result.issues) {
			result.issues.forEach(function(item) {
				output.push({
					'title': item.fields.summary,
					'subtitle': item.fields.description ? item.fields.description.substring(0, 200) : '',
					'url': instance + '/browse/' + item.key,
					'badge': item.key,
					'icon': 'document.png'
				});
			});
		}
		return output;
	}
};
