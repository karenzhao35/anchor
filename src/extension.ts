import * as vscode from 'vscode';
import { WalkthroughController } from './controller';
import { currentModel, listModels, onDidChangeUsableModels, setPreferredModel } from './model';
import { VIEW_IDS, type ViewAction } from './views';

/** Connect VS Code's commands, view providers, and editor events to the walkthrough. */
export function activate(context: vscode.ExtensionContext): void {
  const controller = new WalkthroughController(context.extensionUri);
  const modelKey = 'anchor.model';
  setPreferredModel(context.globalState.get<string>(modelKey));
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  status.command = 'anchor.selectModel';
  status.tooltip = 'Choose the model Anchor uses (Copilot or your own key)';
  const showModel = async () => {
    const name = (await currentModel())?.name ?? 'no model';
    controller.setModel(name);
    status.text = '$(sparkle) Anchor: ' + name;
    status.show();
  };
  void showModel();
  const dispatch = (action: ViewAction) => handleViewAction(controller, action);

  context.subscriptions.push(
    controller,
    status,
    vscode.lm.onDidChangeChatModels(() => void showModel()),
    onDidChangeUsableModels(() => void showModel()),
    vscode.commands.registerCommand('anchor.selectModel', () => controller.safely(async () => {
      const models = await listModels();
      if (!models.length) {
        throw new Error('No language models are available. Sign in to Copilot or add a model under Manage Models.');
      }
      const active = (await currentModel())?.id;
      const picked = await vscode.window.showQuickPick(models.map(model => ({
        label: model.name,
        description: model.id === active ? `current · ${model.vendor}` : `${model.vendor} · ${model.family}`,
        detail: `${model.id} · up to ${model.maxInputTokens.toLocaleString()} input tokens`,
        id: model.id,
      })), { title: 'Anchor: Select Model', placeHolder: 'Choose the model for questions and follow-ups' });
      if (picked) {
        setPreferredModel(picked.id);
        await context.globalState.update(modelKey, picked.id);
        await showModel();
      }
    })),
    vscode.commands.registerCommand('anchor.ask', () => controller.safely(() => controller.ask())),
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
    case 'model':
      void vscode.commands.executeCommand('anchor.selectModel');
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
