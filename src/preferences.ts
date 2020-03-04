import * as fs from 'fs-extra';
const fsPromises = fs.promises;
import * as keytar from 'keytar';
import * as path from 'path';
import * as electron from 'electron';
const {
	app,
} = electron;

const userData = app.getPath('userData');
const dummyPasswordValue = 'password';
 
export interface SearchResult {
	title?: string;
	subtitle?: string;
	subtitleHTML?: string;
	alwaysShowsSubtitle?: boolean;
	url?: string;
	badge?: string;
	icon?: string;
	clipboard?: string;
}

interface CustomParamDef {
	name: string;
	label: string;
	default?: string;
	password?: boolean;
}

export interface CustomParamsMap {
	[key: string]: string;
}

export interface SearchType {
	id: string;
	name: string;
	icon: string;
	search: (search: string, customParams: CustomParamsMap, getPassword: GetPasswordFunc, modulesPath: string) => Promise<SearchResult[]>;
	maskIcon?: boolean;
	customParams?: CustomParamDef[];
	css?: string;
}

export interface Preferences {
	launchStartup?: boolean;
	searchTypesPath?: string;
	searchTypesOrder?: string;
	searchTypes?: SearchType[];
	customParams?: CustomParamsMap;
	accelerator?: string;
};

const defaultPrefs = {
	accelerator: 'Alt+Space'
};

export type GetPasswordFunc = (service: string, account: string) => Promise<string>;

export interface ExportedSearchType {
	id: string;
	name: string;
	icon: string;
	maskIcon?: boolean;
	customParams?: CustomParamDef[];
	css?: string;
}

export interface ExportedPreferences {
	launchStartup?: boolean;
	searchTypes?: ExportedSearchType[];
	searchTypesOrder?: string;
	customParams?: CustomParamsMap;
};

export const exportPrefs = async function(prefs: Preferences): Promise<ExportedPreferences> {
	const exported: ExportedPreferences = {};
	if (!app.getLoginItemSettings) {
		exported.launchStartup = null;
	} else {
		exported.launchStartup = prefs.launchStartup;
	}
	exported.searchTypes = await exportSearchTypes(prefs.searchTypesPath);
	exported.searchTypesOrder = prefs.searchTypesOrder;
	exported.customParams = prefs.customParams;
	return exported;
};

export const exportSearchTypes = async function(searchTypesPath: string): Promise<ExportedSearchType[]> {
	return (await getSearchTypes(searchTypesPath)).map(searchType => ({
		id: searchType.id,
		name: searchType.name,
		icon: searchType.icon,
		maskIcon: searchType.maskIcon,
		customParams: searchType.customParams,
		css: searchType.css
	}));
};

export const getSearchTypes = async function(searchTypesPath: string): Promise<SearchType[]> {
	if (!searchTypesPath) return [];
	try {
		const files = await fsPromises.readdir(searchTypesPath);
		return (await Promise.all(files.map(async file => {
			const filePath = path.join(searchTypesPath, file);
			if ((await fsPromises.stat(filePath)).isDirectory()) {
				try {
					const indexPath = path.join(filePath, 'index.js');
					await fsPromises.access(indexPath);
					return await import(indexPath);
				} catch (err) {
					console.error(err);
					return null;
				}
			} else {
				return null;
			}
		}))).filter(data => data !== null);
	} catch (e) {
		return [];
	}
};

export const savePreferences = async function(data: Preferences = {}, oldData: Preferences = null): Promise<void> {
	const customParamsToSave: CustomParamsMap = {};
	if (!data.customParams) data.customParams = {};
	for (const searchType of data.searchTypes) {
		if (searchType.customParams) {
			for (const param of searchType.customParams) {
				const fullName = searchType.id + '.' + param.name;
				const newValue = data.customParams[fullName] !== undefined ? data.customParams[fullName] : '';
				if (param.password) {
					const oldValue = oldData && oldData.customParams && oldData.customParams[fullName] !== undefined ? oldData.customParams[fullName] : '';
					const changed = (newValue.length > 0 && newValue !== dummyPasswordValue)
						|| (newValue.length === 0 && oldValue.length > 0);
					if (changed) {
						if (newValue.length > 0) {
							await keytar.setPassword('customSearch.' + fullName, 'password', newValue);
						} else {
							await keytar.deletePassword('customSearch.' + fullName, 'password');
						}
					}
					data.customParams[fullName] = newValue.length > 0 ? dummyPasswordValue : '';
					customParamsToSave[fullName] = data.customParams[fullName];
				} else {
					customParamsToSave[fullName] = newValue;
				}
			}
		}
	}

	if (app.getLoginItemSettings) {
		const settings = app.getLoginItemSettings({});
		if (settings.openAtLogin !== data.launchStartup) {
			app.setLoginItemSettings({
				openAtLogin: data.launchStartup
			});
		}
	}

	const dataToSave = {
		launchStartup: data.launchStartup,
		accelerator: data.accelerator,
		searchTypesPath: data.searchTypesPath,
		searchTypesOrder: data.searchTypesOrder,
		customParams: customParamsToSave
	};

	const dataJSON = JSON.stringify(dataToSave);
	return await fsPromises.writeFile(path.join(userData, 'settings.json'), dataJSON, { encoding: 'utf8' });
};

export const loadPreferences = async function(): Promise<Preferences> {
	let data: Preferences = null;
	try {
		const dataJSON = await fsPromises.readFile(path.join(userData, 'settings.json'), { encoding: 'utf8' });
		data = JSON.parse(dataJSON);
		if (!data) data = null;
	} catch (e) {
	}
	if (data === null) {
		return null;
	}
	return completePreferences(data);
};

export const createPreferences = async function(): Promise<Preferences> {
	const searchTypesPath = path.join(app.getPath('userData'), 'searches');
	let searchTypesExists = true;
	try {
		await fsPromises.stat(searchTypesPath);
	} catch (err) {
		searchTypesExists = false;
	}
	if (!searchTypesExists) {
		const sourcePath = app.isPackaged
			? path.join(process.resourcesPath, 'searches')
			: path.join(__dirname, '..', 'searches');
		try {
			await fsPromises.stat(sourcePath);
			await fs.copy(sourcePath, searchTypesPath);
		} catch (err) {
			await fs.ensureDir(searchTypesPath);
		}
	}
	const prefs = await completePreferences({
		...defaultPrefs,
		searchTypesPath
	});
	prefs.searchTypesOrder = prefs.searchTypes.map(type => type.id).join(',');
	return prefs;
};

export const completePreferences = async function(data: Preferences = {}): Promise<Preferences>  {
	const searchTypes = await getSearchTypes(data.searchTypesPath);
	const completed: Preferences = {
		...data,
		searchTypes
	};
	return completed;
}
