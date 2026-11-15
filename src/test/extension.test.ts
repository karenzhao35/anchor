import * as assert from 'node:assert/strict';
import { findStep, hash, parseWalkthrough } from '../grounding';

const digest = hash('contents from the original snapshot');
const uri = 'file:///project/clock.c';
const sources = new Map([['F1', { uri, path: 'clock.c', lineCount: 15, digest }]]);
const reference = {
  source: 'F1',
  startLine: 11,
  endLine: 15,
  symbol: 'resetTime()',
  role: 'Clears timer',
  explanation: 'Sets remaining seconds to zero.',
};

suite('Walkthrough grounding', () => {
  test('keeps verified citations and discards invalid or duplicate ones', () => {
    const invalid = [
      { ...reference, source: '../../secrets' },
      { ...reference, source: 'F2' },
      { ...reference, startLine: 0 },
      { ...reference, startLine: 12.5 },
      { ...reference, endLine: 16 },
      { ...reference, endLine: 10 },
    ];
    const response = { overview: 'Timer reset', steps: [...invalid, reference, reference] };
    const fenced = '\x60\x60\x60json\n' + JSON.stringify(response) + '\n\x60\x60\x60';
    const result = parseWalkthrough(fenced, sources);

    assert.equal(result.omitted, 7);
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0].uri, uri);
    assert.throws(() => parseWalkthrough(JSON.stringify({ steps: invalid }), sources), /valid code location/);
  });

  test('rejects citations outside the excerpt even when the lines exist in the file', () => {
    const excerpt = new Map([['F1', { uri, path: 'clock.c', lineCount: 15, digest,
      suppliedSpan: { startLine: 11, endLine: 14 } }]]);
    const included = { ...reference, endLine: 14 };
    const result = parseWalkthrough(JSON.stringify({ steps: [reference, included] }), excerpt);
    assert.equal(result.omitted, 1);
    assert.equal(result.steps[0].endLine, 14);
  });

  test('chooses the tightest current range under the cursor', () => {
    const guard = { ...reference, startLine: 12, endLine: 12, symbol: 'Guard' };
    const { steps } = parseWalkthrough(JSON.stringify({ steps: [reference, guard] }), sources);
    const [outer, inner] = steps;

    assert.equal(findStep(steps, uri, 12, digest), inner);
    assert.equal(findStep(steps, uri, 15, digest), outer);
    assert.equal(findStep(steps, uri, 10, digest), undefined);
    assert.equal(findStep(steps, uri, 12, hash('edited contents')), undefined);
    assert.equal(findStep(steps, 'file:///project/server.c', 12, digest), undefined);
  });
});
