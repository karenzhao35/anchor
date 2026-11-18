import * as assert from 'node:assert/strict';
import { formatUsage } from '../callSites';

suite('Call-site usage', () => {
  test('lists callers from other files with file IDs and enclosing definitions', () => {
    const text = formatUsage([
      { name: 'Downloader.finish', startLine: 262, endLine: 275, callers: [{ path: 'httpie/core.py', line: 255, source: 'F3', caller: 'program' }] },
      { name: 'DownloadStatus.started', startLine: 318, endLine: 323, callers: [{ path: 'httpie/downloads.py', line: 250, caller: 'Downloader.start' }] },
      { name: 'unused', startLine: 1, endLine: 2, callers: [] },
    ]);
    assert.equal(text, [
      'Downloader.finish  L262–275  called from httpie/core.py:L255 [F3] in program',
      'DownloadStatus.started  L318–323  called from httpie/downloads.py:L250 in Downloader.start',
      'unused  L1–2  no callers found',
    ].join('\n'));
  });

  test('caps the callers shown and counts the rest', () => {
    const callers = [1, 2, 3, 4, 5].map(line => ({ path: 'a.py', line }));
    const text = formatUsage([{ name: 'f', startLine: 10, endLine: 12, callers }]);
    assert.equal(text, 'f  L10–12  called from a.py:L1; a.py:L2; a.py:L3 (+2 more)');
  });
});
