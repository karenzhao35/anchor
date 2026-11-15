import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import * as vscode from 'vscode';
import { hash } from './grounding';
import type { LineSpan, SourceReference } from './walkthrough';

const sourceFiles = '**/*.{c,h,cc,cpp,hpp,cs,css,dart,ex,exs,go,html,java,js,jsx,kt,kts,lua,mjs,cjs,mm,php,py,rb,rs,scala,sh,sql,swift,ts,tsx,vue,svelte,zig}';
const skippedFolders = ['node_modules', 'vendor', 'dist', 'build', 'out', 'target', 'coverage', '__pycache__'];
const excludedPaths = `{**/.*/**,**/.*,**/{${skippedFolders.join(',')}}/**,**/*.min.js}`;
const commonWords = new Set('a about an and are as at be by can could did do does file find for from happen happens how i in is it me of on or show so that the this to use was what when where which who why will with would'.split(' '));
const maxFilesToScan = 750;
const maxFileBytes = 128 * 1024;
const maxExcerpts = 8;
const maxExcerptChars = 2_800;

interface Candidate {
  uri: vscode.Uri;
  path: string;
  score: number;
  active: boolean;
}

export interface SourceExcerpt extends SourceReference {
  suppliedSpan: LineSpan;
  numberedCode: string;
}

/** Split prose and code identifiers into comparable words such as resetTime → reset, time. */
function words(text: string): Set<string> {
  const separated = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  const tokens = separated.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens.filter(word => word.length > 1 && !commonWords.has(word))
    .map(word => word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));
}

/** Count distinct question words present in a path, file, or source line. */
function overlap(terms: Set<string>, text: string): number {
  const found = words(text);
  let matches = 0;
  for (const term of terms) {
    if (found.has(term)) {
      matches++;
    }
  }
  return matches;
}

/** Exclude hidden files, common generated directories, and conventional secret files. */
function isSourcePath(path: string): boolean {
  const parts = path.split(/[\\/]/);
  const filename = parts.at(-1) ?? '';
  return !parts.some(part => part.startsWith('.') || skippedFolders.includes(part.toLowerCase())) &&
    !/^(secrets?|credentials?)([._-]|$)|\.min\.js$/i.test(filename);
}

/** Read a bounded text file for local ranking, preferring the open buffer when present. */
async function readCandidate(uri: vscode.Uri, openText: string | undefined): Promise<string | undefined> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type !== vscode.FileType.File || stat.size > maxFileBytes) {
      return;
    }
    const text = openText ?? new TextDecoder('utf-8', { fatal: true }).decode(await vscode.workspace.fs.readFile(uri));
    if (text.length > 0 && text.length <= maxFileBytes && !text.includes('\0')) {
      return text;
    }
  } catch {
    // A file may be unreadable, removed during the search, or encoded as binary.
  }
}

/** Make sure a local file reached through a directory symlink stays inside the workspace. */
async function isWithinWorkspace(uri: vscode.Uri, folder: vscode.WorkspaceFolder): Promise<boolean> {
  if (uri.scheme !== 'file') {
    return true;
  }
  try {
    const path = relative(await realpath(folder.uri.fsPath), await realpath(uri.fsPath));
    return Boolean(path) && path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
  } catch {
    return false;
  }
}

/** Score a candidate locally, giving filename and path matches extra weight. */
async function rankCandidate(uri: vscode.Uri, activeUri: vscode.Uri | undefined, open: Map<string, vscode.TextDocument>, terms: Set<string>): Promise<Candidate | undefined> {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  const path = vscode.workspace.asRelativePath(uri, false);
  if (!folder || !isSourcePath(path) || !await isWithinWorkspace(uri, folder)) {
    return;
  }

  const text = await readCandidate(uri, open.get(uri.toString())?.getText());
  if (text === undefined) {
    return;
  }
  return {
    uri,
    path,
    active: uri.toString() === activeUri?.toString(),
    score: 5 * overlap(terms, path) + 2 * overlap(terms, text),
  };
}

/** Number complete lines from a window, stopping when the excerpt reaches its size budget. */
function numberedWindow(document: vscode.TextDocument, start: number, end: number): { span: LineSpan; numberedCode: string } | undefined {
  const lines: string[] = [];
  let length = 0;
  for (let index = start; index < end; index++) {
    const line = `${index + 1}: ${document.lineAt(index).text}`;
    if (length + line.length + 1 > maxExcerptChars) {
      break;
    }
    lines.push(line);
    length += line.length + 1;
  }
  if (lines.length) {
    return {
      span: { startLine: start + 1, endLine: start + lines.length },
      numberedCode: lines.join('\n'),
    };
  }
}

/** Select a contiguous window around the strongest matching line. */
function excerptFor(document: vscode.TextDocument, terms: Set<string>): { span: LineSpan; numberedCode: string } | undefined {
  let bestIndex = 0;
  let bestScore = 0;
  for (let index = 0; index < document.lineCount; index++) {
    const line = document.lineAt(index).text;
    const score = overlap(terms, line);
    if (score > bestScore && line.length + 12 <= maxExcerptChars) {
      bestScore = score;
      bestIndex = index;
    }
  }

  const start = document.lineCount <= 80 ? 0 : Math.max(0, bestIndex - 12);
  const end = Math.min(document.lineCount, bestIndex + 70);
  const window = numberedWindow(document, start, end);
  if (window && window.span.endLine > bestIndex) {
    return window;
  }
  // Keep the match if the preceding lines used up the excerpt budget.
  return numberedWindow(document, bestIndex, end);
}

/** Read the chosen candidate through VS Code so citations match the actual editor buffer. */
async function snapshot(candidate: Candidate, terms: Set<string>): Promise<SourceExcerpt | undefined> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(candidate.uri);
  } catch {
    return;
  }
  const text = document.getText();
  if (!text || text.length > maxFileBytes || text.includes('\0')) {
    return;
  }
  const excerpt = excerptFor(document, terms);
  if (!excerpt) {
    return;
  }
  return {
    uri: document.uri.toString(),
    path: candidate.path,
    digest: hash(text),
    lineCount: document.lineCount,
    suppliedSpan: excerpt.span,
    numberedCode: excerpt.numberedCode,
  };
}

/** Find matching workspace files, then snapshot only the most relevant excerpts for the model. */
export async function discoverSources(question: string, activeUri: vscode.Uri | undefined, token: vscode.CancellationToken): Promise<Map<string, SourceExcerpt>> {
  if (!vscode.workspace.workspaceFolders?.length) {
    throw new Error('Open your project folder in this VS Code window, then ask again.');
  }

  const uris = await vscode.workspace.findFiles(sourceFiles, excludedPaths, maxFilesToScan, token);
  const open = new Map(vscode.workspace.textDocuments.map(document => [document.uri.toString(), document]));
  const terms = words(question);
  const candidates: Candidate[] = [];
  // Keep parallel reads bounded even in a large workspace.
  for (let index = 0; index < uris.length && !token.isCancellationRequested; index += 16) {
    const batch = await Promise.all(uris.slice(index, index + 16).map(uri => rankCandidate(uri, activeUri, open, terms)));
    candidates.push(...batch.filter(candidate => candidate !== undefined));
  }

  candidates.sort((a, b) => b.score - a.score || Number(b.active) - Number(a.active) || a.path.localeCompare(b.path));
  const relevant = candidates.filter(candidate => candidate.score > 0);
  const ranked = relevant.length ? relevant : candidates.filter(candidate => candidate.active || candidates.length <= maxExcerpts);
  const sources = new Map<string, SourceExcerpt>();
  for (const candidate of ranked) {
    if (sources.size >= maxExcerpts || token.isCancellationRequested) {
      break;
    }
    const source = await snapshot(candidate, terms);
    if (source) {
      sources.set(`F${sources.size + 1}`, source);
    }
  }
  if (token.isCancellationRequested) {
    throw new vscode.CancellationError();
  }
  if (!sources.size) {
    throw new Error('No matching source files found. Try mentioning a function, filename, or feature name from this workspace.');
  }
  return sources;
}
