import { basename } from 'node:path/posix';
import * as vscode from 'vscode';
import { EditorDecorations, isStale, openCurrentSource, revealSource, stepAtCursor, updateStaleness } from './editor';
import { field } from './grounding';
import { answerFollowup, buildWalkthrough, QUESTION_LIMIT } from './model';
import { WalkthroughViews } from './views';
import type { DisplayStep, Step, Walkthrough } from './walkthrough';

/** Copy the information a webview needs, leaving file URIs and hashes in the host. */
function displayStep(step: Step, fileId: string): DisplayStep {
  return {
    id: step.id,
    fileId,
    fileName: basename(vscode.Uri.parse(step.uri).path),
    symbol: step.symbol,
    role: step.role,
    parent: step.parent,
    startLine: step.startLine,
    endLine: step.endLine,
    explanation: step.explanation,
    followups: step.followups,
    stale: isStale(step),
  };
}

/** Assign one opaque group ID per source, even when filenames are identical. */
function displaySteps(steps: Step[]): DisplayStep[] {
  const fileIds = new Map<string, string>();
  return steps.map(step => {
    const fileId = fileIds.get(step.uri) ?? step.id;
    fileIds.set(step.uri, fileId);
    return displayStep(step, fileId);
  });
}

/** Own the current walkthrough and coordinate changes across the editor and both views. */
export class WalkthroughController implements vscode.Disposable {
  readonly views: WalkthroughViews;
  private readonly decorations: EditorDecorations;
  private walkthrough?: Walkthrough;
  private activeId?: string;
  private busy = '';
  private notice = '';
  private modelName = '';
  private request?: vscode.CancellationTokenSource;
  private jumping = false;

  /** Set up the editor decorations and webview bridge for this window. */
  constructor(private readonly extensionUri: vscode.Uri) {
    this.views = new WalkthroughViews(extensionUri);
    this.decorations = new EditorDecorations(extensionUri);
  }

  /** Show the active model's name in the outline view. */
  setModel(name: string): void {
    this.modelName = name;
    this.refresh();
  }

  /** Cancel outstanding work and remove the editor decorations when the extension unloads. */
  dispose(): void {
    this.request?.cancel();
    this.decorations.dispose();
  }

  /** Send the current state to both views and repaint the real editor. */
  refresh(): void {
    const steps = this.walkthrough?.steps ?? [];
    this.views.publish({
      question: this.walkthrough?.question,
      overview: this.walkthrough?.overview,
      steps: displaySteps(steps),
      activeId: this.activeId,
      busy: this.busy,
      model: this.modelName,
      notice: this.notice,
    });
    this.decorations.update(steps, this.activeId);
  }

  /** Update the selected step when the user moves the cursor or changes editors. */
  syncCursor(editor = vscode.window.activeTextEditor): void {
    // A sidebar jump chooses its own step, which may overlap other citations.
    if (this.jumping) {
      return;
    }
    this.activeId = stepAtCursor(this.walkthrough?.steps ?? [], editor)?.id;
    this.refresh();
  }

  /** Recheck citations after actual edits to a document in the walkthrough. */
  sourceChanged(event: vscode.TextDocumentChangeEvent): void {
    if (!event.contentChanges.length || !this.walkthrough) {
      return;
    }
    if (updateStaleness(this.walkthrough.steps, event.document)) {
      this.syncCursor();
    }
  }

  /** Select a step from the outline and reveal its verified range in the real editor. */
  async jump(id: string): Promise<void> {
    const walkthrough = this.walkthrough;
    const step = walkthrough?.steps.find(candidate => candidate.id === id);
    if (!step || this.jumping || this.busy) {
      return;
    }

    this.jumping = true;
    try {
      await this.views.focus('explanation');
      const document = await openCurrentSource(step, 'This source file has changed. Ask the question again to refresh its explanation.');
      if (this.walkthrough !== walkthrough) {
        return;
      }
      await revealSource(document, step);
      this.activeId = id;
    } finally {
      this.jumping = false;
      if (this.walkthrough === walkthrough) {
        this.refresh();
      } else {
        this.syncCursor();
      }
    }
  }

  /** Prompt for a question, build a verified walkthrough, and open its first step. */
  async ask(): Promise<void> {
    if (this.busy || this.jumping) {
      return;
    }
    const value = await vscode.window.showInputBox({
      prompt: 'Ask how something in your code works',
      placeHolder: 'What happens when the sender times out?',
      validateInput: text => text.length > QUESTION_LIMIT ? `Keep the question under ${QUESTION_LIMIT} characters.` : undefined,
    });
    const question = field(value, QUESTION_LIMIT);
    if (!question) {
      return;
    }

    await this.run('Finding relevant code…', async request => {
      const { overview, steps, omitted } = await buildWalkthrough(question, vscode.window.activeTextEditor?.document.uri, request);
      this.walkthrough = { question, overview, steps };
      this.activeId = undefined;
      this.notice = omitted ? `${omitted} proposed step(s) were dropped because their line citations could not be verified.` : '';
    });
    const firstStep = this.walkthrough?.steps[0];
    if (firstStep) {
      await this.jump(firstStep.id);
    }
  }

  /** Add an answer to the selected code location using the live model. */
  async followup(id: string, value: string): Promise<void> {
    const question = field(value, QUESTION_LIMIT);
    const walkthrough = this.walkthrough;
    const step = walkthrough?.steps.find(candidate => candidate.id === id);
    if (!question || !walkthrough || !step || this.busy) {
      return;
    }
    if (step.followups.length >= 10) {
      throw new Error('This code location already has ten follow-ups. Start a fresh walkthrough to ask more.');
    }

    await this.run(`Answering about ${step.symbol}…`, async request => {
      step.followups.push(await answerFollowup(walkthrough, step, question, request));
    });
  }

  /** Report errors consistently for commands and messages from the webviews. */
  async safely(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.notice = error instanceof Error ? error.message : 'Anchor could not complete that action.';
      this.refresh();
      void vscode.window.showErrorMessage('Anchor: ' + this.notice);
    }
  }

  /** Show progress, provide a cancellation source, and clear both when work finishes. */
  private async run(label: string, action: (request: vscode.CancellationTokenSource) => Promise<void>): Promise<void> {
    const request = new vscode.CancellationTokenSource();
    this.request = request;
    this.busy = label;
    this.notice = '';
    this.refresh();

    try {
      await action(request);
    } finally {
      request.dispose();
      this.request = undefined;
      this.busy = '';
      this.refresh();
    }
  }
}
