import { ViewUpdate, PluginValue, EditorView, ViewPlugin, DecorationSet, Decoration } from '@codemirror/view';
import { Line, RangeSetBuilder } from '@codemirror/state';
import { App } from 'obsidian';
import { notePattern, errorPattern, cardTagOpen, cardTagClose, noteRegex } from 'helpers';
import { ErrorWidget, NoteDataWidget } from './widgets';

export function createMindMapEditorViewPlugin(app: App) {
  return ViewPlugin.fromClass(
    class MindMapEditorViewPlugin implements PluginValue {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      destroy() { }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const decorations: { start: number, end: number, deco: Decoration }[] = [];

        for (let { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);

          // do note matching line by line
          // sliceString does not include original text. excludes image tags
          let lineStart = from;
          let lineEnd = 0;
          let lines: Line[] = [];
          while (lineStart < to) {
            let line = view.state.doc.lineAt(lineStart);
            lineEnd = line.to;
            lineStart = line.to + 1;
            lines.push(line);
          }

          for (let line of lines) {
            let noteMatch = noteRegex.exec(line.text);
            if (noteMatch) {
              const indices = (noteMatch as any).indices;
              indices.forEach((pair: number[], i: number, array: number[][]) => {
                if (!pair) {
                  return;
                } else {
                  pair[0] += line.from;
                  pair[1] += line.from;
                }
              });

              const start = indices[6][0] - cardTagOpen.length;
              const end = indices[6][1] + cardTagClose.length;

              const deco = Decoration.replace({
                widget: new NoteDataWidget(app, noteMatch),
                inclusive: false
              });
              decorations.push({ start, end, deco });
            }
          }

          let errorMatch;
          const errorRegex = RegExp(errorPattern, 'dgm');
          while ((errorMatch = errorRegex.exec(text)) !== null) {
            let indices: number[][] = (errorMatch as any).indices;
            indices = indices.map((pair) => [pair[0] + from, pair[1] + from]);
            const start = indices[1][0];
            const end = indices[1][1];
            const warning = parseInt(errorMatch[2]);
            const deco = Decoration.replace({
              widget: new ErrorWidget(indices, warning),
              inclusive: false
            });
            decorations.push({ start, end, deco });
          }

          let spaceMatch;
          const spaceMatchRegex = RegExp("\\t+?( +)|( +)\\t+?", 'dgm');
          while ((spaceMatch = spaceMatchRegex.exec(text)) !== null) {
            let indices: number[][] = (spaceMatch as any).indices;
            const group = indices[1] ? 1 : 2;
            const start = indices[group][0] + from;
            const end = indices[group][1] + from;
            const deco = Decoration.mark({
              class: "mark-indent-error"
            });
            decorations.push({ start, end, deco });
          }
        }
        decorations.sort((a, b) => a.start - b.start);
        // console.log(decorations);
        decorations.forEach(deco => builder.add(deco.start, deco.end, deco.deco));

        return builder.finish();
      }
    }, 
    { decorations: v => v.decorations }
  );
}
