import * as path from 'path';
import * as electron from 'electron';
import * as keytar from 'keytar';
const {
	app,
	BrowserWindow,
	Menu,
	Tray,
	globalShortcut,
	shell,
	dialog,
	protocol,
	ipcMain
} = electron;
import * as url from 'url';
import { preferencesWindow, showPreferencesWindow, hidePreferencesWindow } from './preferencesWindow';
import { exportPrefs, loadPreferences, savePreferences, Preferences, GetPasswordFunc, CustomParamsMap, loadSearchTypes, exportSearchTypes, SearchResult, searchTypesPath } from './preferences';

let win: Electron.BrowserWindow | null = null;
let tray: Electron.Tray | null = null;
let prefs: Preferences | null = null;
let quitting = false;
let quittingManually = false;

const setupMessages = () => {
	ipcMain.handle('get-prefs', () => {
		if (!prefs) return null;
		return exportPrefs(prefs);
	});
	ipcMain.handle('search-text', async (event, { id, text }: { id: string, text: string }): Promise<SearchResult[]> => {
		if (!prefs || !prefs.searchTypes) return [];
		// TODO: avoid creating every time
		const searchType = prefs.searchTypes.find(x => x.id === id);
		if (searchType === undefined) return [];
		const getPassword: GetPasswordFunc = (field: string) => {
			return keytar.getPassword('customSearch.' + id + '.' + field, 'password');
		};
		const customParams: CustomParamsMap = {};
		if (searchType.customParams) {
			for (const customParam of searchType.customParams) {
				const fullID = id + '.' + customParam.id;
				customParams[customParam.id] = prefs && prefs.customParams ? prefs.customParams[fullID] : undefined;
			}
		}
		const modulesPath = path.join(__dirname, '..', '..', 'node_modules');
		try {
			return await searchType.search(text, customParams, getPassword, modulesPath);
		} catch (err) {
			console.error(err);
			throw err;
		}
	});
	ipcMain.handle('get-screen-size', () => {
		const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
		return {
			width: width,
			height: height
		};
	});
	ipcMain.on('resize-window', (event, x: number, y: number, width: number, height: number) => {
		if (!win) return;
		const bounds = { x: x, y: y, width: width, height: height };
		win.setBounds(bounds);
	});
	ipcMain.on('log', (event, text: string) => {
		console.log(text);
	});
	ipcMain.on('show-window', () => {
		if (!win) return;
		win.show();
	});
	ipcMain.on('hide-window', () => {
		hideWindow();
	});
	ipcMain.on('open-url', (event, url: string) => {
		hideWindow();
		shell.openExternal(url);
	});

	ipcMain.handle('prefs.search-types-get', async () => {
		const searchTypes = await loadSearchTypes(searchTypesPath, true);
		return exportSearchTypes(searchTypes);
	});
	ipcMain.on('prefs.search-types-open', async () => {
		shell.showItemInFolder(searchTypesPath);
	});
	ipcMain.on('prefs.cancel', () => {
		if (!prefs) return;
		hidePreferencesWindow();
		if (prefs.accelerator) {
			globalShortcut.register(prefs.accelerator, toggleWindow);
		}
	});
	ipcMain.on('prefs.save', async (event, newPrefs: Preferences) => {
		if (!prefs || !win || !preferencesWindow) return;
		try {
			const oldPrefs = prefs;
			if (oldPrefs.accelerator) {
				globalShortcut.unregister(oldPrefs.accelerator);
			}

			if (newPrefs.accelerator) {
				globalShortcut.register(newPrefs.accelerator, toggleWindow);
			}

			newPrefs = await savePreferences(newPrefs, oldPrefs);

			hidePreferencesWindow();
			prefs = newPrefs;
			win.reload();
		} catch (err) {
			console.error(err);
			dialog.showMessageBox(preferencesWindow, {
				type: 'error',
				buttons: [ 'OK' ],
				message: 'The preferences could not be saved.'
			});
		}
	});
};

const appReady = async () => {
	if (app.dock) app.dock.hide();

	let justCreated;
	({ prefs, justCreated } = await loadPreferences());

	const icon = process.platform === 'darwin' ? 'trayTransparentTemplate.png' : 'trayOpaque.png';
	tray = new Tray(path.join(__dirname, icon));

	if (process.platform === 'win32') {
		tray.on('click', (event) => {
			if (tray) tray.popUpContextMenu();
		});
	}

	const menu = Menu.buildFromTemplate([
		{
			label: 'Preferences…',
			click() {
				if (!prefs) return;
				if (prefs.accelerator) {
					globalShortcut.unregister(prefs.accelerator);
				}
				showPreferencesWindow();
			}
		},
		{
			label: 'Toggle Dev Tools',
			role: 'toggleDevTools',
			visible: !app.isPackaged
		},
		{
			type: 'separator'
		},
		{
			label: 'Quit',
			click() {
				quittingManually = true;
				app.quit();
			}
		}
	]);

	tray.setToolTip('Custom Search');
	tray.setContextMenu(menu);

	setupMessages();

	protocol.interceptFileProtocol('file', (request, callback) => {
		const filePath = request.url.substr('file://'.length);
		if (filePath.startsWith('/searches/')) {
			const newPath = path.normalize(path.join(searchTypesPath, filePath.substr('/searches/'.length)));
			callback(newPath);
		} else {
			callback(path.normalize(path.join(__dirname, '..', 'renderer', filePath)));
		}
	});

	createWindow();

	if (justCreated) {
		showPreferencesWindow();
	} else if (prefs.accelerator) {
		globalShortcut.register(prefs.accelerator, toggleWindow);
	}
}

function createWindow () {
	win = new BrowserWindow({
		backgroundColor: '#fff',
		width: 600,
		height: 160,
		alwaysOnTop: true,
		show: false,
		frame: false,
		minimizable: false,
		maximizable: false,
		resizable: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: false,
			devTools: !app.isPackaged
		}
	});

	win.loadURL(url.format({
		pathname: 'search.html',
		protocol: "file:",
		slashes: true
	}));
	//win.loadFile(path.resolve(__dirname, 'main.html'));
	//win.webContents.openDevTools({ mode: 'detach' });

	win.on('close', (event) => {
		if (!quitting) {
			event.preventDefault();
			hideWindow();
		}
	});

	win.on('closed', () => {
		win = null;
	});
}

function hideWindow() {
	if (!win) return;
	if (Menu.sendActionToFirstResponder) {
		Menu.sendActionToFirstResponder('hide:');
	}
	win.hide();
}

function toggleWindow() {
	if (!win) return;
	if (!win.isVisible()) {
		win.webContents.send('ask-show-window');
	} else {
		hideWindow();
	}
}

if (!app.requestSingleInstanceLock()) {
	console.log('Already running.');
	quittingManually = true;
	app.quit();
}

app.on('ready', appReady);

app.on('before-quit', (e) => {
	if (!quittingManually) {
		// user hit command-Q
		e.preventDefault();
		return;
	}
	quitting = true;
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		quittingManually = true;
		app.quit()
	};
});

app.on('will-quit', () => {
	globalShortcut.unregisterAll()
});
