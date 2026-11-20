import { Extension, RangeSetBuilder, StateField, Text, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { endMapTagRegex, mapTagRegex, parseMapTag } from "./helpers";
import { MapMenuSpacerWidget, MapMenuWidget, MapTitleWidget } from "./widgets";
import { App } from "obsidian";

export function createAnastomosisStateField(
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

    const ranges = getRanges(doc);

    const builder = new RangeSetBuilder<Decoration>();
    ranges.forEach((range, i) => {
      const mindMap = parseMapTag(matches[i][1]);
      if (!mindMap) {
        console.log("buildDecorations() mind map syntax error.");
        return;
      }
      const start = range[0];
      const end = range[1];
      const lineIndex = doc.line(start + 1).from;
      const from = lineIndex + matches[i].index;
      const to = from + matches[i][0].length;
      builder.add(
        from, 
        to, 
        Decoration.replace({
          widget: new MapTitleWidget(matches[i])
        })
      );
      builder.add(
        to, 
        to, 
        Decoration.replace({
          widget: new MapMenuSpacerWidget()
        })
      );
      builder.add(
        to, 
        to, 
        Decoration.replace({
          widget: new MapMenuWidget(
            app, 
            matches[i], 
            () => changeMapSettingsCallback(start, matches[i]), 
            () => checkNotesCallback(start, end), 
            () => updateNotesCallback(start, end), 
            () => viewMindMapCallback(start, end),
          )
        })
      );
    });
    /* matches.forEach((match, i) => {
      const mindMap = parseMapTag(match[1]);
      if (!mindMap) {
        console.log("buildDecorations() mind map syntax error.");
        return;
      }
      const start = lineNumbers[i];
      const end = lineNumbers[i + 1];
      const lineIndex = doc.line(start + 1).from;
      const from = lineIndex + match.index;
      const to = from + match[0].length;
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
        Decoration.replace({
          widget: new MapMenuSpacerWidget()
        })
      );
      builder.add(
        to, 
        to, 
        Decoration.replace({
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
    }); */

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

const getRanges = (doc: Text): number[][] => {
  const ranges: number[][] = [];
  let l = 0;
  let inside = false;
  while (l < doc.lines) {
    const line = doc.line(l + 1).text;
    const startMatch = mapTagRegex.exec(line);
    if (startMatch) {
      if (!inside) {
        console.log("start", l);
        ranges.push([l, 0]);
        inside = true;
      } else {
        return [];
      }
    }
    const endMatch = endMapTagRegex.exec(line);
    if (endMatch && inside) {
      if (inside) {
        console.log("end", l);
        ranges[ranges.length - 1][1] = l;
        inside = false;
      } else {
        return [];
      }
    }
    l++;
  }

  return ranges;
}

export const mindMapRanges = StateField.define<number[][]>({
  create(state) {
    return getRanges(state.doc);
  }, 
  update(oldState: number[][], transaction: Transaction) {
    if (!transaction.docChanged) {
      return oldState;
    }
    return getRanges(transaction.newDoc);
  },
});