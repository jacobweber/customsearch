This folder contains subfolders which each define a search type.
They must contain an index.js file, which defines a NodeJS module.
They may also contain images and node_modules.
The index.js file should look like this:

module.exports = {
	'id': string, required; unique identifier, same as folder name
	'label': string, required; text to display in search list
	'icon': string; name of 64x64px icon in same directory, to display in search list
	'maskIcon': boolean; true to make icon white when selected
	'css': string; CSS rules to add to search results
	'customParams': array of objects defining custom preferences settings:
		'id': string, required; unique identifier
		'label': string, required; label to display
		'default': string; default value
		'password': boolean; true to mask value and store securely 
	'search': async function to perform search
		will be called with parameters:
			search: string; text to search for
			customParams: object that maps custom param IDs to their values
			getPassword: async function to retrieve password
				can be called with the ID of a customParam with password: true,
				will return its value
			modulesPath: string; path to app's modules directory
				can include node-fetch or xml2js like this:
				const fetch = require(path.join(modulesPath, 'node-fetch'));
		should return array of objects defining search results:
			'title': string, required; text to display
			'subtitle': string; text to display below title
			'subtitleHTML': string; HTML to display below title; overrides subtitle
			'url': string; URL to open when selected
			'badge': string; text to display in badge on right
			'icon': string; name of 64x64px icon in same directory, to display on left
			'clipboard': string; text to copy when selected; defaults to url
		can also throw error with message to display
