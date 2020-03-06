const path = require('path');

module.exports = {
	'id': 'salesforce',
	'label': 'Salesforce',
	'icon': 'salesforce/icon.png',
	'customParams': [
		{
			name: 'username',
			label: 'Username'
		},
		{
			name: 'password',
			label: 'Password',
			password: true
		},
		{
			name: 'secToken',
			label: 'Security Token',
			password: true
		}
	],
	'search': async function(search, customParams, getPassword, modulesPath) {
		const jsforce = require(path.join(modulesPath, 'jsforce'));

		const instance = 'https://login.salesforce.com';
		if (!customParams.username) {
			throw new Error('Username required.');
		}
		const username = customParams.username;
		const password = await getPassword('password');
		const secToken = await getPassword('secToken');

		if (search == '') {
			return [];
		}

		if (!this.conn) {
			const conn = new jsforce.Connection({ loginUrl: instance });
			await conn.login(username, password + secToken);
			this.conn = conn;
		}

		const queryParts = [];
		const words = search.split(/ +/);
		queryParts.push('(' + words.map(function (word) {
			return '(Subject LIKE \'%' + word.replace(/'/g, '\\\'') + '%\')'
		}).join(' AND ') + ')');
		if (/^[0-9A-Za-z]{15}[0-9A-Za-z]{3}?$/i.test(search)) {
			queryParts.push('Id = \'' + search + '\'');
		}
		if (/^[0-9]+$/i.test(search)) {
			queryParts.push('CaseNumber = \'' + ('0000000' + search).substr(-8) + '\'');
		}
		const query = queryParts.join(' OR ');

		const result = await this.conn.sobject("Case")
			.select('Subject,Description,Id,CaseNumber')
			.limit(10)
			.where(query);
		const output = [];
		if (result) {
			result.forEach(function(issue) {
				output.push({
					'title': issue.Subject,
					'subtitle': issue.Description,
					'url': instance + '/' + issue.Id,
					'badge': issue.CaseNumber,
					'icon': 'salesforce/document.png'
				});
			});
		}
		return output;
	}
};
