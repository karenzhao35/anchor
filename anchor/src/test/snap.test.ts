import * as assert from 'node:assert/strict';
import { snapRange, type FileOutline } from '../snap';

const python = [
  'class Downloader:',              // 1
  '    @staticmethod',              // 2
  '    def start(',                 // 3
  '        self,',                  // 4
  '    ) -> int:',                  // 5
  '        """Docstring."""',       // 6
  '        x = 1',                  // 7
  '',                               // 8
  '        return x',               // 9
  '',                               // 10
  '    def next_method(self):',     // 11
  '        result = start(1)',      // 12
  '        return result',          // 13
];
const c = [
  'static int reset(int n)',        // 1
  '{',                              // 2
  '    clear(n);',                  // 3
  '    return 0;',                  // 4
  '}',                              // 5
  '',                               // 6
  'int main(void) { return reset(1); }', // 7
];
const text = (lines: string[]): FileOutline => ({ lines, symbols: [] });

suite('Range snapping', () => {
  test('snaps a whole-function citation that starts after the signature, including decorators', () => {
    assert.deepEqual(snapRange({ startLine: 6, endLine: 9, symbol: 'Downloader.start' }, text(python)), { startLine: 2, endLine: 9 });
  });

  test('trims a citation that runs into the next method', () => {
    assert.deepEqual(snapRange({ startLine: 3, endLine: 12, symbol: 'start' }, text(python)), { startLine: 2, endLine: 9 });
  });

  test('keeps a partial citation but clamps it inside its parent', () => {
    assert.deepEqual(snapRange({ startLine: 7, endLine: 12, symbol: 'start', parent: 'Downloader.start' }, text(python)),
      { startLine: 7, endLine: 9 });
  });

  test('finds C definitions with the brace on its own line and ignores calls', () => {
    assert.deepEqual(snapRange({ startLine: 3, endLine: 4, symbol: 'reset()' }, text(c)), { startLine: 1, endLine: 5 });
  });

  test('prefers language-server ranges and leaves unknown symbols alone', () => {
    const outline = { lines: c, symbols: [{ name: 'reset(int)', startLine: 1, endLine: 5 }] };
    assert.deepEqual(snapRange({ startLine: 2, endLine: 7, symbol: 'reset' }, outline), { startLine: 1, endLine: 5 });
    assert.deepEqual(snapRange({ startLine: 3, endLine: 4, symbol: 'missing' }, outline), { startLine: 3, endLine: 4 });
  });
});
