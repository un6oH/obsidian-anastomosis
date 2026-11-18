import { Extension, RangeSetBuilder, StateField, Text, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { mapTagRegex } from "./helpers";
import { MapMenuSpacerWidget, MapMenuWidget, MapTitleWidget } from "./widgets";
import { App } from "obsidian";



export function createMindMapWidgetStateField(
  app: App, 
  changeMapSettingsCallback: (line: number, match: RegExpExecArray) => void,
  checkNotesCallback: (start: number, end: number) => void,
  updateNotesCallback: (start: number, end: number) => void,
  viewMindMapCallback: (start: number, end: number) => void
): StateField<DecorationSet> {
  const buildDecorations = (doc: Text): DecorationSet => {
    let l = 0;
    const lineNumbers: number[] = [];
    const matches: RegExpExecArray[] = [];
    while (l < doc.lines) {
      const line = doc.line(l + 1).text;
      const match = mapTagRegex.exec(line);
      if (match) {
        lineNumbers.push(l);
        matches.push(match);
      }
      l++;
    }
    lineNumbers.push(l);

    const builder = new RangeSetBuilder<Decoration>();
    matches.forEach((match, i) => {
      const start = lineNumbers[i];
      const end = lineNumbers[i + 1];
      const lineIndex = doc.line(start + 1).from;
      const from = lineIndex + match.index;
      const to = from + match[0].length;
      console.log("buildDecorations()", i, lineIndex, from, to);
      builder.add(
        from, 
        to, 
        Decoration.replace({
          widget: new MapTitleWidget(match)
        })
      );
      builder.add(
        to, 
        to, 
        Decoration.widget({
          widget: new MapMenuSpacerWidget()
        })
      );
      builder.add(
        to, 
        to, 
        Decoration.widget({
          widget: new MapMenuWidget(
            app, 
            match, 
            () => changeMapSettingsCallback(start, match), 
            () => checkNotesCallback(start, end), 
            () => updateNotesCallback(start, end), 
            () => viewMindMapCallback(start, end),
          )
        })
      );
    })

    return builder.finish();
  }

  return StateField.define<DecorationSet>({
    create(state): DecorationSet {
      return buildDecorations(state.doc);
    },
    update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
      if (!transaction.docChanged) {
        return oldState;
      }
      return buildDecorations(transaction.newDoc);
    },
    provide(field: StateField<DecorationSet>): Extension {
      return EditorView.decorations.from(field);
    }
  });
}