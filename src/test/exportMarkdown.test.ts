import * as assert from 'node:assert/strict';
import { walkthroughMarkdown } from '../exportMarkdown';
import type { Step } from '../walkthrough';

function step(overrides: Partial<Step>): Step {
  return {
    id: 'a', symbol: 'load', role: 'reads config', stage: 0, startLine: 1, endLine: 4,
    explanation: 'Reads the file.', followups: [], path: 'src/config.ts', uri: 'file:///src/config.ts', digest: 'x',
    ...overrides,
  };
}

suite('Markdown export', () => {
  test('includes answer, stages, explanations and quoted follow-ups', () => {
    const markdown = walkthroughMarkdown({
      question: 'How is config loaded?',
      answer: 'It is read at startup.',
      stages: [{ title: 'Read', summary: 'Load from disk.' }, { title: 'Use', summary: '' }],
      steps: [
        step({ followups: [{ question: 'What if missing?', answer: 'Defaults apply.\n\n```text\nA -> B\n```' }] }),
        step({ id: 'b', symbol: 'apply', stage: 1, startLine: 9, endLine: 9, parent: 'main' }),
      ],
    });
    assert.match(markdown, /^# How is config loaded\?\n\nIt is read at startup\./);
    assert.match(markdown, /## 1\. Read\n\nLoad from disk\./);
    assert.match(markdown, /### 1\. `load` — reads config\n\n`src\/config\.ts` · lines 1–4\n\nReads the file\./);
    assert.match(markdown, /\*\*Follow-ups on `load`\*\*\n\n> \*\*Q:\*\* What if missing\?\n>\n> \*\*A:\*\*\n>\n> Defaults apply\.\n>\n> ```text\n> A -> B\n> ```/);
    assert.match(markdown, /## 2\. Use\n\n### 2\. `apply` — reads config\n\n`src\/config\.ts` · line 9 · part of `main`/);
  });
});
