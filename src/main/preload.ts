import { ipcRenderer } from 'electron-better-ipc';

process.once('loaded', () => {
	var win = (<any>window);
	win.ipc = ipcRenderer;
});
