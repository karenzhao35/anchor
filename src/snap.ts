import type { LineSpan } from './walkthrough';

/** A function, method or type definition with its full range (1-based, inclusive). */
export interface SymbolRange extends LineSpan {
  name: string;
}

/** What the extension knows about a file's real structure, used to correct model line ranges. */
export interface FileOutline {
  lines: string[];
  symbols: SymbolRange[];
}

/** How far (in lines) the model's start may be from the definition it names. */
const NEAR = 15;
const MAX_SPAN = 300;

/** Reduce `Downloader.start()`, `ns::foo` or `start(self)` to the bare name `start`. */
export function baseName(symbol: string): string {
  return symbol.replace(/\(.*$/s, '').split(/\.|::|#|->/).at(-1)?.trim() ?? '';
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indent(line: string): number {
  return /^\s*/.exec(line)?.[0].replace(/\t/g, '    ').length ?? 0;
}

function isComment(line: string): boolean {
  return /^\s*(#|\/\/|\/\*|\*)/.test(line);
}

/** Include decorators or annotations directly above a definition. */
function withDecorators(range: LineSpan, lines: string[]): LineSpan {
  let start = range.startLine;
  while (start > 1 && /^\s*@/.test(lines[start - 2] ?? '')) {
    start--;
  }
  return { startLine: start, endLine: range.endLine };
}

/**
 * Estimate where a definition starting at `start` ends, from indentation alone: the block ends
 * before the next non-blank line indented no deeper than the definition, and includes a closing
 * brace at that level. Multi-line signatures and a brace on its own line are treated as header.
 */
export function blockEnd(start: number, lines: string[]): number {
  const base = indent(lines[start - 1] ?? '');
  let depth = 0;
  let index = start - 1;
  // Skip the rest of a signature that spans several lines, such as `def f(\n  a,\n) -> X:`.
  for (; index < lines.length; index++) {
    for (const char of lines[index].replace(/(["'`]).*?\1/g, '')) {
      depth += char === '(' || char === '[' ? 1 : char === ')' || char === ']' ? -1 : 0;
    }
    if (depth <= 0) {
      break;
    }
  }
  let end = index + 1;
  for (index++; index < lines.length && index - (start - 1) < MAX_SPAN; index++) {
    const line = lines[index];
    if (!line.trim() || isComment(line)) {
      continue;
    }
    if (indent(line) <= base) {
      if (/^\s*\{/.test(line)) {
        end = index + 1;
        continue;
      }
      if (/^\s*[}\])]|^\s*end\b/.test(line)) {
        end = index + 1;
      }
      break;
    }
    end = index + 1;
  }
  return end;
}

/** Find a line near `around` that defines `name`, by keyword first and then by shape. */
function textDefinition(name: string, around: number, lines: string[]): number | undefined {
  const word = escape(name);
  const patterns = [
    new RegExp(`\\b(def|class|function|fn|func|struct|interface|enum|type|impl)\\s+${word}\\b`),
    // C-like or assigned definitions (`static int name(`, `name = (`, `name: function`): only type words may precede the
    // name, so `x = name(`, `obj.name(`, `return name(` and C calls ending in `;` don't count.
    new RegExp(`^\\s*(?!(return|await|yield|if|while|for|else|throw)\\b)(?:[\\w*&<>\\[\\],:]+\\s+)*\\*?${word}\\s*(\\(|=[^=]|:|\\{|<)(?!.*;\\s*$)`),
  ];
  for (const pattern of patterns) {
    for (let offset = 0; offset <= NEAR; offset++) {
      for (const line of offset ? [around - offset, around + offset] : [around]) {
        const text = lines[line - 1];
        if (text !== undefined && !isComment(text) && pattern.test(text)) {
          return line;
        }
      }
    }
  }
}

/** Locate the real range of the definition named `name` closest to `around`. */
export function findDefinition(name: string, around: number, outline: FileOutline): LineSpan | undefined {
  let best: SymbolRange | undefined;
  let bestDistance = Infinity;
  for (const symbol of outline.symbols) {
    if (baseName(symbol.name) !== name) {
      continue;
    }
    const distance = around >= symbol.startLine && around <= symbol.endLine ? 0 : Math.abs(symbol.startLine - around);
    if (distance < bestDistance || (distance === bestDistance && best &&
        symbol.endLine - symbol.startLine < best.endLine - best.startLine)) {
      best = symbol;
      bestDistance = distance;
    }
  }
  if (best && bestDistance <= NEAR) {
    return withDecorators(best, outline.lines);
  }
  const start = textDefinition(name, around, outline.lines);
  return start === undefined ? undefined : withDecorators({ startLine: start, endLine: blockEnd(start, outline.lines) }, outline.lines);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * Correct a model-proposed range using the file's real structure. A step that names a whole
 * definition is snapped to it. A partial step (with `parent`, or covering a small slice that
 * doesn't start at the definition) is kept but clamped inside its function so it cannot spill
 * into a neighbour. Returns the original range when nothing can be resolved.
 */
export function snapRange(step: LineSpan & { symbol: string; parent?: string }, outline: FileOutline): LineSpan {
  const original = { startLine: step.startLine, endLine: step.endLine };
  const name = baseName(step.parent || step.symbol);
  const definition = name && findDefinition(name, step.startLine, outline);
  if (!definition) {
    return original;
  }

  const length = definition.endLine - definition.startLine + 1;
  const covered = Math.min(step.endLine, definition.endLine) - Math.max(step.startLine, definition.startLine) + 1;
  const whole = !step.parent && (step.startLine <= definition.startLine + 3 || covered / length >= 0.5);
  if (whole && length <= MAX_SPAN) {
    return definition;
  }
  const startLine = clamp(step.startLine, definition.startLine, definition.endLine);
  const endLine = clamp(step.endLine, startLine, Math.min(definition.endLine, startLine + MAX_SPAN - 1));
  return { startLine, endLine };
}
