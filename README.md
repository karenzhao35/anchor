# Explorer for VS Code

Explorer connects questions about program behavior to the code that implements it. The Code Explorer sidebar groups source locations by file. The editor highlights the selected range, and the Code Explanation panel describes why it matters.

## Try the offline demo

1. Open this folder in desktop VS Code. Run `npm ci` if the development dependencies aren't installed, then press **F5**.
2. In the Extension Development Host window, open the Command Palette and run **Explorer: Open Demo**. It opens the bundled `server.c` and `clock.c` as real tabs and selects the server’s RESET handler. The question, explanations, and demo follow-up are built in, so no model or C compiler is needed.
3. Choose **resetTime()** under **clock.c**, then click **What happens if the timer is already stopped?** in the Explanation panel.
4. Move the cursor between `setTime()` and `resetTime()` in the editor. The panel follows the cursor and keeps the follow-up with `resetTime()`.

Open **Code Explorer** from its speech-bubble icon in the Activity Bar. If you moved Question Outline, right-click its title and choose **Reset Location**. If the explanation panel appears beside the editor, use **View → Appearance → Panel Position → Bottom**.

## Ask about your own code

In the Extension Development Host, open your project folder with **File → Open Folder**, then run **Explorer: Ask Question**. Enter a question about behavior. Explorer searches filenames and source text in that workspace, including files that have never been opened, and ranks matches using words from the question. It sends the question and up to eight excerpts to GitHub Copilot through VS Code's Language Model API. The first verified citation opens automatically. The outline and explanation show filenames, and each click opens the correct file even if two folders contain the same filename.

Search covers common code formats and skips hidden files, dependencies, generated directories, and oversized files. It works best when the question shares words with the project. Follow-ups use the selected range and its recent exchanges. Live questions require a trusted workspace and an available Copilot model.

Explorer verifies that proposed ranges were included in the excerpts sent to the model. If a referenced file changes, the citation becomes stale and you can ask again to refresh it. Walkthroughs and follow-ups live in memory for the current session.

## Read the code

| File | What it does |
| --- | --- |
| `package.json` | Declares the commands, sidebar, panel, and highlight color to VS Code. |
| `src/extension.ts` | The entry point. Registers commands and routes VS Code events and webview messages to the controller. |
| `src/controller.ts` | Owns the current walkthrough and decides when to update the editor and views. |
| `src/editor.ts` | Checks the source snapshot, converts line numbers to editor ranges, and paints highlights and gutter markers. |
| `src/views.ts` | Loads the webviews and passes validated messages between the views and the extension. |
| `media/view.js`, `media/view.css` | Render and style the sidebar and explanation panel. |
| `src/demo.ts`, `demo/` | Supply the offline walkthrough, its scripted follow-up, and the C files it references. |
| `src/sourceSearch.ts` | Finds and ranks workspace files and extracts numbered source excerpts. |
| `src/model.ts` | Builds prompts from the excerpts and calls the VS Code language model. |
| `src/grounding.ts`, `src/walkthrough.ts` | Validate model citations and define the data passed between modules. |

For one complete path through the code, start at `renderFile()` in `media/view.js`. A step button sends a `jump` message. The host checks it in `views.ts`, dispatches it in `extension.ts`, and calls `controller.jump()`. The editor module reveals the source and the controller publishes the selected step back to both views.

Run `npm run compile` to build the extension and `npm run lint` to check the TypeScript. VS Code runs the generated JavaScript in `out/`.
