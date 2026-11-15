/** An inclusive range of source lines, numbered from 1 as in the editor UI. */
export interface LineSpan {
  startLine: number;
  endLine: number;
}

export interface Followup {
  question: string;
  answer: string;
}

/** The metadata sent to a webview for one location in the walkthrough. */
export interface DisplayStep extends LineSpan {
  id: string;
  fileId: string;
  fileName: string;
  symbol: string;
  role: string;
  /** Symbol of the enclosing step when this step is one phase of a longer function. */
  parent?: string;
  explanation: string;
  followups: Followup[];
  stale?: boolean;
}

/** An explanation paired with the file and content snapshot it was written for. */
export interface Step extends Omit<DisplayStep, 'fileId' | 'fileName'> {
  path: string;
  uri: string;
  digest: string;
}

export interface Walkthrough {
  question: string;
  overview: string;
  steps: Step[];
}

/** The snapshot metadata needed to verify a citation from the model. */
export interface SourceReference {
  uri: string;
  path: string;
  digest: string;
  lineCount: number;
  suppliedSpan?: LineSpan;
}
