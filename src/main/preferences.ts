import * as fs from 'fs-extra';
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
	[key: string]: string | undefined;
}

export interface SearchType {
	id: string;
	label: string;
	icon: string;
	search: (search: string, customParams: CustomParamsMap, getPassword: GetPasswordFunc, modulesPath: string) => Promise<SearchResult[]>;
	maskIcon?: boolean;
	customParams?: CustomParamDef[];
	version: number;
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
	accelerator: process.platform === 'linux' ? 'Control+Space' : 'Alt+Space'
};

interface Defaults {
	searchTypes?: Array<string>;
	customParams?: CustomParamsMap;
};

export type GetPasswordFunc = (service: string, account: string) => Promise<string | null>;

export interface ExportedSearchType {
	id: string;
	label: string;
	icon: string;
	maskIcon?: boolean;
	customParams?: CustomParamDef[];
	css?: string;
}

export interface ExportedPreferences {
	launchStartup?: boolean | null;
	searchTypesOrder?: string;
	searchTypes?: ExportedSearchType[];
	customParams?: CustomParamsMap;
	accelerator?: string;
};

export const exportPrefs = function(prefs: Preferences): ExportedPreferences {
	const exported: ExportedPreferences = {};
	if (process.platform === 'linux') {
		exported.launchStartup = null;
	} else {
		exported.launchStartup = prefs.launchStartup;
	}
	exported.searchTypes = prefs.searchTypes ? exportSearchTypes(prefs.searchTypes) : [];
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

export const loadSearchTypes = async function(searchTypesPath: string, reload: boolean): Promise<SearchType[]> {
	try {
		const files = await fs.readdir(searchTypesPath);
		return (await Promise.all(files.map(async file => {
			const filePath = path.join(searchTypesPath, file);
			if ((await fs.stat(filePath)).isDirectory()) {
				try {
					const indexPath = path.join(filePath, 'index.js');
					await fs.access(indexPath);
					if (reload) {
						delete require.cache[require.resolve(indexPath)];
					}
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

export const savePreferences = async function(data: Preferences = {}, oldData?: Preferences): Promise<Preferences> {
	const searchTypes = await loadSearchTypes(searchTypesPath, true);
	const customParams: CustomParamsMap = {};
	for (const searchType of searchTypes) {
		if (searchType.customParams) {
			for (const param of searchType.customParams) {
				const fullID = searchType.id + '.' + param.id;
				let newValue = data.customParams ? data.customParams[fullID] : '';
				if (newValue === undefined) newValue = '';
				if (param.password) {
					let oldValue = oldData && oldData.customParams ? oldData.customParams[fullID] : '';
					if (oldValue === undefined) oldValue = '';
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

	if (process.platform !== 'linux' && app.getLoginItemSettings) {
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
	await fs.writeFile(path.join(userData, 'preferences.json'), dataJSON, { encoding: 'utf8' });
	return;
};

export const loadPreferences = async function(): Promise<{
	prefs: Preferences,
	justCreated: boolean
}> {
	const defaults = await loadDefaults();
	await updateSearchTypes(defaults);

	let justCreated = false;
	let prefs: Preferences | null = null;
	try {
		const dataJSON = await fs.readFile(path.join(userData, 'preferences.json'), { encoding: 'utf8' });
		prefs = JSON.parse(dataJSON);
		if (!prefs) prefs = null;
	} catch (e) {
	}

	if (prefs === null) {
		prefs = await createPreferences(defaults);
		justCreated = true;
	}

	const searchTypes = await loadSearchTypes(searchTypesPath, false);
	prefs = {
		...prefs,
		searchTypes
	};
	return { prefs, justCreated };
};

const loadDefaults = async function(): Promise<Defaults> {
	try {
		const defaultsJSON = await fs.readFile(path.join(__dirname, 'defaults.json'), { encoding: 'utf-8' });
		const defaults: Defaults = JSON.parse(defaultsJSON);
		if (!defaults) return {};
		return defaults;
	} catch (err) {
		console.error(err);
		return {};
	}
};

const copyReadme = async function(sourcePath: string) {
	try {
		await fs.stat(path.join(searchTypesPath, readme));
	} catch (err) {
		await fs.copy(path.join(sourcePath, readme), path.join(searchTypesPath, readme));
	}
}

const updateSearchType = async function(sourcePath: string, file: string, sourceSearchType: SearchType, existingSearchType: SearchType | undefined) {
	try {
		if (!existingSearchType || (existingSearchType.version !== undefined && sourceSearchType.version > existingSearchType.version)) {
			if (existingSearchType) {
				await fs.remove(path.join(searchTypesPath, file));
			}
			console.log(`updating ${file} search type`);
			await fs.copy(
				path.join(sourcePath, file),
				path.join(searchTypesPath, file)
			);
		}
	} catch (err) {
		console.error(err);
	}
}

const updateSearchTypes = async function(defaults: Defaults): Promise<void> {
	const sourcePath = app.isPackaged
		? path.join(process.resourcesPath, 'searches')
		: path.join(__dirname, '..', '..', 'searches');
	try {
		await fs.stat(sourcePath);
		await fs.ensureDir(searchTypesPath);
		await copyReadme(sourcePath);

		const sourceSearchTypes = await loadSearchTypes(sourcePath, false);
		const existingSearchTypes = await loadSearchTypes(searchTypesPath, false);
		const sourceFiles = (await fs.readdir(sourcePath)).filter((file: string): boolean => {
			return !defaults.searchTypes || defaults.searchTypes.includes(file);
		});
		await Promise.all(sourceFiles.map(async file => {
			const sourceSearchType = sourceSearchTypes.find(type => type.id === file);
			if (!sourceSearchType) return;
			const existingSearchType = existingSearchTypes.find(type => type.id === file);
			await updateSearchType(sourcePath, file, sourceSearchType, existingSearchType);
		}));
	} catch (err) {
		console.error(err);
		return;
	}
};

const createPreferences = async function(defaults: Defaults): Promise<Preferences> {
	const searchTypesOrder = defaults.searchTypes ? defaults.searchTypes.join(',') : '';
	const prefs: Preferences = {
		...defaultPrefs,
		searchTypesOrder,
		customParams: defaults.customParams || {}
	};
	await writePreferences(prefs);
	return prefs;
};
