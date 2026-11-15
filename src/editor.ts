import * as vscode from 'vscode';
import { findStep, hash } from './grounding';
import type { LineSpan, Step } from './walkthrough';

const documentDigests = new WeakMap<vscode.TextDocument, { version: number; digest: string }>();

/** Hash the current text once per document version, including unsaved edits. */
export function documentDigest(document: vscode.TextDocument): string {
  const cached = documentDigests.get(document);
  if (cached?.version === document.version) {
    return cached.digest;
  }

  const digest = hash(document.getText());
  documentDigests.set(document, { version: document.version, digest });
  return digest;
}

/** Translate an inclusive, 1-based line span into a zero-based VS Code range. */
export function sourceRange(document: vscode.TextDocument, span: LineSpan): vscode.Range {
  const start = document.lineAt(span.startLine - 1).range.start;
  const end = document.lineAt(span.endLine - 1).range.end;
  return new vscode.Range(start, end);
}

/** Compare the current buffer with its snapshot, falling back to the last check for a closed file. */
export function isStale(step: Step): boolean {
  const document = vscode.workspace.textDocuments.find(open => open.uri.toString() === step.uri);
  return document ? documentDigest(document) !== step.digest : Boolean(step.stale);
}

/** Remember whether the referenced document has changed, even after its tab closes. */
export function updateStaleness(steps: Step[], document: vscode.TextDocument): boolean {
  const uri = document.uri.toString();
  const related = steps.filter(step => step.uri === uri);
  for (const step of related) {
    step.stale = documentDigest(document) !== step.digest;
  }
  return related.length > 0;
}

/** Select the current citation under the cursor in the active editor. */
export function stepAtCursor(steps: Step[], editor: vscode.TextEditor | undefined): Step | undefined {
  if (!editor) {
    return;
  }
  const uri = editor.document.uri.toString();
  if (!steps.some(step => step.uri === uri)) {
    return;
  }
  return findStep(steps, uri, editor.selection.active.line + 1, documentDigest(editor.document));
}

/** Open the source and verify its snapshot before anyone uses the saved line range. */
export async function openCurrentSource(step: Step, staleMessage: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(step.uri));
  step.stale = documentDigest(document) !== step.digest;
  if (step.stale) {
    throw new Error(staleMessage);
  }
  return document;
}

/** Open the real editor, move the cursor to the citation, and reveal the cited lines. */
export async function revealSource(document: vscode.TextDocument, step: Step): Promise<void> {
  const editor = await vscode.window.showTextDocument(document);
  const range = sourceRange(document, step);
  editor.selection = new vscode.Selection(range.start, range.start);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export class EditorDecorations implements vscode.Disposable {
  private readonly highlight: vscode.TextEditorDecorationType;
  private readonly marker: vscode.TextEditorDecorationType;

  /** Create reusable decorations for the selected range and each citation's first line. */
  constructor(extensionUri: vscode.Uri) {
    this.highlight = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('explorer.anchorHighlight'),
    });
    this.marker = vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.joinPath(extensionUri, 'media', 'anchor.svg'),
      gutterIconSize: 'contain',
    });
  }

  /** Replace visible decorations with current citations, removing marks from stale ranges. */
  update(steps: Step[], activeId: string | undefined): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const document = editor.document;
      const uri = document.uri.toString();
      const valid = steps.filter(step => step.uri === uri && step.digest === documentDigest(document));
      const active = valid.find(step => step.id === activeId);
      editor.setDecorations(this.highlight, active ? [sourceRange(document, active)] : []);
      editor.setDecorations(this.marker, valid.map(step => ({
        range: document.lineAt(step.startLine - 1).range,
        hoverMessage: 'Explorer: ' + step.role,
      })));
    }
  }

  /** Release the decoration types and remove their marks from the editor. */
  dispose(): void {
    this.highlight.dispose();
    this.marker.dispose();
  }
}
