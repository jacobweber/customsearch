import * as path from 'path';
import * as electron from 'electron';
import * as url from 'url';
const {
	app,
	BrowserWindow
} = electron;

let win: Electron.BrowserWindow | null = null;
export { win as preferencesWindow };

function createWindow () {
	win = new BrowserWindow({
		backgroundColor: '#fff',
		width: 600,
		height: 550,
		show: false,
		minimizable: false,
		maximizable: false,
		resizable: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			enableRemoteModule: false,
			contextIsolation: false,
			devTools: !app.isPackaged
		}
	});

	win.loadURL(url.format({
		pathname: 'preferences.html',
		protocol: "file:",
		slashes: true
	}));
	//win.loadFile(path.resolve(__dirname, 'preferences.html'));
	//win.webContents.openDevTools({ mode: 'detach' });

	win.on('ready-to-show', () => {
		if (!win) return;
		win.show();
	});

	win.on('closed', () => {
		win = null;
	});
}

export function showPreferencesWindow() {
	if (win === null) {
		createWindow();
	} else {
		win.show();
	}
}

export function hidePreferencesWindow() {
	if (!win) return;
	win.close();
	win = null;
}
