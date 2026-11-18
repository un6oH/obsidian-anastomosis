import { EditorView, WidgetType } from '@codemirror/view';
import { cardStateColours, colour, formatContent, parseListItem, parseNote } from './helpers';
import { MapSettingsEditorModal, NoteEditorModal } from './modals';
import { App } from 'obsidian';
import { Note, WarningType } from './types';

export class MapTitleWidget extends WidgetType {
  title: string;

  constructor(match: RegExpExecArray) {
    super();
    this.title = match[1].split(';')[0];
  }

  toDOM(view: EditorView): HTMLElement {
    const title = document.createElement('h1');
    title.addClass('widget-map-title');
    title.textContent = this.title;
    return title;
  }

  ignoreEvent() {
    return false;
  }
}

export class MapMenuSpacerWidget extends WidgetType {
  constructor() {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const spacer = document.createElement('div');
    spacer.addClass('widget-map-menu-spacer');
    return spacer;
  }
}

function createButton(textContent: string, id: string, clickHandler: any): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = textContent;
  button.addClass('widget-map-button');
  button.id = id;
  button.onclick = clickHandler;
  return button;
}

export class MapMenuWidget extends WidgetType {
  app: App;
  match: RegExpExecArray;
  // editor callbacks
  changeMapSettingsButtonHandler: () => void;
  checkNotesButtonHandler:  () => void;
  updateNotesButtonHandler: () => void;
  viewMindMapButtonHandler: () => void;
  constructor(
    app: App, 
    match: RegExpExecArray, 
    changeMapSettingsButtonHandler: () => void, 
    checkNotesButtonHandler: () => void,
    updateNotesButtonHandler: () => void,
    viewMindMapButtonHandler: () => void
  ) {
    super();
    this.app = app;
    this.match = match;
    this.changeMapSettingsButtonHandler = changeMapSettingsButtonHandler;
    this.checkNotesButtonHandler = checkNotesButtonHandler;
    this.updateNotesButtonHandler = updateNotesButtonHandler;
    this.viewMindMapButtonHandler = viewMindMapButtonHandler;
  }
  
  toDOM(view: EditorView) {
    const menu = document.createElement('div');
    menu.addClass("widget-map-menu");
    menu.append(createButton("Settings", "widget-map-settings-button", this.changeMapSettingsButtonHandler));
    menu.append(createButton("Update Notes", "widget-map-update-cards-button", this.updateNotesButtonHandler));
    menu.append(createButton("View Mind Map", "widget-map-open-button", this.viewMindMapButtonHandler));
    return menu;
  }
}

export class NoteDataWidget extends WidgetType {
  app: App = {} as App;
  match: RegExpExecArray;
  note: Note;
  indices: number[][];

  // match: ExecArray from noteRegex
  constructor(app: App, match: RegExpExecArray, indices: number[][]) {
    super();
    this.app = app;
    this.match = match;
    this.note = parseNote(match);
    this.indices = indices;
  }

  toDOM(view: EditorView) {
    // icon container
    const icon = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    icon.addClass("widget-node-icon");
    icon.setAttributeNS(null, "viewBox", "0 0 24 24");
    icon.setAttributeNS(null, "width", "24px");
    icon.setAttributeNS(null, "height", "24px");
    // main circle
    const circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
    circle.setAttributeNS(null, "cx", "12");
    circle.setAttributeNS(null, "cy", "12");
    circle.setAttributeNS(null, "r", "12");
    circle.setAttributeNS(null, "fill", colour(this.note.level));
    icon.appendChild(circle);
    // inner circle / status indicator
    const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
    innerCircle.setAttributeNS(null, "cx", "12");
    innerCircle.setAttributeNS(null, "cy", "12");
    innerCircle.setAttributeNS(null, "r", "8");
    innerCircle.setAttributeNS(null, "fill", cardStateColours[this.note.card!.state]);
    icon.appendChild(innerCircle);

    const block = document.createElement('span');
    block.addClass('widget-note');

    block.appendChild(icon);
    const content = formatContent(document, this.note.content, () => {}).content;
    // block.appendChild(formatContent(document, this.note.content, () => {}).content);
    block.appendChild(content);
    if (this.note.id !== undefined && !this.note.content) {
      const tag = document.createElement('span');
      tag.addClass('cm-hashtag');
      tag.textContent = "#" + this.note.id;
      block.appendText(this.note.content ? " (" : "(");
      block.appendChild(tag);
      block.appendText(")");
    }

    content.hide();
    block.onmouseover = () => {
      content.show();
    }
    block.onmouseleave = () => {
      content.hide();
    }

    block.onclick = () => {
      new NoteEditorModal(this.app, view, this.note, this.match, this.indices).open();
    };

    return block;
  }

  ignoreEvent() {
    return false;
  }
}

const warningNames = [
  "(Empty line)", 
  "(Invalid format)", 
  "(Duplicate relation)", 
  "(Duplicate key word)", 
  "(other key words referencing this also have children)", 
  "(this key word references a key word that has children)", 
  "(tag does not have associated content)", 
  "(conflicting content associated with this tag)", 
];

const warningMessages: string[] = [];
warningMessages[WarningType.EmptyLine] = "Empty line.";
warningMessages[WarningType.Invalid] = "Invalid format.";
warningMessages[WarningType.DuplicateKeyWord] = "";
warningMessages[WarningType.DuplicateRelation] = "";
warningMessages[WarningType.LinkConflict] = "Only one linked note can have children. Consolidate the children under one note or unlink the parents using \"*\" OR tags";
warningMessages[WarningType.ContentConflict] = "Some notes with this tag have different associated content. Make sure all of the notes have the same content (case-insensitive) OR only one of the notes have content.";
warningMessages[WarningType.ContentNotDefined] = "None of the notes with this tag have associated content.";
warningMessages[WarningType.StudyConflict] = "Card does not match content type";

export class ErrorWidget extends WidgetType {
  indices: number[][];
  type: WarningType;

  constructor(indices: number[][], type: WarningType) {
    super();
    // this.view = view;
    this.indices = indices;
    this.type = type;
  }

  toDOM(view: EditorView) {
    const warningMessage = document.createElement('span');
    warningMessage.addClass('widget-error');
    warningMessage.textContent = " " + warningNames[this.type] + " ";

    const deleteButton = document.createElement('a');
    deleteButton.textContent = "delete";
    deleteButton.addClass('widget-error-delete');
    // deleteButton.onclick = this.deleteLine;
    const newLineOffset = this.indices[0][0] == 0 ? 0 : -1;
    deleteButton.onclick = () => view.dispatch({
      changes: {
        from: this.indices[0][0] + newLineOffset, 
        to: this.indices[0][1],
      }, 
      selection: { anchor: this.indices[0][0] + newLineOffset }
    });

    const okButton = document.createElement('a');
    okButton.textContent = "OK";
    okButton.addClass('widget-error-dismiss');
    // okButton.onclick = this.dismissError;
    okButton.onclick = () => view.dispatch({
      changes: {
        from: this.indices[1][0], 
        to: this.indices[1][1],
      }, 
      selection: { anchor: this.indices[1][0] }
    });

    const widget = document.createElement('span');
    widget.append(warningMessage);
    widget.append(deleteButton);
    widget.appendText(" | ");
    widget.append(okButton);

    return widget;
  }
  
  ignoreEvent() {
    return false;
  }
}