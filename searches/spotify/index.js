const path = require('path');

module.exports = {
	'id': 'spotify',
	'label': 'Spotify',
	'icon': 'icon.svg',
	'version': 1.0,
	'customParams': [
		{
			id: 'clientId',
			label: 'Client ID'
		},
		{
			id: 'clientSecret',
			label: 'Client Secret',
			password: true
		}
	],
	'search': async function(search, customParams, getPassword, modulesPath) {
		const fetch = require(path.join(modulesPath, 'node-fetch'));
		if (!customParams.clientId) {
			throw new Error('Client ID required.');
		}
		const clientSecret = await getPassword('clientSecret');
		const auth = Buffer.from(customParams.clientId + ':' + clientSecret).toString('base64');

		if (search == '') {
			return [];
		}

		if (!this.connDate || (new Date()).getTime() - 1800000 > this.connDate) {
			const tokenParams = new URLSearchParams();
			tokenParams.append('grant_type', 'client_credentials');
			const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
				method: 'POST',
				headers: {
					'Authorization': 'Basic ' + auth
				},
				body: tokenParams
			});
			const tokenResult = await tokenResponse.json();
			this.accessToken = tokenResult.access_token;
			this.connDate = (new Date()).getTime();
		}

		const response = await fetch('https://api.spotify.com/v1/search?type=album,artist,track&limit=5&q=' + encodeURIComponent(search), {
			headers: {
				'Authorization': 'Bearer ' + this.accessToken
			}
		});;
		const result = await response.json();

		const output = [];
		
		if (result.tracks && result.tracks.items) {
			result.tracks.items.forEach(function(item) {
				output.push({
					'title': item.name,
					'subtitle': item.artists && item.artists.length > 0 ? item.artists[0].name : null,
					'url': item.uri,
					'icon': item.album && item.album.images && item.album.images.length > 0 ? item.album.images[0].url : null
				});
			});
		}
		if (result.albums && result.albums.items) {
			result.albums.items.forEach(function(item) {
				output.push({
					'title': item.name,
					'subtitle': item.artists && item.artists.length > 0 ? item.artists[0].name : null,
					'url': item.uri,
					'icon': item.images && item.images.length > 0 ? item.images[0].url : null
				});
			});
		}
		if (result.artists && result.artists.items) {
			result.artists.items.forEach(function(item) {
				output.push({
					'title': item.name,
					'url': item.uri,
					'icon': item.images && item.images.length > 0 ? item.images[0].url : null
				});
			});
		}
		return output;
	}
};
