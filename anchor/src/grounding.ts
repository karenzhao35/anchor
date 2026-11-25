import { createHash } from 'node:crypto';
import { type FileOutline, snapRange } from './snap';
import type { SourceReference, Stage, Step } from './walkthrough';

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
function validateStep(value: unknown, sources: ReadonlyMap<string, SourceReference>, stage?: number, outline?: FileOutline): Step | undefined {
  if (!isObject(value)) {
    return;
  }

  const { source } = value;
  const file = typeof source === 'string' ? sources.get(source) : undefined;
  if (!file || typeof value.startLine !== 'number' || typeof value.endLine !== 'number') {
    return;
  }
  let startLine = value.startLine;
  let endLine = value.endLine;
  const symbol = field(value.symbol, 100);
  const parent = field(value.parent, 100);
  // Models name the right definition far more reliably than they count its lines, so correct the
  // range from the file's real structure, keeping it inside the excerpt the model was shown.
  if (outline && Number.isInteger(startLine) && Number.isInteger(endLine) && startLine >= 1 && endLine >= startLine) {
    const snapped = snapRange({ startLine, endLine, symbol, parent }, outline);
    const span = file.suppliedSpan ?? { startLine: 1, endLine: file.lineCount };
    const low = Math.max(snapped.startLine, span.startLine);
    const high = Math.min(snapped.endLine, span.endLine);
    const changed = snapped.startLine !== startLine || snapped.endLine !== endLine;
    if (changed && low <= high) {
      [startLine, endLine] = [low, high];
    }
  }
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) ||
      startLine < 1 || endLine < startLine || endLine > file.lineCount || endLine - startLine > 299) {
    return;
  }

  // A valid line in the file may still be outside the excerpt sent to the model.
  const span = file.suppliedSpan;
  if (span && (startLine < span.startLine || endLine > span.endLine)) {
    return;
  }

  const role = field(value.role, 140);
  const explanation = field(value.explanation, 4000);
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
    ...(parent && { parent }),
    ...(stage !== undefined && { stage }),
    explanation,
    followups: [],
  };
}

/**
 * Keep verified, distinct citations in the order the model proposed them. Steps arrive nested
 * under "stages"; a flat top-level "steps" array is also accepted. Stages left without a verified
 * step are dropped.
 */
export function parseWalkthrough(text: string, sources: ReadonlyMap<string, SourceReference>, outlines?: ReadonlyMap<string, FileOutline>) {
  const data = readResponse(text);
  const proposed: Stage[] = [];
  const proposals: { value: unknown; stage?: number }[] = [];
  for (const value of Array.isArray(data.stages) ? data.stages.slice(0, 8) : []) {
    const title = isObject(value) ? field(value.title, 120) : '';
    if (!isObject(value) || !title || !Array.isArray(value.steps)) {
      continue;
    }
    const stage = proposed.push({ title, summary: field(value.summary, 600) }) - 1;
    proposals.push(...value.steps.map((step: unknown) => ({ value: step, stage })));
  }
  if (Array.isArray(data.steps)) {
    proposals.push(...data.steps.map((step: unknown) => ({ value: step })));
  }

  const accepted = new Map<string, Step>();
  for (const { value, stage } of proposals.slice(0, 40)) {
    const source = isObject(value) && typeof value.source === 'string' ? value.source : '';
    const step = validateStep(value, sources, stage, outlines?.get(source));
    if (step && !accepted.has(step.id)) {
      accepted.set(step.id, step);
    }
  }
  if (accepted.size === 0) {
    throw new Error('The model did not find a valid code location in the included files. Try naming a function or asking a narrower question.');
  }

  // Renumber stages so only those with verified steps remain.
  const steps = [...accepted.values()];
  const stages: Stage[] = [];
  const renumber = new Map<number, number>();
  for (const step of steps) {
    if (step.stage === undefined) {
      continue;
    }
    if (!renumber.has(step.stage)) {
      renumber.set(step.stage, stages.push(proposed[step.stage]) - 1);
    }
    step.stage = renumber.get(step.stage);
  }
  // Keep each stage's steps together even if the model listed a stage's steps out of order.
  steps.sort((a, b) => (a.stage ?? Infinity) - (b.stage ?? Infinity));

  return {
    answer: field(data.answer, 4000) || field(data.overview, 2500),
    stages,
    steps,
    omitted: Math.min(proposals.length, 40) - accepted.size,
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
