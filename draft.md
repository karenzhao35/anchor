# Code-Centered LLM Assistance: Bridging Interfaces and Source Code for Enhanced Comprehension 

## Introduction
LLMs are increasingly used by software developers to understand unfamiliar codebases. However, conventional LLM interfaces primarily present explanations through a separate textual conversation. Developers must continually map those explanations back onto concrete code in order to verify and extend code. This may encourage developers to understand the description of a system without developing an equally strong understanding of where and how that behaviour is implemented. 

If understanding remains dependent on the LLM 
conversation, developers may have difficulty independently maintaining, debugging, or reviewing the software afterward. 

## Related work 
- Anthropic study had junior engineers complete a coding task with or without AI. Afterwards they completed a comprehension quiz about what they just did. Crucially, they found that low-scoring participants offloaded coding and debugging to AI wholly, without taking the time to understand the work. High-scoring participants asked follow up questions about the generated code 
https://www.anthropic.com/research/AI-assistance-coding-skills

- Information Needs in Collocated Software Development Teams https://ieeexplore.ieee.org/document/4222596
- Use Ko's work to establish proxies for "understanding"
  - u1: Code localization 
  - u2: Code justification

## Methods

### Study design
We run a small, exploratory within-subject study (N = 4–5) comparing code understanding after using (A) a conventional chat-based LLM and (B) our code-centered VS Code extension, Explorer. Every participant uses both tools, so each serves as their own control. With this sample size we make no inferential claims: ==we report per-participant paired differences and pair them with think-aloud and interview data.==

### Materials
- **Codebase.** [httpie](https://github.com/httpie/cli), a small (~8–10k LOC) Python command-line HTTP client, pinned to a specific commit.
	- Even though httpie is popular, it is okay for this study for LLM to have known it from training. 
- **Two flows.** Two comparable but separate flows, so participants never re-study the same code. Both start in CLI argument parsing (`cli/argparser`) and run through the main program in `core.py`, which keeps depth and file count similar, but they share no logic, so studying one does not help with the other. Flow A ends by writing the final response body to disk; Flow B ends in request construction in `client.py`. Comparability is checked on size, number of files touched, and call depth.
  - **Flow A, downloader:** `cli/argparser` (`--download`, `--output`, `--continue` validation), `core.py` (`program()` creates the `Downloader`, forces `--follow`, starts the download only after a successful final response, reports incomplete downloads), `downloads.py` (`Downloader`, filename choice, `Range`/resume handling, `DownloadStatus` progress), `output/streams.py` (`RawStream`).
  - **Flow B, sessions:** `cli/argparser` (`--session`, `--session-read-only`), `client.py` (`collect_messages` loads the session, merges headers, cookies and auth), `sessions.py` (`get_httpie_session`, `Session.update_headers`, cookie handling, saving).
- **Ground truth.** Answer keys come from the code and git history: for bug-fix commits we check out the parent commit, and the fix diff serves as the answer to "which code caused this behaviour". Where history is insufficient we inject bugs.
- **Study prompts** (identical wording in both tool conditions):
  - Flow A: How does httpie's Downloader functionality work?
  - Flow B: How does httpie's session functionality work?
- **Draft test questions** (two per measure per flow, one easy and one hard; the same slot has the same difficulty in both flows; to be checked against the code, with answer keys and rubric written before data collection):

Question design intent:
- For each ux, we want one hard question and one easy one. We want the questions to be worded in a semantic manner so that it is not just solved with a keyword search 
Tools available when answering
- Can cmd+f within the file, but you cannot use vscode search or grep. You may reference the code 

|                         | Flow A (downloader)                                                                                                                                                                                                                                  | Flow B (sessions)                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| u1 (easy: one file)     | (a) You download a file without naming where to save it, and httpie saves it as report-2026.pdf, a name that isn’t in the URL you typed. Which part of httpie picks that name, and what information does it use?                                     | (a) You run a request with --session=dev and pass two headers on the command line: Content-Type: application/json and X-Team: core. On your next request with --session=dev, X-Team is sent again automatically but Content-Type is not. Which part of the code decides what the session keeps, and what rule does it use? |
| u1 (hard: spans files)  | (b) The connection drops halfway through a large download, and httpie exits with an error saying the download was incomplete. Which part(s) of the code notice this, and what do they compare to decide it?                                          | (b) A cookie saved in your session has an expiry date that has now passed. Next time you use the session, it isn’t sent. Where is it dropped, and what does the code compare?                                                                                                                                              |
| u2 (hard: ordering)     | (a) httpie refuses to resume an interrupted download unless you name the output file yourself. What does the code need to know in order to resume, and at what point does it need it? Use that to explain why a name httpie picks itself won’t work. | (a) Your session stores X-Token: old. You pass X-Token: new on the command line. new is sent, and afterwards the session contains new. Explain what the code does, in order, that produces both results.                                                                                                                   |
| u2 (easy: one decision) | (b) In download mode, httpie follows redirects even if you didn’t ask it to. What would end up on disk if it didn’t, and where in the program does it switch redirect-following on?                                                                  | (b) You saved a login in a session called work while calling api.example.com. When you use --session=work against other.example.com, the login isn’t there. How does httpie keep the two apart, and what problem does that design prevent?                                                                                 |

  Questions describe behaviour a user would see, not identifiers or flag names, so they cannot be answered by grepping for a term from the question. Participants have to know which part of the flow is responsible.

  Draft answer keys for Flow A (checked against httpie `master`; re-check at the pinned commit):
  - **u1a (when the name is chosen):** once the final response's headers have arrived and before any body is written, when the downloader starts (`Downloader.start` → `_get_output_file_from_response`, `downloads.py`). It uses the filename the server suggests in the `Content-Disposition` header first; if there is none, the last part of the URL, with an extension guessed from `Content-Type`; then it adds `-1`, `-2`, … if a file with that name exists. Full marks (2): after the response arrives / at download start, plus server-suggested-name-before-URL. 1: only one of the two.
  - **u1b (incomplete download):** after the body has been written, `program()` in `core.py` checks whether the downloader was interrupted; if so it logs "Incomplete download" and returns an error exit status. `Downloader.interrupted` compares the bytes actually downloaded (counted per chunk by `DownloadStatus`) against the expected total size from `Content-Length`. Full marks: the end-of-program check in `core.py`/the downloader, plus the downloaded-vs-expected-size comparison. 1: only one of the two.
  - **u2a (resume needs a filename):** to resume, httpie has to ask the server for "the rest" of the file, which means knowing how many bytes are already on disk *before* sending the request (`pre_request` sets the `Range` header). Without a user-given name, the filename is chosen from the response, which does not exist yet. Enforced in `argparser._process_download_options`. Full marks: the before-the-request vs. after-the-response ordering. 1: "it needs to know which file to continue" without the ordering.
  - **u2b (forced redirects):** download links often redirect (e.g. `/latest` → the actual file). The downloader works only from the *final* response: it takes the filename and size from it and writes its body to disk. `program()` in `core.py` sets `--follow` whenever `--download` is given, and starts the download only after a successful final response. Without following, httpie would save the redirect response itself as the file. Full marks: the downloader needs the final response's body/headers, plus that the redirect itself would otherwise be saved. 1: "links redirect" without saying what would go wrong.
  - **Backup u2b (output goes to stderr),** used only if the pilot shows participants reach the argparser's output handling: so standard output can carry only the downloaded body. If stdout is redirected (`http -d URL > file.zip`), the argument parser uses stdout itself as the download target (`argparser`, download branch of output handling), and everything else is moved to stderr (`env.stdout = env.stderr`) so headers and progress never get mixed into the saved file. The body is also removed from the normal output options, because the downloader writes it through its own path. The code comment notes this swap also avoids scattering `if download` checks through the output code. Full marks: keeps the body stream clean when stdout is the file, plus the body being written separately by the downloader. 1: "so the output isn't mixed up" without saying stdout can be the download target.

  Draft answer keys for Flow B (checked against httpie `master` at `5b604c3`, Dec 2024; re-check at the pinned commit):
  - **u1a (headers left out):** when the request is set up, `collect_messages` in `client.py` passes the request's headers to `Session.update_headers` (via `_compute_new_headers`, `sessions.py`) before the request is sent. Headers starting with `Content-` or `If-` (`SESSION_IGNORED_HEADER_PREFIXES`) are dropped because they are specific to one request. So are httpie's default `User-Agent` (`HTTPie/…`) and explicitly unset headers. A `Cookie` header is moved into the session's cookie jar instead of being stored as a header. Full marks (2): the session's header-update step in `sessions.py` (or "when the session takes the request's headers"), plus the request-specific prefix rule (`Content-`/`If-`). 1: only one of the two.
  - **u1b (invalid cookies removed):** two places. (1) Main path: in `collect_messages` (`client.py`), every response's `Set-Cookie` header is checked with `get_expired_cookies` (`utils.py`), and these cookies are removed with `Session.remove_cookies` just before the session is saved, after all responses (including redirects). (2) Already-expired cookies are dropped when the session's cookies are read (`Session.cookies` → `clear_expired_cookies`). A cookie counts as expired when its `expires` time is at or before now; a `max-age` is first converted to an `expires` time (`_max_age_to_expires`), so `max-age=0` deletes the cookie. Full marks: removal at save time after the responses (or at load), plus the comparison of expiry time (`expires`/`max-age`) against the current time. 1: only one of the two. Note: with `--session-read-only` on an existing session nothing is saved, so removals are not kept.
  - **u2a (command line wins, then persists):** the order in the code. `make_request_kwargs` (`client.py`) builds the headers from httpie's defaults, then the session's stored headers on top, then the command-line headers on top of that (`headers.update(base_headers)` then `headers.update(args.headers)`), so the command line wins for this request. That merged set is then passed to `Session.update_headers`, where new values replace old ones under the same name, and the session is saved after the response. Full marks: session headers applied first with the command line on top, plus the merged headers being written back to the session. 1: only one of the two.
  - **u2b (sessions tied to a host):** a session given by name is stored per host, at `sessions/<host>/<name>.json` in the config directory (`get_httpie_session` → `session_hostname_to_dirname`, `sessions.py`; `host:port` becomes `host_port`). This keeps credentials and cookies saved for one site from being sent to another. A session given as a file path (it contains `/`) is "anonymous" and is not tied to a host. Full marks: per-host storage, plus the reason (not leaking credentials or cookies to other sites). 1: only one of the two. Bonus note, not required: the file-path form is the intended way to share one session across hosts.
- **Test medium.** The test phase runs in a form (Qualtrics, available through UBC) on a separate window or device, with the editor, repository, and LLM tool closed. Answers are typed free text, each followed by a 1–5 confidence rating, so they can be scored blind to condition. The form is identical across conditions apart from the flow's questions. Optional flow sketches are done on paper and photographed for scoring. The pre-questionnaire and post-condition surveys live in the same project, with hidden fields for participant ID, condition, and flow. Study phases are screen-recorded (Zoom or OBS, with audio for think-aloud).
A - https://ubc.ca1.qualtrics.com/jfe/form/SV_3IpXiFVlFrJ4PMG
B - https://ubc.ca1.qualtrics.com/jfe/form/SV_ahJZ9GeKVMuCMku

### Measures of understanding
We use the information needs identified by Ko et al. as proxies for understanding, assessed with two questions each per flow (four per flow):
- **u1, code localization:** where in the code is a given behaviour implemented?
- **u2, code justification:** why is the code written this way, and what does it depend on?

Answers are scored 0/1/2 against a rubric written before any data is collected. Participants also give a confidence rating (1–5) per answer. Optionally, they sketch the flow, scored against an answer key of nodes and edges.

### Procedure (learn-then-test)
Understanding is measured after, not during, tool use. Letting participants answer with tool access would measure the tool's answers rather than the participant's understanding, and would hit a ceiling effect. Each session (<1 hour) has:
1. **Briefing and warm-up (~10 min):** consent, pre-questionnaire (experience, prior LLM use), and practice with both tools on a toy file.
2. **Two conditions (~20 min each)**, each consisting of:
   - *Prompt (1 min):* a structured task such as "understand how authentication works". Participants are told they will be tested afterwards, but not on what, to discourage memorizing file names.
   - *Study phase (~10 min):* the participant explores the code with the assigned tool. The screen and tool interactions are recorded.
   - *Close (1 min):* tools and notes are removed.
   - *Test phase (~7 min):* u1–u2 questions (four per flow) answered with no tools, with confidence ratings.
- *Survey (~2 min):* confidence, short NASA-TLX, and tool experience.

### Counterbalancing
We use a 2×2 design crossing tool order (A→B, B→A) with flow assignment (flow 1 or 2 in the first condition), so tool, order, and flow are not confounded. The fifth participant, if recruited, duplicates the cell judged easiest to recruit for or most informative.

### Process data
Instead of time-to-answer, we derive process measures from the study-phase recordings: files opened, exploration order, and how often participants checked the code against LLM claims. These speak to whether participants verify explanations or accept them as stated.

### Hypotheses
Registered before data collection:
- **H1:** u1 (localization) scores favor the code-centered tool.
- **H2:** For u2 (justification), the chat LLM yields fluent but less verified justifications, visible in lower verification behaviour and a larger gap between confidence and accuracy.

### Analysis
We report per-participant paired differences (Explorer minus chat) for each question type, confidence–accuracy gaps, and survey gaps between stated preference and performance. Two raters score answers blind to condition, with a second scorer on a subset to check agreement. Interviews and think-aloud are coded thematically.

### Pilot
One pilot session with a classmate checks timing (trimming the study phase to 8 min if needed), question difficulty, and the logging sheet before data collection. We also run the test questions through a plain LLM with no code attached, to see how much it answers from memorized knowledge of httpie (Flow A is the greater risk); questions it answers well are revised.

#### People
- Tina: Wednesday
- Johnny: Wednesday
- Kevin: ?
- Minh Anh: Thursday
- Stephanie: Friday

## Results

## Discussion

## Limitations
Notes to expand: tiny sample; learning effect across conditions; prior LLM familiarity (pre-questionnaire); rubric-scoring bias; memory decay (mitigated by testing right after each study phase); the learn-then-test protocol measures retained understanding, not performance during tool use.

## Conclusion