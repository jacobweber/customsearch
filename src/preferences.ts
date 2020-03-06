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
const readme = 'README.txt';
export const searchTypesPath = path.join(userData, 'searches');

interface Defaults {
	searchTypes?: Array<string>;
	customParams?: { [key: string]: string; };
};

export interface SearchResult {
	title?: string;
	subtitle?: string;
	subtitleHTML?: string;
	url?: string;
	badge?: string;
	icon?: string;
	clipboard?: string;
}

interface CustomParamDef {
	id: string;
	label: string;
	default?: string;
	password?: boolean;
}

export interface CustomParamsMap {
	[key: string]: string;
}

export interface SearchType {
	id: string;
	label: string;
	icon: string;
	search: (search: string, customParams: CustomParamsMap, getPassword: GetPasswordFunc, modulesPath: string) => Promise<SearchResult[]>;
	maskIcon?: boolean;
	customParams?: CustomParamDef[];
	css?: string;
}

export interface Preferences {
	launchStartup?: boolean;
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
	label: string;
	icon: string;
	maskIcon?: boolean;
	customParams?: CustomParamDef[];
	css?: string;
}

export interface ExportedPreferences {
	launchStartup?: boolean;
	searchTypesOrder?: string;
	searchTypes?: ExportedSearchType[];
	customParams?: CustomParamsMap;
	accelerator?: string;
};

export const exportPrefs = function(prefs: Preferences): ExportedPreferences {
	const exported: ExportedPreferences = {};
	if (!app.getLoginItemSettings) {
		exported.launchStartup = null;
	} else {
		exported.launchStartup = prefs.launchStartup;
	}
	exported.searchTypes = exportSearchTypes(prefs.searchTypes);
	exported.searchTypesOrder = prefs.searchTypesOrder;
	exported.customParams = prefs.customParams;
	exported.accelerator = prefs.accelerator;
	return exported;
};

export const exportSearchTypes = function(searchTypes: Array<SearchType>): ExportedSearchType[] {
	return searchTypes.map(searchType => ({
		id: searchType.id,
		label: searchType.label,
		icon: searchType.icon,
		maskIcon: searchType.maskIcon,
		customParams: searchType.customParams,
		css: searchType.css
	}));
};

export const loadSearchTypes = async function(): Promise<SearchType[]> {
	try {
		const files = await fsPromises.readdir(searchTypesPath);
		return (await Promise.all(files.map(async file => {
			const filePath = path.join(searchTypesPath, file);
			if ((await fsPromises.stat(filePath)).isDirectory()) {
				try {
					const indexPath = path.join(filePath, 'index.js');
					await fsPromises.access(indexPath);
					delete require.cache[require.resolve(indexPath)];
					return require(indexPath);
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

export const savePreferences = async function(data: Preferences = {}, oldData: Preferences = null): Promise<Preferences> {
	const searchTypes = await loadSearchTypes();
	const customParams: CustomParamsMap = {};
	for (const searchType of searchTypes) {
		if (searchType.customParams) {
			for (const param of searchType.customParams) {
				const fullID = searchType.id + '.' + param.id;
				const newValue = data.customParams && data.customParams[fullID] !== undefined ? data.customParams[fullID] : '';
				if (param.password) {
					const oldValue = oldData && oldData.customParams && oldData.customParams[fullID] !== undefined ? oldData.customParams[fullID] : '';
					const changed = (newValue.length > 0 && newValue !== dummyPasswordValue)
						|| (newValue.length === 0 && oldValue.length > 0);
					if (changed) {
						if (newValue.length > 0) {
							await keytar.setPassword('customSearch.' + fullID, 'password', newValue);
						} else {
							await keytar.deletePassword('customSearch.' + fullID, 'password');
						}
					}
					customParams[fullID] = newValue.length > 0 ? dummyPasswordValue : '';
				} else {
					customParams[fullID] = newValue;
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

	data = {
		...data,
		searchTypes,
		customParams
	};
	await writePreferences(data);
	return data;
};

const writePreferences = async function(data: Preferences): Promise<void> {
	const dataToSave = {
		launchStartup: data.launchStartup,
		accelerator: data.accelerator,
		searchTypesOrder: data.searchTypesOrder,
		customParams: data.customParams
	};

	const dataJSON = JSON.stringify(dataToSave, null, '\t');
	await fsPromises.writeFile(path.join(userData, 'preferences.json'), dataJSON, { encoding: 'utf8' });
	return;
};

export const loadPreferences = async function(): Promise<{
	prefs: Preferences,
	justCreated: boolean
}> {
	let justCreated = false;
	let prefs: Preferences = null;
	try {
		const dataJSON = await fsPromises.readFile(path.join(userData, 'preferences.json'), { encoding: 'utf8' });
		prefs = JSON.parse(dataJSON);
		if (!prefs) prefs = null;
	} catch (e) {
	}

	if (prefs === null) {
		prefs = await createPreferences();
		justCreated = true;
	} else {
		const searchTypes = await loadSearchTypes();
		prefs = {
			...prefs,
			searchTypes
		};
	}
	return { prefs, justCreated };
};

const loadDefaults = async function(): Promise<Defaults> {
	try {
		const defaultsJSON = await fsPromises.readFile(path.join(__dirname, 'defaults.json'), { encoding: 'utf-8' });
		const defaults: Defaults = JSON.parse(defaultsJSON);
		if (!defaults) return {};
		return defaults;
	} catch (err) {
		console.error(err);
		return {};
	}
};

const copyDefaultSearchTypes = async function(defaults: Defaults): Promise<void> {
	const sourcePath = app.isPackaged
		? path.join(process.resourcesPath, 'searches')
		: path.join(__dirname, '..', 'searches');
	try {
		await fs.ensureDir(searchTypesPath);
		await fsPromises.stat(sourcePath);
	} catch (err) {
		console.error(err);
		return;
	}

	try {
		const files = (await fsPromises.readdir(sourcePath)).filter((file: string): boolean => {
			return file === readme || !defaults.searchTypes || defaults.searchTypes.includes(file);
		});
		await Promise.all(files.map(async file => {
			await fs.copy(
				path.join(sourcePath, file),
				path.join(searchTypesPath, file)
			);
		}));
	} catch (err) {
		console.error(err);
	}
};

const createPreferences = async function(): Promise<Preferences> {
	const defaults = await loadDefaults();

	try {
		await fsPromises.stat(searchTypesPath);
	} catch (err) {
		await copyDefaultSearchTypes(defaults);
	}

	const searchTypes = await loadSearchTypes();
	const searchTypesOrder = defaults.searchTypes.join(',');
	const prefs: Preferences = {
		...defaultPrefs,
		searchTypes,
		searchTypesOrder,
		customParams: defaults.customParams || {}
	};
	await writePreferences(prefs);
	return prefs;
};
