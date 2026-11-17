import { EditorView } from '@codemirror/view';
import { App, ButtonComponent, Editor, Modal, Setting, SuggestModal, TextComponent, ToggleComponent } from 'obsidian';
import { createEmptyCard, generatorParameters, State } from 'ts-fsrs';
import { ListItem, MindMap, Note, NoteList } from 'types';
import { parseNumberArray, parseMapTag, generateMapString, parseListItem, canStudy, generateNoteString, cardTagOpen, cardTagClose } from 'helpers';
import MindMapEditorPlugin from 'main';

export class MindMapCreatorModal extends Modal {
	constructor(app: App, title: string, editorCallback: (text: string) => void) {
		super(app);

		this.setTitle("Create a mind map");
		const map: MindMap = {
			title: title ? title : "My mind map",
			// separateHeadings: false, 
			// crosslink: true, 
			studySettings: generatorParameters(),
			range: [],
			notes: [],
		}

		new Setting(this.contentEl)
			.setName("Title")
			.addText((text) => text
				.setPlaceholder(map.title)
				.onChange((value) => {
					map.title = value;
				}));
		new Setting(this.contentEl)
			.setName("Desired retention")
			.addText((text) => text
				.setPlaceholder(map.studySettings.request_retention.toString())
				.onChange((value) => {
					let v = parseFloat(value);
					if (v) map.studySettings.request_retention = v;
				}));
		new Setting(this.contentEl)
			.setName("Maximum interval")
			.addText((text) => text
				.setPlaceholder(map.studySettings.maximum_interval.toString())
				.onChange((value) => {
					let v = parseFloat(value);
					if (v) map.studySettings.maximum_interval = v;
				}));
		new Setting(this.contentEl)
			.setName("Parameters")
			.addText((text) => text
				.setPlaceholder(map.studySettings.w.toString())
				.onChange((value) => {
					let v = parseNumberArray(value);
					if (v) map.studySettings.w = v;
				}));
		new Setting(this.contentEl)
			.setName("Enable fuzz")
			.addText((text) => text
				.setPlaceholder(map.studySettings.enable_fuzz.toString())
				.onChange((value) => {
					let v = value === "true";
					if (v) map.studySettings.enable_fuzz = v;
				}));
		new Setting(this.contentEl)
			.setName("Enable short term")
			.addText((text) => text
				.setPlaceholder(map.studySettings.enable_short_term.toString())
				.onChange((value) => {
					let v = value === "true";
					if (v) map.studySettings.enable_short_term = v;
				}));
		new Setting(this.contentEl)
			.addButton((btn) => btn
				.setButtonText("Create")
				.setCta()
				.onClick(() => {
					this.close();
					editorCallback(generateMapString(map, true));
				})
			)
	}
}

export class ViewMindMapModal extends Modal {
	constructor(plugin: MindMapEditorPlugin, editor: Editor, mindMap: MindMap) {
		super(plugin.app);

		this.setTitle("Study " + mindMap.title);

		let newCount = 0, learningCount = 0, reviewCount = 0;
		mindMap.notes.forEach((note) => {
			if (!note.card) return;
			switch (note.card.state) {
				case State.New: newCount++; break;
				case State.Learning || State.Relearning: learningCount++; break;
				case State.Review: reviewCount++; break;
			}
		});

		new Setting(this.contentEl)
			.setHeading()
			.setName("Progress:");

		new Setting(this.contentEl)
			.setName("New:")
			.addText((text) => text
				.setValue(newCount.toString())
				.setDisabled(true)
			);

		new Setting(this.contentEl)
			.setName("Learning:")
			.addText((text) => text
				.setValue(learningCount.toString())
				.setDisabled(true)
			);

		new Setting(this.contentEl)
			.setName("To Review:")
			.addText((text) => text
				.setValue(reviewCount.toString())
				.setDisabled(true)
			);

		new Setting(this.contentEl)
			.setHeading()
			.setName("Settings:");

		new Setting(this.contentEl)
			.addButton((button) => button
				.setButtonText("Update")
				.setCta()
				.onClick(() => {
					// new UpdateNotesModal(plugin.app, editor).open();
					// update notes
				}))
			.addButton((button) => button
				.setButtonText("Let's go!")
				.setCta()
				.onClick(() => {
					plugin.openMindMapView(mindMap);
					this.close();
				}));
	}
}

export class MapSettingsEditorModal extends Modal {
	// start and end of tag
	constructor(app: App, editor: Editor, match: RegExpExecArray, line: number) {
		// console.log("Created map study settings editor modal", "start:", start, "end:", end);
		super(app);
		const mindMap = parseMapTag(match[0]);
		const indices = (match as any).indices;

		// parse data string
		this.setTitle("Mind Map Settings");

		new Setting(this.contentEl)
			.setName("Title")
			.addText(text =>
				text
					.setPlaceholder(mindMap.title)
					.setValue(mindMap.title)
					.onChange((value) => {
						mindMap.title = value;
					})
			);

		new Setting(this.contentEl)
			.setName('Enable fuzz')
			.setDesc("Allow due dates to spread out over time")
			.addToggle((toggle) => toggle
				.setValue(mindMap.studySettings.enable_fuzz)
				.onChange((value) => mindMap.studySettings.enable_fuzz = value)
			);
		new Setting(this.contentEl)
			.setName('Enable short term')
			.addToggle((toggle) => toggle
				.setValue(mindMap.studySettings.enable_short_term)
				.onChange((value) => mindMap.studySettings.enable_short_term = value)
			);
		new Setting(this.contentEl)
			.setName('Maximum interval (days)')
			.addText((text) =>
				text.setPlaceholder(mindMap.studySettings.maximum_interval.toString()).onChange((value) => {
					mindMap.studySettings.maximum_interval = parseFloat(value);
				}));
		new Setting(this.contentEl)
			.setName('Target retention')
			.setDesc("Proportion of notes you want to remember at each session.")
			.addText((text) =>
				text.setPlaceholder(mindMap.studySettings.request_retention.toString()).onChange((value) => {
					mindMap.studySettings.request_retention = parseFloat(value);
				}));

		new Setting(this.contentEl)
			.addButton((btn) => {
				btn
					.setButtonText('OK')
					.setCta()
					.onClick(() => {
						this.updateSettings(editor, mindMap, line, indices[1][0], indices[1][1]);
						this.close();
					})
			});
	}

	updateSettings(editor: Editor, mindMap: MindMap, line: number, from: number, to: number) {
		editor.replaceRange(
			generateMapString(mindMap, false),
			{ line: line, ch: from },
			{ line: line, ch: to }
		)
	}
}

// Called from note widget. Specifies start and end indices of text within widget
export class NoteEditorModal extends Modal {
	constructor(app: App, view: EditorView, listItemMatch: RegExpExecArray) {
		super(app);
		const note = parseListItem(listItemMatch);
		const card = note.card!;
		const initial = parseListItem(listItemMatch);

		let contentField: TextComponent;
		let unlinkToggle: ToggleComponent;
		let idField: TextComponent;
		let studyToggle: ToggleComponent;
		let applyChangesButton: ButtonComponent;

		let title = "Edit Note: ";
		title += note.content;
		this.setTitle(title);

		// displays path
		const pathDisplay = new Setting(this.contentEl)
			.setDesc("show path here");

		// settings
		new Setting(this.contentEl)
			.setName("Content")
			// .setDesc("Warning: changing content may disconnect linked notes")
			.addText((text) =>
				contentField = text
					.setPlaceholder(initial.content)
					.setValue(note.content)
					.onChange((value) => {
						const content = value.trim();
						if (content === "") {
							applyChangesButton.setDisabled(note.id ? true : false);
							note.content = "";
						} else {
							const study = canStudy(content);
							studyToggle.setValue(study);
							applyChangesButton.setDisabled(false);
							note.content = content;
						}
					}
					))
			.addButton((button) =>
				button
					.setButtonText("Reset")
					.setCta()
					.onClick(() => {
						contentField.setValue(initial.content);
						note.content = initial.content;
						studyToggle.setValue(initial.study);
						// update the path display
						// update the card display
					})
			)

		new Setting(this.contentEl)
			.setName("Force unlink")
			.setDesc("Node will not merge with similar nodes")
			.addToggle((toggle) =>
				unlinkToggle = toggle
					.setValue(note.id === "") // blank # means force unlink
					.onChange((unlink) => {
						if (unlink) {
							note.id = "";
							idField.setPlaceholder("linking disabled").setValue("");
						} else {
							note.id = initial.id ? initial.id : undefined;
							let newText = initial.id ? initial.id : "";
							idField.setPlaceholder(newText).setValue(newText);
						}
						idField.setDisabled(unlink);
					})
			);

		new Setting(this.contentEl)
			.setName('ID')
			.setDesc("Add a new tag or search existing tags. Letters and numbers only")
			.addText((text) =>
				idField = text
					.setPlaceholder(note.id === "" ? "linking disabled" : (note.id ? note.id : ""))
					.setValue(note.id ? note.id : "")
					.setDisabled(note.id === "")
					.onChange((value) => {
						let validId = value.replace(/[^a-zA-Z0-9]/, '');
						idField.setValue(validId);
						if (validId === "") {
							note.id = undefined;
							if (note.content === "") {
								applyChangesButton.setDisabled(true);
							}
						} else {
							applyChangesButton.setDisabled(false);
							note.id = validId;
						}
					})
			)
			.addButton((button) => button
				.setButtonText("Clear")
				.setCta()
				.onClick(() => {
					idField.setValue("");
					note.id = undefined;
				})
			)
			.addButton((button) => button
				.setButtonText("Search")
				.setCta()
				.onClick(() => {
					new IdSuggestModal(app, view, note.content, (referenceNote: Note) => {
						note.id = referenceNote.id!;
						unlinkToggle.setValue(false);
						idField.setValue(note.id);
						// 
					}).open();
				})
			);

		// toggle to select studyable
		const studySetting = new Setting(this.contentEl)
			.setName('Studyable')
			.addToggle((toggle) =>
				studyToggle = toggle
					.setValue(note.card ? true : false)
					.onChange((study) => {
						note.study = study;
						if (study) {
							note.card = initial.card ? initial.card : createEmptyCard();
							studySetting.setDesc("");
							applyChangesButton.setButtonText("Apply changes");
							unlockCardSettings();
						} else {
							note.card = undefined;
							studySetting.setDesc("Incorrect format to be studied. The card will be deleted.");
							applyChangesButton.setButtonText("Delete card");
							lockCardSettings();
						}
					})
					.setDisabled(true)
			);

		let dueDateSetting: Setting;
		dueDateSetting = new Setting(this.contentEl)
			.setName('Due date')
			.addText((text) =>
				text.setValue(card.due.toString()).onChange((value) => {
					let newDate = new Date(value);
					if (newDate.valueOf()) card.due = newDate;
				})
			);

		// card params
		const info = new DocumentFragment();
		info.append(
			createEl('p', { text: `Stability: ${card.stability.toString()}` }),
			createEl('p', { text: `Difficulty: ${card.difficulty.toString()}` }),
			createEl('p', { text: `Elapsed days: ${card.elapsed_days.toString()}` }),
			createEl('p', { text: `Scheduled days: ${card.scheduled_days.toString()}` }),
			createEl('p', { text: `Reps: ${card.reps.toString()}` }),
			createEl('p', { text: `Lapses: ${card.lapses.toString()}` }),
			createEl('p', { text: `State: ${State[card.state]}` }),
			createEl('p', { text: `Last Reviewed: ${card.last_review ? card.last_review.toString() : "Not studied yet"}` }),
		)
		new Setting(this.contentEl)
			.setName("Other card information")
			.setHeading()
			.setDesc(info);

		const unlockCardSettings = () => {
			dueDateSetting.setDisabled(false);
		}
		const lockCardSettings = () => {
			dueDateSetting.setDisabled(true);
		}

		const indices = (listItemMatch as any).indices;
		new Setting(this.contentEl)
			.addButton(btn =>
				btn
					.setButtonText('Dismiss changes')
					.setCta()
					.onClick(() => this.close())
			)
			.addButton(btn =>
				applyChangesButton = btn
					.setButtonText('Apply changes')
					.setCta()
					.onClick(() => {
						this.close();
						this.updateData(view, indices, note);
					})
			);
		return;
	}

	// indices of noteMatch
	updateData(view: EditorView, indices: number[][], note: Note) {
		const contentEdit = view.state.update({
			changes: {
				from: indices[3][0],
				to: indices[0][1],
				insert: generateNoteString(note)
			}
		});
		view.dispatch(contentEdit);
	}
}

class IdSuggestModal extends SuggestModal<ListItem> {
	callback: (item: ListItem) => void;
	items: ListItem[];
	defaultQuery: string;
	constructor(app: App, view: EditorView, defaultQuery: string, callback: (note: Note) => void) {
		super(app)
		this.callback = callback;
		this.items = [];
		// this.paths = [];
		this.defaultQuery = defaultQuery;

		const tagRegex = RegExp(`(\\t*)(\\d+. |- )(.*?)(#\\w+)(${cardTagOpen}.*?${cardTagClose})?`, 'd');
		for (let line of view.state.doc.iterLines()) {
			const match = tagRegex.exec(line);
			if (match) {
				if (match[5]) {
					match[3] += match[4] + match[5];
				}
				this.items.push(parseListItem(match));
			}
		}
	}

	getSuggestions(query: string): ListItem[] {
		let q = query ? query : this.defaultQuery;
		q = q.toLowerCase();
		return this.items.filter((item) =>
			item.content.toLowerCase().includes(q) ||
			item.id && item.id.toLowerCase().includes(q)
		);
	}

	renderSuggestion(item: ListItem, el: HTMLElement): void {
		el.createEl('div', { text: item.content + " #" + item.id + (item.study ? " + Note" : "") });
		// el.createEl('small', { text: "show path here" });
	}

	onChooseSuggestion(item: ListItem, evt: MouseEvent | KeyboardEvent): void {
		this.callback(item);
		this.close();
	}
}

export class ErrorViewerModal extends Modal {
	constructor(app: App, editor: Editor, noteList: NoteList) {
		super(app);

		this.setTitle("Errors");

	}
}