const path = require('path');

module.exports = {
	'id': 'threescale',
	'label': '3scale',
	'icon': 'icon.png',
	'customParams': [
		{
			id: 'url',
			label: 'URL'
		},
		{
			id: 'accessToken',
			label: 'Access Token',
			password: true
		}
	],
	'search': async function(search, customParams, getPassword, modulesPath) {
		const fetch = require(path.join(modulesPath, 'node-fetch'));
		const xml2js = require(path.join(modulesPath, 'xml2js'));

		if (!customParams.url) {
			throw new Error('URL required.');
		}
		const instance = customParams.url;
		const accessToken = await getPassword('accessToken');

		if (search == '') {
			return [];
		}

		if (!this.results) {
			const response = await fetch(instance + '/admin/api/applications.xml?access_token=' + encodeURIComponent(accessToken));
			const text = await response.text();
			const parser = new xml2js.Parser();
			const xml = await parser.parseStringPromise(text);
			this.results = xml.applications.application.map(application => ({
				id: application.id[0],
				name: application.name[0],
				description: application.description[0],
				serviceID: application.service_id[0],
				appID: application.application_id[0],
				appKey: application.keys[0].key[0],
				sviClientID: application.extra_fields[0].sviClientID[0]
			}));
		}

		const words = search.trim().toLowerCase().split(/ +/);
		const matched = this.results.filter(result => {
			for (let word of words) {
				if (result.name.toLowerCase().indexOf(word) === -1
					&& result.description.toLowerCase().indexOf(word) === -1) {
					return false;
				}
			}
			return true;
		});

		const output = [];
		if (matched.length) {
			matched.forEach(function(item) {
				output.push({
					'title': item.name,
					'subtitleHTML': item.description,
					'url': instance + '/apiconfig/services/' + encodeURIComponent(item.serviceID) + '/applications/' + encodeURIComponent(item.id),
					'clipboard': item.appID + '\n' + item.appKey,
					'badge': item.sviClientID
				});
			});
		}
		return output;
	}
};
