# Anchor for VS Code

Anchor connects questions about program behavior to the code that implements it. The Anchor sidebar groups source locations by file. The editor highlights the selected range, and the Code Explanation panel describes why it matters.

## Try it
1. Open this folder in desktop VS Code. Run `npm ci` if the development dependencies aren't installed, then press **F5**.
2. In the Extension Development Host window, open a project, run **Anchor: Ask Question** from the Command Palette, and type a question. This needs GitHub Copilot.

Open **Anchor** from its speech-bubble icon in the Activity Bar. If you moved Question Outline, right-click its title and choose **Reset Location**. If the explanation panel appears beside the editor, use **View → Appearance → Panel Position → Bottom**.

## Ask about your own code

In the Extension Development Host, open your project folder with **File → Open Folder**, then run **Anchor: Ask Question**. Enter a question about behavior. Anchor searches filenames and source text in that workspace, including files that have never been opened, and ranks matches using words from the question. It sends the question and up to eight excerpts to GitHub Copilot through VS Code's Language Model API. The first verified citation opens automatically. The outline and explanation show filenames, and each click opens the correct file even if two folders contain the same filename.

Search covers common code formats and skips hidden files, dependencies, generated directories, and oversized files. It works best when the question shares words with the project. Follow-ups use the selected range and its recent exchanges. Live questions require a trusted workspace and an available Copilot model.

Anchor verifies that proposed ranges were included in the excerpts sent to the model. If a referenced file changes, the citation becomes stale and you can ask again to refresh it. Walkthroughs and follow-ups live in memory for the current session.