const path = require('path');
const SalesforceConnection = require('node-salesforce-connection');

module.exports = {
	'id': 'salesforce',
	'label': 'Salesforce',
	'icon': 'icon.png',
	'autoUpdate': true,
	'version': 1.0,
	'customParams': [
		{
			id: 'username',
			label: 'Username'
		},
		{
			id: 'password',
			label: 'Password',
			password: true
		},
		{
			id: 'secToken',
			label: 'Security Token',
			password: true
		}
	],
	'search': async function(search, customParams, getPassword, modulesPath) {
		const instance = 'login.salesforce.com';
		if (!customParams.username) {
			throw new Error('Username required.');
		}
		const username = customParams.username;
		const password = await getPassword('password');
		const secToken = await getPassword('secToken');

		if (search == '') {
			return [];
		}

		if (!this.sfConn) {
			const sfConn = new SalesforceConnection();
			await sfConn.soapLogin({
				hostname: instance,
				apiVersion: '39.0',
				username: username,
				password: password + secToken
			});
			this.sfConn = sfConn;
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
		const query = 'SELECT Subject,Description,Id,CaseNumber FROM Case'
			+ ' WHERE ' + queryParts.join(' OR ')
			+ ' LIMIT 10';

		const result = await this.sfConn.rest('/services/data/v39.0/query/?q='
			+ encodeURIComponent(query));
		const output = [];
		if (result) {
			result.records.forEach(function(record) {
				output.push({
					'title': record.Subject,
					'subtitle': record.Description,
					'url': 'https://' + instance + '/' + record.Id,
					'badge': record.CaseNumber,
					'icon': 'document.png'
				});
			});
		}
		return output;
	}
};
