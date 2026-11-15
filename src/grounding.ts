import { createHash } from 'node:crypto';
import type { SourceReference, Step } from './walkthrough';

type JsonObject = Record<string, unknown>;

/** Fingerprint the full document so a citation can be checked against later edits. */
export function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Recognize JSON objects while excluding arrays and null. */
function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read a model response as a JSON object, accepting a surrounding Markdown fence. */
export function readResponse(text: string): JsonObject {
  const clean = text.trim().replace(/^\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}$/i, '$1');
  try {
    const value: unknown = JSON.parse(clean);
    if (isObject(value)) {
      return value;
    }
  } catch {
    // Invalid JSON and valid JSON with the wrong shape share the error below.
  }
  throw new Error('The model did not return the expected response. Try asking a more specific question.');
}

/** Normalize a string field and limit how much of it we keep. */
export function field(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

/** Resolve a proposed citation against the files and line bounds in the request. */
function validateStep(value: unknown, sources: ReadonlyMap<string, SourceReference>): Step | undefined {
  if (!isObject(value)) {
    return;
  }

  const { source, startLine, endLine } = value;
  const file = typeof source === 'string' ? sources.get(source) : undefined;
  if (!file || typeof startLine !== 'number' || typeof endLine !== 'number') {
    return;
  }
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) ||
      startLine < 1 || endLine < startLine || endLine > file.lineCount || endLine - startLine > 49) {
    return;
  }

  // A valid line in the file may still be outside the excerpt sent to the model.
  const span = file.suppliedSpan;
  if (span && (startLine < span.startLine || endLine > span.endLine)) {
    return;
  }

  const symbol = field(value.symbol, 100);
  const role = field(value.role, 140);
  const explanation = field(value.explanation, 1000);
  if (!symbol || !role || !explanation) {
    return;
  }

  return {
    id: `${source}:${startLine}:${endLine}`,
    uri: file.uri,
    path: file.path,
    digest: file.digest,
    startLine,
    endLine,
    symbol,
    role,
    explanation,
    followups: [],
  };
}

/** Keep verified, distinct citations in the order the model proposed them. */
export function parseWalkthrough(text: string, sources: ReadonlyMap<string, SourceReference>) {
  const data = readResponse(text);
  const proposals: unknown[] = Array.isArray(data.steps) ? data.steps.slice(0, 12) : [];
  const accepted = new Map<string, Step>();
  for (const proposal of proposals) {
    const step = validateStep(proposal, sources);
    if (step && !accepted.has(step.id)) {
      accepted.set(step.id, step);
    }
  }

  if (accepted.size === 0) {
    throw new Error('The model did not find a valid code location in the included files. Try naming a function or asking a narrower question.');
  }
  return {
    overview: field(data.overview, 440),
    steps: [...accepted.values()],
    omitted: proposals.length - accepted.size,
  };
}

/** Find the smallest current citation that contains the cursor line. */
export function findStep(steps: Step[], uri: string, line: number, digest: string): Step | undefined {
  let best: Step | undefined;
  for (const step of steps) {
    if (step.uri !== uri || step.digest !== digest || line < step.startLine || line > step.endLine) {
      continue;
    }
    if (!best || step.endLine - step.startLine < best.endLine - best.startLine) {
      best = step;
    }
  }
  return best;
}
