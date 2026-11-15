/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();
const content = document.querySelector('#content');
const actions = document.querySelector('#actions');
const kind = document.body.dataset.kind;
const foldedFiles = new Set();
const followupDrafts = new Map();
let previousState = '';
let previousQuestion;

/** Create a DOM element and insert its label as text, including model output. */
function element(tag, label = '', className = '') {
  const node = document.createElement(tag);
  if (label) {
    node.textContent = label;
  }
  if (className) {
    node.className = className;
  }
  return node;
}

/** Add inline `code` and **bold** from model text as DOM nodes, never as HTML. */
function appendInline(parent, text) {
  for (const part of text.split(/(`[^`]+`|\*\*[^*]+\*\*)/)) {
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      parent.append(element('code', part.slice(1, -1)));
    } else if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      parent.append(element('strong', part.slice(2, -2)));
    } else if (part) {
      parent.append(part);
    }
  }
}

/** Render a small Markdown subset (paragraphs, lists, headings, code blocks) into safe DOM nodes. */
function renderMarkdown(text, className = '') {
  const root = element('div', '', ('markdown ' + className).trim());
  let paragraph = [];
  let list;
  let code;
  const flush = () => {
    if (paragraph.length) {
      const p = element('p');
      appendInline(p, paragraph.join(' '));
      root.append(p);
      paragraph = [];
    }
  };
  for (const line of text.split('\n')) {
    if (code) {
      if (/^\s*```/.test(line)) {
        root.append(code.node);
        code = undefined;
      } else {
        code.lines.push(line);
        code.node.firstChild.textContent = code.lines.join('\n');
      }
      continue;
    }
    const item = /^\s*(?:(\d+)[.)]|[-*•])\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (/^\s*```/.test(line)) {
      flush();
      list = undefined;
      code = { lines: [], node: element('pre') };
      code.node.append(element('code'));
    } else if (item) {
      flush();
      const tag = item[1] ? 'ol' : 'ul';
      if (!list || list.tagName.toLowerCase() !== tag) {
        list = element(tag);
        root.append(list);
      }
      const li = element('li');
      appendInline(li, item[2]);
      list.append(li);
    } else if (heading) {
      flush();
      list = undefined;
      root.append(element('h3', heading[1]));
    } else if (!line.trim()) {
      flush();
      list = undefined;
    } else if (list && /^\s+/.test(line)) {
      appendInline(list.lastChild, ' ' + line.trim());
    } else {
      list = undefined;
      paragraph.push(line.trim());
    }
  }
  if (code) {
    root.append(code.node);
  }
  flush();
  return root;
}

/** Create a button that sends a message to the extension host when clicked. */
function actionButton(label, message, className, disabled = false) {
  const button = element('button', label, className);
  button.type = 'button';
  button.disabled = disabled;
  button.addEventListener('click', () => vscode.postMessage(message));
  return button;
}

/** Group steps by source file, preserving their walkthrough order. */
function groupByFile(steps) {
  const groups = new Map();
  for (const step of steps) {
    if (!groups.has(step.fileId)) {
      groups.set(step.fileId, []);
    }
    groups.get(step.fileId).push(step);
  }
  return groups;
}

/** Render a collapsible file section with buttons that jump to its source. */
function renderFile(fileId, steps, activeId, busy) {
  const group = element('details', '', 'file');
  group.open = !foldedFiles.has(fileId) || steps.some(step => step.id === activeId);
  group.append(element('summary', steps[0].fileName));
  group.addEventListener('toggle', () => {
    if (group.open) {
      foldedFiles.delete(fileId);
    } else {
      foldedFiles.add(fileId);
    }
  });

  for (const step of steps) {
    const button = actionButton('', { type: 'jump', id: step.id }, 'step', step.stale || busy);
    button.dataset.step = step.id;
    if (step.parent) {
      button.classList.add('substep');
    }
    if (step.id === activeId) {
      button.setAttribute('aria-current', 'location');
    }
    button.append(
      element('strong', step.symbol),
      element('span', step.stale ? 'Source changed · ask again' : step.role, 'role'),
    );
    group.append(button);
  }
  return group;
}

/** Render the question and source list, or the welcome text before the first question. */
function renderOutline(state) {
  const busy = Boolean(state.busy);
  if (!state.question) {
    content.append(
      element('p', 'Start with a question about how your code works.', 'lede'),
      element('p', 'Anchor links each part of the answer to the source that implements it.', 'muted'),
    );
  } else {
    const header = element('header');
    header.append(
      element('div', 'CURRENT QUESTION', 'eyebrow'),
      element('h1', state.question),
      renderMarkdown(state.overview, 'lede'),
    );
    content.append(header);
    for (const [fileId, steps] of groupByFile(state.steps)) {
      content.append(renderFile(fileId, steps, state.activeId, busy));
    }
  }

  actions.append(actionButton('+  Ask Question', { type: 'ask' }, 'primary', busy));
  actions.append(actionButton('Model: ' + (state.model || 'none') + ' (change)', { type: 'model' }, 'secondary', busy));
}

/** Keep an unfinished live follow-up attached to its step across view updates. */
function renderFollowupForm(step, busy) {
  const form = element('form');
  const label = element('label', 'Ask more about this', 'eyebrow');
  label.htmlFor = 'followup-question';

  const row = element('div', '', 'input-row');
  const input = element('input');
  input.id = label.htmlFor;
  input.type = 'text';
  input.placeholder = 'What happens if…';
  input.maxLength = 600;
  input.required = true;
  input.value = followupDrafts.get(step.id) ?? '';
  if (step.followups.at(-1)?.question === input.value.trim()) {
    followupDrafts.delete(step.id);
    input.value = '';
  }
  input.addEventListener('input', () => followupDrafts.set(step.id, input.value));

  const send = element('button', 'Ask', 'primary');
  send.disabled = busy;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const question = input.value.trim();
    if (question && !busy) {
      vscode.postMessage({ type: 'followup', id: step.id, question });
    }
  });

  row.append(input, send);
  form.append(label, row);
  return form;
}

/** Render the active explanation and its follow-ups in the bottom panel. */
function renderExplanation(state) {
  const step = state.steps.find(item => item.id === state.activeId && !item.stale);
  const busy = Boolean(state.busy);
  if (!step) {
    const hint = state.question
      ? 'Choose a function in Anchor or move the cursor to a marked region in the editor.'
      : 'Ask a question to see explanations alongside the actual source.';
    content.append(element('h1', 'Explanation'), element('p', hint, 'lede'));
    return;
  }

  const lines = step.startLine === step.endLine
    ? `line ${step.startLine}`
    : `lines ${step.startLine}–${step.endLine}`;
  content.append(
    element('div', `${step.fileName} · ${lines}${step.parent ? ' · part of ' + step.parent : ''}`, 'location'),
    element('h1', step.symbol),
    renderMarkdown(step.explanation, 'explanation'),
  );
  for (const { question, answer } of step.followups) {
    const entry = element('section', '', 'followup');
    entry.append(element('h2', question), renderMarkdown(answer));
    content.append(entry);
  }

  actions.append(renderFollowupForm(step, busy));
}

/** Restore focus and the input selection after the view replaces its DOM nodes. */
function restoreFocus(previous) {
  if (previous?.id) {
    const replacement = document.getElementById(previous.id);
    replacement?.focus({ preventScroll: true });
    if (previous instanceof HTMLInputElement && replacement instanceof HTMLInputElement) {
      replacement.setSelectionRange(previous.selectionStart, previous.selectionEnd);
    }
  } else if (previous?.dataset.step) {
    const buttons = [...content.querySelectorAll('button[data-step]')];
    const replacement = buttons.find(button => button.dataset.step === previous.dataset.step);
    replacement?.focus({ preventScroll: true });
  }
}

/** Repaint changed state from the host while preserving local scroll and focus. */
function receiveState({ data: state }) {
  if (state?.type !== 'state') {
    return;
  }
  const fingerprint = JSON.stringify(state);
  if (fingerprint === previousState) {
    return;
  }
  previousState = fingerprint;
  if (state.question !== previousQuestion) {
    followupDrafts.clear();
    foldedFiles.clear();
    previousQuestion = state.question;
  }

  const focused = document.activeElement;
  const scrollTop = content.scrollTop;
  content.replaceChildren();
  actions.replaceChildren();
  if (kind === 'outline') {
    renderOutline(state);
  } else {
    renderExplanation(state);
  }

  const message = state.busy || state.notice;
  if (message) {
    const status = element('p', message, 'status');
    status.setAttribute('role', 'status');
    actions.prepend(status);
  }
  content.scrollTop = scrollTop;
  restoreFocus(focused);
}

window.addEventListener('message', receiveState);
vscode.postMessage({ type: 'ready' });
