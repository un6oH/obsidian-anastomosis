import { FSRSParameters, Card, generatorParameters } from "ts-fsrs";

export interface ListItem { // undifferentiated list item
  level: number;
  listNumber: number;
	content: string;
	study: boolean;
	id: string | undefined;
  card: Card | undefined;
  line: number | undefined;
  indices: number[][] | undefined;
}

// note to be included in the mind map
// stores information about the note and its location in the document
// passed to mind map view
export interface Note extends ListItem {
  
}

// stores content, index, and level of every instance of the same content
// ref stores the index of the lowest level (reference) instance
export interface NoteGroup {
	content: string | undefined; // undefined if there is a conflict
	id: string | undefined; // #<id> or #"" or blank
  indices: number[]; // index in listItems[]
	ref: number; // index of item in listItems[] to use as the reference
}

export interface NoteList {
	listItems: ListItem[];
  groups: NoteGroup[];
	warnings: Warning[]; // list of types
}

export interface MindMap {
  title: string;
  studySettings: FSRSParameters; 
  notes: Note[];
  groups: NoteGroup[];
}

export interface Settings {
  layouts: MindMapLayout[];
}

export interface MindMapLayout {
  path: string;
  ids: string[];
  xCoords: number[];
  yCoords: number[];
}

export enum WarningType {
  EmptyLine, 
  Invalid, 
  DuplicateRelation, 
  DuplicateKeyWord, 
  LinkConflict, 
  LinkConflictReference, 
  ContentNotDefined, 
  ContentConflict, 
  StudyConflict
}

export interface Warning {
  group: NoteGroup;
  type: WarningType;
}