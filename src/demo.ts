import * as vscode from 'vscode';
import { documentDigest } from './editor';
import type { Followup, Step, Walkthrough } from './walkthrough';

export const DEMO_FOLLOWUP = 'What happens if the timer is already stopped?';

const demoLocations = [
  {
    file: 'server.c',
    symbol: 'handleCommand()',
    startLine: 7,
    endLine: 12,
    role: 'Routes RESET and chooses the reply',
    explanation: 'The RESET branch calls resetTime(). Its return value selects the reply: a state change produces RESET OK, and an already stopped clock produces ALREADY STOPPED.',
  },
  {
    file: 'clock.c',
    symbol: 'setTime()',
    startLine: 6,
    endLine: 10,
    role: 'Starts the clock with a duration',
    explanation: 'A nonnegative duration replaces the stored value. The demo starts at 30 seconds, so the first RESET has a running timer to clear.',
  },
  {
    file: 'clock.c',
    symbol: 'resetTime()',
    startLine: 13,
    endLine: 17,
    role: 'Clears the timer if it is running',
    explanation: 'The stored duration is the state that matters. A nonzero value is set to zero, and the return value lets the caller tell whether this command changed anything.',
  },
];

/** Build the offline walkthrough using the actual bundled source documents. */
export async function loadDemo(extensionUri: vscode.Uri): Promise<Walkthrough> {
  const steps: Step[] = [];
  for (const { file, ...location } of demoLocations) {
    const uri = vscode.Uri.joinPath(extensionUri, 'demo', file);
    const document = await vscode.workspace.openTextDocument(uri);
    const functionName = location.symbol.slice(0, -2);
    if (document.lineCount < location.endLine || !document.lineAt(location.startLine - 1).text.includes(functionName)) {
      throw new Error('The bundled demo source has changed. Restore the example to replay the prepared walkthrough.');
    }
    steps.push({
      ...location,
      id: location.symbol,
      path: file,
      uri: uri.toString(),
      digest: documentDigest(document),
      followups: [],
    });
  }
  return {
    question: 'How does the server reset the clock?',
    overview: 'Follow the RESET command from the server to the clock state.',
    demo: true,
    steps,
  };
}

/** Open both cited demo files as persistent tabs in the current editor group. */
export async function openDemoTabs(demo: Walkthrough): Promise<void> {
  const files = new Set(demo.steps.map(step => step.uri));
  for (const uri of files) {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
    await vscode.window.showTextDocument(document, { preview: false });
  }
}

/** Return the scripted follow-up once, for the reset function in the offline demo. */
export function getDemoFollowup(step: Step, question: string): Followup | undefined {
  if (step.id !== 'resetTime()' || question !== DEMO_FOLLOWUP || step.followups.length > 0) {
    return;
  }
  return {
    question,
    answer: 'resetTime() returns 0 immediately and leaves the clock unchanged. In server.c that return value selects ALREADY STOPPED.',
  };
}
