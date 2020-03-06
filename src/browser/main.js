(async function() {
	const isMac = navigator.platform.toUpperCase().indexOf('MAC') !== -1;
	const prefs = window.ipc ? await window.ipc.callMain('get-prefs') : {};
	const winWidth = 600;
	let winHeight = document.getElementById('content').offsetHeight;
	let winLeft = 0;
	let winTop = 0;
	if (window.ipc) {
		const size = await window.ipc.callMain('get-screen-size');
		winLeft = Math.floor(size.width / 2) - Math.floor(winWidth / 2);
		winTop = Math.floor(size.height * .2);
		maxHeight = size.height - winTop;
		document.getElementById('content').style.maxHeight = `${maxHeight}px`;
	}
	const searchDelay = 500;
	let lastUpdate = (new Date()).getTime();
	const saveDataMins = 10;
	let searchTypes = [];
	let searchText = [];
	let searchResults = [];
	let searchErrors = [];
	let currentType = 0;
	let currentResult = 0;
	let runningSearches = 0;

	const refreshWindowSize = function() {
		if (window.ipc) {
			window.ipc.send('resize-window', winLeft, winTop, winWidth, winHeight);
		}
	};

	const debounce = function(func, wait, immediate) {
		let timeout;
		return function() {
			const context = this;
			const args = arguments;
			const later = function() {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			const callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	};

	const htmlEscape = function(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	};

	const clearSearch = function() {
		searchText[currentType] = '';
		searchResults[currentType] = [];
		searchErrors[currentType] = null;
		currentResult = 0;
		saveData();
		refreshSearch();
		refreshResults();
	};

	const submitSearch = debounce(async function(type) {
		if (searchTypes.length === 0) return;
		const text = searchText[type];
		try {
			runningSearches++;
			document.getElementById('spinner').style.visibility = 'visible';
			const output = await window.ipc.callMain('search-text', { id: searchTypes[type].id, text: text });
			searchErrors[type] = null;
			searchResults[type] = output;
		} catch (err) {
			searchErrors[type] = err.message;
			searchResults[type] = [];
		}
		runningSearches--;
		if (runningSearches === 0) {
			document.getElementById('spinner').style.visibility = 'hidden';
		}
		currentResult = 0;
		saveData();
		refreshResults();
	}, searchDelay);

	const handleTab = function(e) {
		e.preventDefault();
		if (searchTypes.length === 0) return;
		if (e.shiftKey) {
			if (currentType === 0) {
				currentType = searchTypes.length - 1;
			} else {
				currentType--;
			}
		} else {
			if (currentType >= searchTypes.length - 1) {
				currentType = 0;
			} else {
				currentType++;
			}
		}
		currentResult = 0;
		saveData();
		refreshSelectedType();
	};

	const handleUp = function(e) {
		e.preventDefault();
		const results = searchResults[currentType];
		if (currentResult === 0) {
			currentResult = results.length - 1;
		} else {
			currentResult--;
		}
		refreshSelectedResult();
	};

	const handleDown = function(e) {
		e.preventDefault();
		const results = searchResults[currentType];
		if (currentResult >= results.length - 1) {
			currentResult = 0;
		} else {
			currentResult++;
		}
		refreshSelectedResult();
	};

	const handleStart = function(e) {
		e.preventDefault();
		currentResult = 0;
		refreshSelectedResult();
	};

	const handleEnd = function(e) {
		e.preventDefault();
		const results = searchResults[currentType];
		currentResult = results.length - 1;
		refreshSelectedResult();
	};

	const handleCopy = function(e) {
		e.preventDefault();
		const results = searchResults[currentType];
		if (results.length <= currentResult) return;
		const result = results[currentResult];
		const el = document.createElement('textarea');
		el.value = result.clipboard || result.url;
		document.body.appendChild(el);
		el.select();
		document.execCommand('copy');
		document.body.removeChild(el);
		document.getElementById('search').focus();
		document.getElementById('search').select();
	};

	const refreshSelectedType = function() {
		const types = document.querySelectorAll('#types .type');
		for (let i = 0; i < types.length; i++) {
			if (i === currentType) {
				types[i].classList.add('selected');
			} else {
				types[i].classList.remove('selected');
			}
		}
		const selected = document.querySelector('#types .type.selected');
		if (selected) {
			selected.scrollIntoView({ block: 'nearest' });
		}

		refreshSearch();
		document.getElementById('search').focus();
		document.getElementById('search').select();
		refreshResults();
	};

	const refreshTypes = function() {
		const types = document.getElementById('types');
		while (types.firstChild) {
			types.removeChild(types.firstChild);
		}
		const order = prefs.searchTypesOrder.split(/\s*,\s*/);
		searchTypes = [];
		order.forEach(orderID => {
			const searchType = prefs.searchTypes.find(type => type.id === orderID);
			if (searchType) {
				searchTypes.push(searchType);
			}
		});
		searchTypes.forEach(function(search, idx) {
			const html = `<button class="type" id="type_${idx}" tabindex="-1">
				${search.icon ? `<img class="icon${search.maskIcon ? ' masked' : ''}" src="/searches/${htmlEscape(search.icon)}" />` : ''}
				${htmlEscape(search.name)}
			</button>`;
			types.insertAdjacentHTML('beforeend', html);
			types.lastChild.addEventListener('click', function() {
				if (currentType === idx) return;
				currentType = idx;
				currentResult = 0;
				refreshSelectedType();
			});
		});
		refreshSelectedType();
	};

	const refreshSearch = function() {
		if (searchText[currentType] === undefined) searchText[currentType] = '';
		document.getElementById('search').value = searchText[currentType];
	};

	const refreshResults = function() {
		const error = searchErrors[currentType] || '';
		document.getElementById('error').innerText = error;
		document.getElementById('error').style.display = error ? '' : 'none';

		if (searchResults[currentType] === undefined) searchResults[currentType] = [];
		const results = searchResults[currentType];
		const parent = document.getElementById('results');
		parent.style.display = results.length > 0 ? '' : 'none';
		parent.scrollTop = 0;
		while (parent.firstChild) {
			parent.removeChild(parent.firstChild);
		}
		results.forEach(function(result, idx) {
			const html = `<div class="result" id="result_${idx}">
				${result.icon ? `<div class="icon"><img src="${htmlEscape(result.icon.startsWith('http') ? result.icon : '/searches/' + result.icon)}" /></div>` : ''}
				<div class="main">
					<div class="title">${htmlEscape(result.title)}</div>
					${result.subtitle ? `<div class="subtitle">${htmlEscape(result.subtitle)}</div>` : ''}
					${result.subtitleHTML ? `<div class="subtitle">${result.subtitleHTML}</div>` : ''}
				</div>
				${result.badge ? `<div class="badge">${htmlEscape(result.badge)}</div>` : ''}
			</div>`;
			parent.insertAdjacentHTML('beforeend', html);
			parent.lastChild.addEventListener('click', function() {
				currentResult = idx;
				openSelectedItem();
			});
		});

		winHeight = document.getElementById('content').offsetHeight;
		refreshWindowSize();
		refreshSelectedResult(false); // don't scroll when we need to resize window, or entire window will scroll
	};

	const refreshSelectedResult = function(scroll) {
		const results = document.querySelectorAll('#results .result');
		for (let i = 0; i < results.length; i++) {
			if (i === currentResult) {
				results[i].classList.add('selected');
			} else {
				results[i].classList.remove('selected');
			}
		}
		if (scroll !== false) {
			const selected = document.querySelector('#results .result.selected');
			if (selected) {
				selected.scrollIntoView({ block: 'nearest' });
			}
		}
	};

	const openSelectedItem = function() {
		if (searchResults[currentType].length <= currentResult) return;
		const url = searchResults[currentType][currentResult].url;
		if (window.ipc) {
			window.ipc.send('open-url', url);
		} else {
			window.open(url);
		}
	};

	const clearDataIfExpired = function() {
		if (lastUpdate + (1000 * 60 * saveDataMins) < (new Date()).getTime()) {
			searchText = [];
			searchResults = [];
			searchErrors = [];
			currentType = 0;
		}
	};

	const saveData = function() {
		lastUpdate = (new Date()).getTime();
	}

	const initSearchTypes = function() {
		prefs.searchTypes.forEach(function(type) {
			if (type.css) {
				const el = document.createElement('style');
				el.type = 'text/css';
				el.appendChild(document.createTextNode(type.css));
				document.head.appendChild(el);
			}
		});
	};

	window.addEventListener('click', function(e) {
		document.getElementById('search').focus();
	});

	document.getElementById('search').addEventListener('keydown', function(e) {
		if (e.key === 'Escape') {
			window.ipc.send('hide-window');
		} else if (e.key === 'Enter') {
			openSelectedItem();
		} else if (e.key === 'Tab') {
			handleTab(e);
		} else if (e.key === 'ArrowUp') {
			handleUp(e);
		} else if (e.key === 'ArrowDown') {
			handleDown(e);
		} else if (e.key === 'Home' || e.key === 'PageUp') {
			handleStart(e);
		} else if (e.key === 'End' || e.key === 'PageDown') {
			handleEnd(e);
		} else if (e.key === 'c' && (isMac ? e.metaKey : e.ctrlKey)) {
			handleCopy(e);
		}
	});

	document.getElementById('search').addEventListener('keyup', function(e) {
		const val = document.getElementById('search').value.trim();
		if (searchText[currentType] !== val) {
			searchText[currentType] = val;
			saveData();
			if (val.length === 0) {
				clearSearch();
			} else if (val.length > 2) {
				submitSearch(currentType);
			}
		}
	});

	window.addEventListener('focus', function() {
		window.setTimeout(function() {
			document.getElementById('search').focus();
			document.getElementById('search').select();
		}, 1);
	});

	initSearchTypes();
	clearDataIfExpired();
	refreshTypes();

	if (window.ipc) {
		window.ipc.on('ask-show-window', function(e) {
			clearDataIfExpired();
			refreshTypes();
			if (searchTypes.length > 0) {
				window.ipc.send('show-window');
			}
		});
	}
})();