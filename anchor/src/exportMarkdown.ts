import type { Step, Walkthrough } from './walkthrough';

/** Prefix every line so multi-line Markdown (lists, code fences) stays inside one blockquote. */
function quote(text: string): string {
  return text.trim().split('\n').map(line => (line ? '> ' + line : '>')).join('\n');
}

function lineLabel(step: Step): string {
  return step.startLine === step.endLine ? `line ${step.startLine}` : `lines ${step.startLine}–${step.endLine}`;
}

/** Format one step with its explanation, followed by any follow-ups marked as quoted Q&A. */
function stepMarkdown(step: Step, number: number): string[] {
  const location = `\`${step.path}\` · ${lineLabel(step)}${step.parent ? ` · part of \`${step.parent}\`` : ''}`;
  const parts = [`### ${number}. \`${step.symbol}\` — ${step.role}`, location, step.explanation.trim()];
  if (step.followups.length) {
    parts.push(`**Follow-ups on \`${step.symbol}\`**`);
    for (const { question, answer } of step.followups) {
      parts.push(quote(`**Q:** ${question}\n\n**A:**\n\n${answer}`));
    }
  }
  return parts;
}

/** Render the whole walkthrough (answer, stages, step explanations and follow-ups) as Markdown. */
export function walkthroughMarkdown(walkthrough: Walkthrough): string {
  const parts = [`# ${walkthrough.question}`, walkthrough.answer.trim()];
  let number = 1;
  let currentStage: number | undefined | null = null;
  for (const step of walkthrough.steps) {
    if (step.stage !== currentStage) {
      currentStage = step.stage;
      const stage = step.stage === undefined ? undefined : walkthrough.stages[step.stage];
      if (stage) {
        parts.push(`## ${step.stage! + 1}. ${stage.title}`);
        if (stage.summary) {
          parts.push(stage.summary.trim());
        }
      } else if (number === 1) {
        parts.push('## Code walkthrough');
      }
    }
    parts.push(...stepMarkdown(step, number++));
  }
  return parts.filter(Boolean).join('\n\n') + '\n';
}
