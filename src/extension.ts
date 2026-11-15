import * as vscode from 'vscode';
import { WalkthroughController } from './controller';
import { VIEW_IDS, type ViewAction } from './views';

/** Connect VS Code's commands, view providers, and editor events to the walkthrough. */
export function activate(context: vscode.ExtensionContext): void {
  const controller = new WalkthroughController(context.extensionUri);
  const dispatch = (action: ViewAction) => handleViewAction(controller, action);

  context.subscriptions.push(
    controller,
    vscode.commands.registerCommand('explorer.demo', () => controller.safely(() => controller.openDemo())),
    vscode.commands.registerCommand('explorer.ask', () => controller.safely(() => controller.ask())),
    vscode.window.registerWebviewViewProvider(VIEW_IDS.outline, {
      resolveWebviewView: view => controller.views.attach('outline', view, dispatch),
    }),
    vscode.window.registerWebviewViewProvider(VIEW_IDS.explanation, {
      resolveWebviewView: view => controller.views.attach('explanation', view, dispatch),
    }),
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        controller.syncCursor(editor);
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => controller.refresh()),
    vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        controller.syncCursor(event.textEditor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument(event => controller.sourceChanged(event)),
  );
}

/** Translate a validated webview message into the corresponding controller action. */
function handleViewAction(controller: WalkthroughController, action: ViewAction): void {
  switch (action.type) {
    case 'ready':
      controller.refresh();
      break;
    case 'demo':
      void controller.safely(() => controller.openDemo());
      break;
    case 'ask':
      void controller.safely(() => controller.ask());
      break;
    case 'jump':
      void controller.safely(() => controller.jump(action.id));
      break;
    case 'followup':
      void controller.safely(() => controller.followup(action.id, action.question));
      break;
  }
}
