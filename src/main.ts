import { Editor, MarkdownView, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { createMindMapEditorViewPlugin } from './mind-map-editor-view-plugin';
import { VIEW_TYPE_MIND_MAP, MindMapView } from './mind-map-view';
import { Settings, MindMapLayout, Warning, NoteGroup, MindMap, ListItem, WarningType, NoteList } from './types';
import { errorTagOpen, errorTagClose, generateNoteString, parseListItem, listItemRegex, errorTagRegex } from './helpers';
import { MapSettingsEditorModal, MindMapCreatorModal } from './modals';
import { createMindMapWidgetStateField } from './mind-map-widget-state-field';

const DEFAULT_SETTINGS = {
	layouts: [], 
}

export default class MindMapEditorPlugin extends Plugin {
	settings: Settings = {} as Settings;
	mindMapView: MindMapView = {} as MindMapView;

	async onload() {
		console.log("plugin loaded.");

		await this.loadSettings().then(() => {
			if (this.settings.layouts.length > 0) {
				const paths = this.settings.layouts.map((layout) => layout.path);
				// console.log("Loaded saved layouts for:", paths);
			} else {
				// console.log("No saved layouts");
			}
		});
		
		this.registerEditorExtension([createMindMapEditorViewPlugin(this.app), createMindMapWidgetStateField(this.app, this.changeMapSettings, this.checkNotes, this.updateNotes, this.viewMindMap)]);

		this.registerView(
			VIEW_TYPE_MIND_MAP, 
			(leaf) => new MindMapView(leaf)
		);

		// Add a command to create a mindmap template
		this.addCommand({
			id: 'mindmapeditor-create-mindmap-template', 
			name: 'Create new mind map', 
			editorCallback: (editor: Editor) => {
				new MindMapCreatorModal(this.app, editor.getSelection(), (text) => {
					editor.replaceSelection(text);
				}).open();
			}
		});

		this.addRibbonIcon('graph-star', 'Anastomosis: Open mind map viewer', () => this.openMindMapView());
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<Settings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	changeMapSettings(line: number, match: RegExpExecArray) {
		const markdownView = this.getActiveMarkdownView();
		if (!markdownView) {
			console.log("No active MarkdownView");
			return;
		}
		const editor = markdownView.editor;
		new MapSettingsEditorModal(this.app, editor, match, line);
	}

	checkNotes(start: number, end: number) {
		const markdownView = this.getActiveMarkdownView();
		if (!markdownView) {
			console.log("No active MarkdownView");
			return;
		}
		const editor = markdownView.editor;
		// checkNotes(editor, start, end);
	}

	updateNotes(start: number, end: number) {
		const markdownView = this.getActiveMarkdownView();
		if (!markdownView) {
			console.log("No active MarkdownView");
			return;
		}
		const editor = markdownView.editor;
		// check notes
		// open modal to fix errors
		// updateNotes(editor, start, end);
		
	}

	viewMindMap(start: number, end: number) {
		const markdownView = this.getActiveMarkdownView();
		if (!markdownView) {
			console.log("No active MarkdownView");
			return;
		}
		const editor = markdownView.editor;
		// checkNotes(editor, start, end);
	}

	async openMindMapView(mindMap?: MindMap) {
		const filePath = this.app.workspace.activeEditor?.file?.path!;
		// console.log(filePath);
		let layoutIndex = this.settings.layouts.findIndex((layout) => layout.path === filePath);
		const layout: MindMapLayout = {
			path: filePath, 
			ids: layoutIndex != -1 ? this.settings.layouts[layoutIndex].ids : [],
			xCoords: layoutIndex != -1 ? this.settings.layouts[layoutIndex].xCoords : [],
			yCoords: layoutIndex != -1 ? this.settings.layouts[layoutIndex].yCoords : [], 
		}

		const workspace = this.app.workspace;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_MIND_MAP);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			console.log("studyMindMap() leaf with view exists");
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			console.log("studyMindMap() leaf with view does not exist");
			leaf = workspace.getLeaf('window');
			await leaf.setViewState({ type: VIEW_TYPE_MIND_MAP, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		await workspace.revealLeaf(leaf);
		const view = leaf.view as MindMapView;
		
		if (mindMap) {
			console.log(mindMap);
			await view.loadGraph(mindMap, layout, () => {}, (layout: MindMapLayout) => saveLayout(this, layout));
		}
	}
}

export async function openMindMapView(plugin: MindMapEditorPlugin, editor: Editor, mindMap: MindMap) {
	const filePath = plugin.app.workspace.activeEditor?.file?.path!;
	// console.log(filePath);
	let layoutIndex = plugin.settings.layouts.find((layout) => layout.path === filePath);
	const layout: MindMapLayout = {
		path: filePath, 
		ids: layoutIndex ? layoutIndex.ids : [],
		xCoords: layoutIndex ? layoutIndex.xCoords : [],
		yCoords: layoutIndex ? layoutIndex.yCoords : [], 
	}

	const workspace = plugin.app.workspace;

	let leaf: WorkspaceLeaf | null = null;
	const leaves = workspace.getLeavesOfType(VIEW_TYPE_MIND_MAP);

	if (leaves.length > 0) {
		// A leaf with our view already exists, use that
		console.log("studyMindMap() leaf with view exists");
		leaf = leaves[0];
	} else {
		// Our view could not be found in the workspace, create a new leaf
		console.log("studyMindMap() leaf with view does not exist");
		leaf = workspace.getLeaf('window');
		await leaf.setViewState({ type: VIEW_TYPE_MIND_MAP, active: true });
	}

	// "Reveal" the leaf in case it is in a collapsed sidebar
	console.log(mindMap);
	await workspace.revealLeaf(leaf);
	const view = leaf.view as MindMapView;
	await view.loadGraph(mindMap, layout, () => {}, (layout: MindMapLayout) => saveLayout(plugin, layout));
}

// input: editor, start line, end line (end of doc or )
// output list of items within range of the mind map tag
function getListItems(editor: Editor, start: number, end: number): NoteList {
	const listItems: ListItem[] = [];
  const groups: NoteGroup[] = [];
	const warnings: Warning[] = [];
	const createGroup = (item: ListItem, index: number) => {
		groups.push({
			content: item.content, 
			id: item.id,
			indices: [index],
			ref: index,
		});
	};
	for (let l = start + 1; l < end; l++) {
		const line = editor.getLine(l);
		const match = listItemRegex.exec(line);
		if (!match) continue;
		
		const item = parseListItem(match);
		item.line = l;
		item.indices = (match as any).indices;
		listItems.push(item);

		// grouping by id
		if (item.id === "" || (!item.study && !item.id)) continue;

		const index = listItems.length - 1;
		const content = item.content.toLowerCase();
		
		if (item.id !== undefined) { // all notes with an id tag get linked
			const group = groups.find(group => group.id === item.id);

			// no matching id
			if (!group) { 
				createGroup(item, index);
			} else {
				// check if there is a content conflict
				if (content) {
					const groupContent = group.content;
					if (groupContent !== undefined) { 
						if (groupContent === "") { // first instance of tag was empty
							group.content = content; // set the content
						} else if (groupContent !== content) {
							group.content = undefined; // set undefined to flag conflict
						}
					} // leave undefined as there is a conflict
				}
				group.indices.push(index);
			}
		} else {
			// find group with the same content and is accepting more members
			const group = groups.find((group) => group.id === undefined && group.content! === content);
			if (!group) { // no valid groups found
				createGroup(item, index);
			} else {
				group.indices.push(index);
			}
		}
	}

	// reprocess groups
	groups.forEach((group, g) => {
		if (group.indices.length == 1) {
			// check if the group does not have a label
			if (group.content === "") { 
				warnings.push({ 
					group,
					type: WarningType.ContentNotDefined
				});
			}
			// don't need reprocessing for single-member groups
			return;
		}

		// check if multiple notes have children
		let parents: number[] = [];
		group.indices.forEach(index => {
			const item = listItems[index];
			const itemBelow = listItems[index + 1];
			if (!itemBelow) return;
			if (itemBelow.level > item.level || 
					itemBelow.level == item.level && itemBelow.listNumber == item.listNumber + 1) {
				parents.push(index);
				group.ref = index;
			}
		});
		// multiple nodes with children
		// need to resolve due to ambiguity
		if (parents.length > 1) { 
			warnings.push({
				group, 
				type: WarningType.LinkConflict
			});
			return;
		}

		if (group.id) { // id defined; check for content errors
			let warningType: WarningType | undefined;
			if (group.content === "") {
				warningType = WarningType.ContentNotDefined;
			} else if (group.content == undefined) {
				warningType = WarningType.ContentConflict;
			}
			if (warningType) {
				warnings.push({
					group,
					type: warningType
				});
			}
		} else { // assign id to content group and make sure notes have content
			let newId = group.content!.replace(/[^a-zA-Z0-9]/g, '');
			// console.log("processNotes() assigning")
			if (groups.findIndex(group => group.id === newId) != -1) { // id is taken
				let suffix = 1;
				while(groups.findIndex(group => group.id === newId + suffix) != -1) suffix++; // add a valid copy number
				group.id = newId + suffix;
			} else {
				group.id = newId;
			}
			group.indices.forEach(index => {
				listItems[index].id = newId;
				listItems[index].content = listItems[group.ref].content;
			});
		}
	});

	return {listItems, groups, warnings};
}

function addErrorTags(editor: Editor, noteList: NoteList, start: number, end: number) {
	new Notice(`${noteList.warnings.length} error(s) found.`);

	noteList.warnings.forEach(warning => {
		const { group, type } = warning;
		group.indices.map(i => noteList.listItems[i].line!).forEach(line => {
			const text = editor.getLine(line);
			editor.replaceRange(
				`${errorTagOpen}${type}${errorTagClose}`, 
				{ line, ch: text.length }
			);
		});
	});
}

export function dismissWarnings(editor: Editor, start: number, end: number) {
	const doc = editor.getDoc();

	for (let l = start + 1; l < end; l++) {
		const line = doc.getLine(l);
		const match = errorTagRegex.exec(line);

		if (!match) continue;

		const indices: number[][] = (match as any).indices;
		const from = indices[1][0];
		const to = indices[1][1];

		editor.replaceRange(
			"", 
			{ line: l, ch: from },
			{ line: l, ch: to }
		);
	}
}

function checkNotes(editor: Editor, start: number, end: number) {
	dismissWarnings(editor, start, end);



	
}

export function updateNotes(editor: Editor, noteList: NoteList, start: number, end: number) {
	new Notice("Creating cards... (this may take a few seconds)");

	// update the props tag for each note
	
	for (let newItem of noteList.listItems) {
		const line = newItem.line!;
		const text = editor.getLine(line);

		const match = listItemRegex.exec(text);
		if (!match) {
			console.log("No list item at line", line);
			continue;
		}
		const oldItem = parseListItem(match);
		if (oldItem.content !== newItem.content ||
				oldItem.id !== newItem.id ||
				oldItem.study !== newItem.study
		) {
			const indices = (match as any).indices;
			const start = indices[3][0]; // start of content
			const end = indices[0][1]; // end of line	
			editor.replaceRange(
				generateNoteString(newItem), 
				{ line: line, ch: start },
				{ line: line, ch: end }
			);
		}
	}

	console.log(`updateNotes(): updated ${noteList.listItems.length} notes`);
	new Notice(`Updated ${noteList.listItems.length} notes`);
}

async function saveLayout(plugin: MindMapEditorPlugin, layout: MindMapLayout) {
	const index = plugin.settings.layouts.findIndex((l) => l.path === layout.path);
	if (index != -1) {
		plugin.settings.layouts[index] = layout;
	} else {
		plugin.settings.layouts.push(layout);
		console.log("saveLayout(): added new layout. Saved layouts:", new Array(plugin.settings.layouts.length).fill(0).map((_, i) => plugin.settings.layouts[i].path));
	}
	plugin.saveData(plugin.settings)
		.then(() => console.log("Layout saved:", layout.path))
		.catch((error) => console.log("Could not save layout. Error:", error));
}