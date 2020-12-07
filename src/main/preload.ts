import { ipcRenderer } from 'electron';

process.once('loaded', () => {
	var win = (<any>window);
	win.ipc = ipcRenderer;
});
