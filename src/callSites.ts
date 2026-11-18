import * as vscode from 'vscode';
import type { LineSpan } from './walkthrough';

/** Where a definition is used: a file, a 1-based line, and the definition that contains that line. */
export interface CallSite {
  path: string;
  line: number;
  /** Supplied file ID when the call site is in a file the model was also given. */
  source?: string;
  caller?: string;
}

/** A definition in a supplied file and the places that use it. */
export interface SymbolUsage extends LineSpan {
  name: string;
  callers: CallSite[];
}

interface Definition extends LineSpan {
  name: string;
  /** 0-based position of the name, where the reference provider is asked. */
  position: vscode.Position;
}

const definitionKinds = new Set([
  vscode.SymbolKind.Function, vscode.SymbolKind.Method, vscode.SymbolKind.Constructor, vscode.SymbolKind.Property,
  vscode.SymbolKind.Class, vscode.SymbolKind.Struct, vscode.SymbolKind.Interface, vscode.SymbolKind.Enum,
]);
const maxSymbolsPerFile = 40;
const maxCallersShown = 3;

/** Describe each definition's line range and callers, one line each, so the model can tell main-flow code from internal helpers. */
export function formatUsage(usages: readonly SymbolUsage[]): string {
  return usages.map(({ name, startLine, endLine, callers }) => {
    const range = `L${startLine}–${endLine}`;
    if (!callers.length) {
      return `${name}  ${range}  no callers found`;
    }
    const shown = callers.slice(0, maxCallersShown).map(site =>
      `${site.path}:L${site.line}${site.source ? ` [${site.source}]` : ''}${site.caller ? ` in ${site.caller}` : ''}`);
    const more = callers.length > maxCallersShown ? ` (+${callers.length - maxCallersShown} more)` : '';
    return `${name}  ${range}  called from ${shown.join('; ')}${more}`;
  }).join('\n');
}

/** Flatten a file's definitions with qualified names such as Downloader.finish. */
function flatten(items: readonly (vscode.DocumentSymbol | vscode.SymbolInformation)[], lines: (line: number) => string,
  container = '', into: Definition[] = []): Definition[] {
  for (const item of items) {
    const range = 'location' in item ? item.location.range : item.range;
    const qualified = container ? `${container}.${item.name}` : item.name;
    if (definitionKinds.has(item.kind)) {
      let position = 'selectionRange' in item ? item.selectionRange.start : undefined;
      if (!position) {
        const column = lines(range.start.line).indexOf(item.name);
        position = new vscode.Position(range.start.line, Math.max(0, column));
      }
      const endLine = range.end.line + (range.end.character === 0 && range.end.line > range.start.line ? 0 : 1);
      into.push({ name: qualified, startLine: range.start.line + 1, endLine, position });
    }
    if ('children' in item && item.children) {
      flatten(item.children, lines, definitionKinds.has(item.kind) ? qualified : container, into);
    }
  }
  return into;
}

async function definitionsOf(uri: vscode.Uri): Promise<Definition[]> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const items = await vscode.commands.executeCommand<(vscode.DocumentSymbol | vscode.SymbolInformation)[] | undefined>(
      'vscode.executeDocumentSymbolProvider', uri);
    return flatten(items ?? [], line => document.lineAt(line).text);
  } catch {
    return [];
  }
}

/** The innermost definition that contains a 1-based line. */
function enclosing(definitions: readonly Definition[], line: number): Definition | undefined {
  let best: Definition | undefined;
  for (const definition of definitions) {
    if (definition.startLine <= line && line <= definition.endLine &&
      (!best || definition.endLine - definition.startLine < best.endLine - best.startLine)) {
      best = definition;
    }
  }
  return best;
}

/**
 * Ask the language server where each definition in a file is used. Returns nothing when the server
 * has no symbols or doesn't answer in time, so the walkthrough still works without it.
 */
export async function findUsage(uri: vscode.Uri, span: LineSpan, sourceIds: ReadonlyMap<string, string>, timeoutMs: number): Promise<SymbolUsage[]> {
  const work = (async () => {
    const definitions = (await definitionsOf(uri)).filter(definition =>
      definition.startLine >= span.startLine && definition.endLine <= span.endLine).slice(0, maxSymbolsPerFile);
    const outlines = new Map<string, Promise<Definition[]>>([[uri.toString(), Promise.resolve(definitions)]]);
    const outlineOf = (target: vscode.Uri) => {
      const key = target.toString();
      if (!outlines.has(key)) {
        outlines.set(key, definitionsOf(target));
      }
      return outlines.get(key)!;
    };
    return Promise.all(definitions.map(async definition => {
      let locations: vscode.Location[] = [];
      try {
        locations = await vscode.commands.executeCommand<vscode.Location[] | undefined>(
          'vscode.executeReferenceProvider', uri, definition.position) ?? [];
      } catch {
        // Some language servers reject reference requests for certain symbol kinds.
      }
      const callers: CallSite[] = [];
      const seen = new Set<string>();
      for (const location of locations) {
        const line = location.range.start.line + 1;
        const sameFile = location.uri.toString() === uri.toString();
        if (sameFile && definition.startLine <= line && line <= definition.endLine) {
          continue;
        }
        const key = `${location.uri.toString()}:${line}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const caller = enclosing(await outlineOf(location.uri), line);
        callers.push({
          path: vscode.workspace.asRelativePath(location.uri, false),
          line,
          source: sourceIds.get(location.uri.toString()),
          caller: caller?.name,
        });
      }
      // Calls from other files first: they show what the rest of the program relies on.
      const self = vscode.workspace.asRelativePath(uri, false);
      callers.sort((a, b) => Number(a.path === self) - Number(b.path === self));
      return { name: definition.name, startLine: definition.startLine, endLine: definition.endLine, callers };
    }));
  })();
  const timeout = new Promise<SymbolUsage[]>(resolve => setTimeout(() => resolve([]), timeoutMs));
  return Promise.race([work, timeout]);
}
