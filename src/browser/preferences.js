(async function() {
	const isMac = navigator.platform.toUpperCase().indexOf('MAC') !== -1;

	function htmlEscape(str) {
		return str ? str
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;') : '';
	}

	function getDisplayKeyStr(key) {
		return key
			.replace('lock', 'Lock')
			.replace('numadd', 'Numpad+')
			.replace('numdec', 'Numpad.')
			.replace('numdiv', 'Numpad/')
			.replace('nummult', 'Numpad*')
			.replace('numsub', 'Numpad-')
			.replace('num', 'Numpad')
			.replace('Left', '\u2190')
			.replace('Right', '\u2192')
			.replace('Up', '\u2191')
			.replace('Down', '\u2193')
			.replace('Shift+', isMac ? '\u21E7' : 'Shift+')
			.replace('Control+', isMac ? '\u2303' : 'Ctrl+')
			.replace('Alt+', isMac ? '\u2325' : 'Alt+')
			.replace('Super+', isMac ? '\u2318' : '\u229E');
	
	}

	const codeToElectronKey = {
		'Backquote': '`',
		'Backslash': '\\',
		'Backspace': 'Backspace',
		'BracketLeft': '[',
		'BracketRight': ']',
		'Comma': ',',
		// Digit0-9: 0-9
		'Equal': '=',
		// KeyA-Z: A-Z
		'Minus': '-',
		'Period': '.',
		'Quote': '\'',
		'Semicolon': ';',
		'Slash': '/',
		'CapsLock': 'Capslock',
		'Enter': 'Enter',
		'Space': 'Space',
		'Tab': 'Tab',
		'Delete': 'Delete',
		'End': 'End',
		'Home': 'Home',
		'Insert': 'Insert',
		'PageDown': 'PageDown',
		'PageUp': 'PageUp',
		'ArrowDown': 'Down',
		'ArrowLeft': 'Left',
		'ArrowRight': 'Right',
		'ArrowUp': 'Up',
		'NumLock': 'Numlock',
		// Numpad0-9: num0-9
		'NumpadAdd': 'numadd',
		'NumpadDecimal': 'numdec',
		'NumpadDivide': 'numdiv',
		'NumpadMultiply': 'nummult',
		'NumpadSubtract': 'numsub',
		'Escape': 'Escape',
		// F1-24: F1-24
		'PrintScreen': 'numdec',
		'ScrollLock': 'Scrolllock',
		'MediaPlayPause': 'MediaPlayPause',
		'MediaStop': 'MediaStop',
		'MediaTrackNext': 'MediaNextTrack',
		'MediaTrackPrevious': 'MediaPreviousTrack',
		'AudioVolumeDown': 'VolumeDown',
		'AudioVolumeMute': 'VolumeMute',
		'AudioVolumeUp': 'VolumeUp'
	}

	function browserKeyCodeToElectronKeyCode(code) {
		const electronKey = codeToElectronKey[code];
		if (electronKey !== undefined) {
			return electronKey;
		} else if (code.match(/^Digit\d$/)) {
			return code.substr(5);
		} else if (code.match(/^Key[A-Z]$/)) {
			return code.substr(3);
		} else if (code.match(/^F\d{1,2}$/)) {
			return code;
		} else if (code.match(/^Numpad\d$/)) {
			return 'num' + code.substr(6);
		}
		return null;
	}

	function getKeyStr(e) {
		const keyCode = browserKeyCodeToElectronKeyCode(e.code);
		if (keyCode === null) return null;
		return (e.shiftKey ? 'Shift+' : '')
			+ (e.ctrlKey ? 'Control+' : '')
			+ (e.altKey ? 'Alt+' : '')
			+ (e.metaKey ? 'Super+' : '')
			+ keyCode;
	}

	function refreshCustomParamsFields(searchTypes, customParams) {
		const parent = document.getElementById('custom-params');
		while (parent.firstChild) {
			parent.removeChild(parent.firstChild);
		}
		let idx = 0;
		searchTypes.forEach(searchType => {
			if (!searchType.customParams) return;
			searchType.customParams.forEach(param => {
				let fullName = searchType.id + '.' + param.name;
				let value = '';
				if (customParams && customParams[fullName] !== undefined) value = customParams[fullName];
				else if (!param.password && param.default !== undefined) value = param.default;
				const html = `<div class="row custom-params-row">
					<input type="hidden" class="custom-params-name" value="${htmlEscape(fullName)}" />
					<label class="label" for="custom-params-value-${idx}">${htmlEscape(searchType.name + ' ' + param.label)}:</label>
					<input type="${param.password ? 'password' : 'text'}" class="text-field custom-params-value" id="custom-params-value-${idx}" value="${htmlEscape(value)}" />
				</div>`;
				parent.insertAdjacentHTML('beforeend', html);
				idx++;
			});
		});
		document.getElementById('custom-params').style.display = idx > 0 ? 'block' : 'none'; 
	};

	function getEnteredCustomParams() {
		const customParams = {};
		Array.from(document.getElementsByClassName('custom-params-row')).map(function(row) {
			const name = row.getElementsByClassName('custom-params-name')[0].value;
			const value = row.getElementsByClassName('custom-params-value')[0].value;
			customParams[name] = value;
		});
		return customParams;
	}

	async function reloadSearchTypes() {
		const searchTypesPath = document.getElementById('search-types-path').value;
		const searchTypes = await window.ipc.callMain('prefs.search-types-get', { path: searchTypesPath });
		prefs.searchTypes = searchTypes
		const customParams = getEnteredCustomParams();
		refreshCustomParamsFields(searchTypes, customParams);
	}

	let prefs = {};
	if (window.ipc) {
		prefs = await window.ipc.callMain('get-prefs');
		refreshCustomParamsFields(prefs.searchTypes, prefs.customParams);
	}

	document.getElementById('launch-startup-row').style.display = prefs.launchStartup === null ? 'none' : 'block';
	document.getElementById('launch-startup').checked = prefs.launchStartup;
	document.getElementById('search-types-path').value = prefs.searchTypesPath || '';
	document.getElementById('search-types-order').value = prefs.searchTypesOrder || '';
	if (prefs.accelerator) {
		document.getElementById('accelerator').value = prefs.accelerator;
		document.getElementById('accelerator-display').value = getDisplayKeyStr(prefs.accelerator);
	}

	document.getElementById('accelerator-display').addEventListener('keydown', function(e) {
		let keyStr = getKeyStr(e);
		if (keyStr !== null) {
			if (keyStr === 'Backspace' && document.getElementById('accelerator-display').value !== '') {
				keyStr = '';
			}
			document.getElementById('accelerator').value = keyStr;
			document.getElementById('accelerator-display').value = getDisplayKeyStr(keyStr);
		}
		e.preventDefault();
		e.stopPropagation();
	});

	document.getElementById('button-search-types-open').addEventListener('click', function() {
		if (!window.ipc) return;
		const path = document.getElementById('search-types-path').value;
		window.ipc.send('prefs.search-types-open', path);
	});

	document.getElementById('button-search-types-browse').addEventListener('click', async function() {
		if (!window.ipc) return;
		const oldPath = document.getElementById('search-types-path').value;
		const searchTypesPath = await window.ipc.callMain('prefs.search-types-browse', { path: oldPath });
		if (searchTypesPath && searchTypesPath !== oldPath) {
			document.getElementById('search-types-path').value = searchTypesPath;
			await reloadSearchTypes();
			const searchTypesOrder = searchTypes.map(type => type.id).join(',');
			document.getElementById('search-types-order').value = searchTypesOrder;
		}
	});

	document.getElementById('button-search-types-reload').addEventListener('click', async function() {
		if (!window.ipc) return;
		await reloadSearchTypes();
		const searchTypesOrder = document.getElementById('search-types-order').value;
		// remove elements from order that no longer exist
		const updatedOrder = searchTypesOrder.split(/\s*,\s*/).filter(orderID => {
			return prefs.searchTypes.find(type => type.id === orderID) !== undefined;
		}).join(',');
		document.getElementById('search-types-order').value = updatedOrder;
	});

	document.getElementById('button-search-types-order-reset').addEventListener('click', function() {
		document.getElementById('search-types-order').value = prefs.searchTypes.map(type => type.id).join(',');
	});

	document.getElementById('button-cancel').addEventListener('click', function() {
		if (!window.ipc) return;
		window.ipc.send('prefs.cancel');
	});

	function submitForm() {
		if (!window.ipc) return;
		const customParams = getEnteredCustomParams();
		const launchStartup = document.getElementById('launch-startup').checked;
		const searchTypesPath = document.getElementById('search-types-path').value;
		const searchTypesOrder = document.getElementById('search-types-order').value;
		const accelerator = document.getElementById('accelerator').value;

		window.ipc.send('prefs.save', {
			launchStartup,
			searchTypesPath,
			searchTypesOrder,
			accelerator,
			customParams
		});
	}

	document.getElementById('button-ok').addEventListener('click', submitForm);

	document.addEventListener('keydown', function(e) {
		if (!window.ipc) return;
		if (e.key === 'Escape') {
			window.ipc.send('prefs.cancel');
		} else if (e.key === 'Enter' || e.key === 'Return') {
			submitForm();
		}
	});
})();
