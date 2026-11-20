# Code-Centered LLM Assistance: Bridging Interfaces and Source Code for Enhanced Comprehension 

## Introduction
Software developers are increasingly turning to large language models to understand unfamiliar code. A typical interaction often takes form of a chat interface, running in the terminal or a sidebar, that is distinct from the source code. The developer poses a question, receives a natural-language explanation, and must then map that explanation back to specific files, functions, and control flow in the codebase.

This mapping can be cognitively effortful. Recent work on cognitive load in AI-assisted programming suggests that LLM tools create a dual-task environment: while they reduce the intrinsic difficulty of reading code, the act of reconciling a chat response with the source can be  extraneous [Feeling Easier, Working Harder]. Evidence from Anthropic’s skill-formation trial reinforces this concern. Researchers found that junior engineers who delegated their tasks entirely to an AI assistant scored significantly lower on post-task comprehension, while those who paused to ask follow-up questions and verify against the source retained their understanding [1]. Recent studies show an overall pattern where AI-reliance leads to impaired comprehension of the source code and associated tasks. 

personas find that “AI-steered” developers lack comprehension of both their changes and the surrounding codebase [AIRELI], and controlled experiments on brownfield programming show productivity gains with no corresponding improvement in comprehension [Comprehension-Performance Gap].

A growing body of tool design work aims to close this gap by anchoring LLM output more tightly to source code. GitHub Copilot Chat and Cursor already surface file-level references and clickable links in their responses. CodeVoyager pairs an LLM with interactive call graphs and control flow diagrams, finding improved comprehension and trust relative to chat-only assistants in a within-subjects study [CodeVoyager]. Earlier, non-LLM work on code annotations showed that placing the right information at the right time and place increased accuracy and reduced cognitive load [Adeli et al.], and that annotations anchored to source locations supported richer sensemaking than free-form notes [Horvath & Myers].

What remains open is how grounding LLM explanations in source locations affects understanding. This paper addresses that question empirically. To ground LLM explanations within the source code, a Visual Studio Code extension was created to serve as the experimental instrument. This extension is called Anchor. Anchor highlights relevant code ranges, groups citations by file in an outline panel, and links each claim to the lines it describes. Anchor is compared against a conventional chat-based LLM (Claude Code, powered by the same model) in a within-subject study. Participants are tasked to familiarize with two aspects of the same codebase with both tools. Followed by a period of study, comprehension questions are administered to gauge understanding. I operationalized understanding through two proxies drawn from Ko et al.’s information-needs framework [2]: code localization (knowing _where_ a behaviour is implemented) and code justification (knowing _why_ the code is written a particular way). Participants also provide confidence ratings, enabling analysis of calibration between self-assessed and actual understanding.

This paper's contribution is not a novel interface design as anchoring explanations to source code is already surfacing in commercial LLM tools. This paper instead offers a controlled empirical comparison measuring whether anchoring produces retained comprehension gains, operationalized through localization and justification scores assessed after the tool is removed.

Things to add to the introduction
- From the paper "Grasping AI Reliance in Program Comprehension and Coding through the AIRELI Persona Taxonomy", they wrote about how reliance [on ai] has become so embedded that AI assistance can no longer be meaningfully isolated, much like one would not remove an IDE to study its impact on programming productivity today. 
	- Early work showed that designing such assistants in the IDE improved success and satisfaction on code understanding tasks, suggesting that reliance risks can be mitigated when the assistant is situated within comprehension activities during code generation [[30](https://dl.acm.org/doi/10.1145/3794763.3794804#Bib0030), [51](https://dl.acm.org/doi/10.1145/3794763.3794804#Bib0051)]. At the same time, using LLMs to enhance understanding should be used with caution: evaluations of ChatGPT on program comprehension questions reveal weaknesses analogous to novices, including difficulty following execution traces and missing subtle but important details [[25](https://dl.acm.org/doi/10.1145/3794763.3794804#Bib0025)]. Evidence with novices further shows that initial trust can be high and plausibility can be mistaken for correctness, strengthening the case for interfaces that surface uncertainty and rationale during comprehension [[39](https://dl.acm.org/doi/10.1145/3794763.3794804#Bib0039)].
- Emphasize exploratory nature more? Add more citations / proof of claims

## Methodology 
- high level overview of the methodology
## Participants 
- All bachelors students studying computer science 
- 3 females, 2 males 
- all aged 22 - 24
- 1-5 range years of coding experience 
- recruited from me asking them to help me 
### Procedure
- lasted 1 hours per developer
- go more in depth of what the process was like 
We conducted a within-subjects study in which each participant used both tools—Anchor and a chat-based LLM—to study two distinct functionalities of the same codebase. We then assessed comprehension through written questions answered without tool access.

All participants received a demo of Anchor, and were told during their code exploration, to focus on understanding the localization and justification of the functionality. This was to ideally reduce the advantage of using the tool in the second round since the style of question was already known. 

The participant then has 10 minutes to understand their task, in which immediately following they have 8 minutes to complete 4 comprehension questions. Participants will then use the other tool to understand another component, and answer another 4 comprehension questions. 

To control for ordering effects, we counterbalanced tool–task pairings across two groups. Group A used Anchor first to study Task A (the downloader) and then used the chat LLM to study Task B (sessions). Group B received the reverse assignment: the chat LLM for Task A followed by Anchor for Task B. Each participant therefore served as their own control, and every tool–task combination appeared in both ordinal positions. The part that wasn't controlled was the material since task A and task B were inherently different with different comprehension questions. 

Because I am not making any claims on which tool is faster, and understanding is not linear across people, people were able to finish up reading their last prompts or end early before taking the comprehension questions, as the study permits (no more than maybe +- 5 minutes)

### Anchor VS Code extension 
- Anchor was created with the goal of centering LLM queries about code around the code. It has a side panel where it shows an initial explanation, and then points to multiple relevant functions across files, where it highlights the function and provides a brief explanation of the function. Users can then choose to ask follow up questions that are contained within the function, within crowding a linear chat history. 
[Insert images of Anchor]
### Language Model and Control Selection
To isolate the effect of interface design from variation in model capability, we held the underlying language model constant across both conditions. Both Anchor and the chat-based interface (Claude Code) were powered by Claude Sonnet 5.5. We selected this model as a mid-tier option that produces fast, high-quality responses suitable for explanation tasks on a well-known repository.
- Add more here about why I choose claude code specifically over codex or copilot. Codex and copilot both links to code, which provides a semi-similar experience to Anchor. Although Anchor also allows you to ask follow up questions in a contained and modular way, to best isolate the effects of code grounded exploration, i opted for a solution that complicates isolates participants from the code so that the affects of anchor can fully be tested. Claude Code sonnet is also a widely used model for every day task and many developers use it to navigate and understand their code. 
### Codebase and Task Selection
For the codebase that the participants will be tasked to understand, I selected HTTPie, an open-source command-line HTTP client written in Python (~8–10k LOC), as the target codebase. Python was chosen because all participants reported familiarity with it, and HTTPie’s moderate size allowed participants to develop meaningful understanding within a constrained study session. Although HTTPie is a well-known project likely present in the LLM’s training data, this does not threaten validity: the study compares two LLM-powered interfaces on the same underlying model, so any advantage from prior training exposure is held constant across conditions.

We defined two study tasks, each focused on a self-contained functional area:
- **Task A (Downloader):** How does HTTPie’s download functionality work?
- **Task B (Sessions):** How does HTTPie’s session persistence work?
Both tasks were chosen because their core logic is largely contained within one file, with a few other files calling it. This gives participants a reasonable task within a 10 minute window.
- Both the downloader and the session are of similar size (~300 LOC), and were assessed to be of similar difficulty. 
### Measures of Understanding
We operationalize code understanding using two proxies drawn from Ko et al.’s information-needs framework [2]:
- **Code localization (U1):** knowing *where* in the codebase a behaviour is implemented.
- **Code justification (U2):** knowing *why* the code is written a particular way and what it depends on.
These two dimensions capture complementary aspects of comprehension: localization tests structural knowledge of the codebase, while justification tests the ability to reason about design decisions and data flow.

### Comprehension Questions
For each task, we designed four comprehension questions—two targeting localization (U1) and two targeting justification (U2)—with one easier and one harder question per proxy. The easier questions can be answered from a single file, while the harder ones require reasoning across multiple files or about ordering of operations.

All questions were phrased in semantic, scenario-based terms so that they could not be resolved by keyword search alone. To further test localization rather than memorization, we disabled repository-wide search (grep and VS Code search) during the question phase, though participants could freely browse the source code.

|                         | Task A (Downloader)                                                                                                                                                                                                                                  | Task B (Sessions)                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1 (easy: one file)     | (a) You download a file without naming where to save it, and HTTPie saves it as report-2026.pdf, a name that isn’t in the URL you typed. Which part of HTTPie picks that name, and what information does it use?                                     | (a) You run a request with --session=dev and pass two headers on the command line: Content-Type: application/json and X-Team: core. On your next request with --session=dev, X-Team is sent again automatically but Content-Type is not. Which part of the code decides what the session keeps, and what rule does it use? |
| U1 (hard: spans files)  | (b) The connection drops halfway through a large download, and HTTPie exits with an error saying the download was incomplete. Which part(s) of the code notice this, and what do they compare to decide it?                                          | (b) A cookie saved in your session has an expiry date that has now passed. Next time you use the session, it isn’t sent. Where is it dropped, and what does the code compare?                                                                                                                                              |
| U2 (hard: ordering)     | (a) HTTPie refuses to resume an interrupted download unless you name the output file yourself. What does the code need to know in order to resume, and at what point does it need it? Use that to explain why a name HTTPie picks itself won’t work. | (a) Your session stores X-Token: old. You pass X-Token: new on the command line. new is sent, and afterwards the session contains new. Explain what the code does, in order, that produces both results.                                                                                                                   |
| U2 (easy: one decision) | (b) In download mode, HTTPie follows redirects even if you didn’t ask it to. What would end up on disk if it didn’t, and where in the program does it switch redirect-following on?                                                                  | (b) You saved a login in a session called work while calling api.example.com. When you use --session=work against other.example.com, the login isn’t there. How does HTTPie keep the two apart, and what problem does that design prevent?                                                                                 |

Answers are scored on a three-point scale (0/1/2) against a rubric written prior to data collection. Participants also provide a confidence rating (1–5) for each answer, enabling analysis of calibration between self-assessed and actual understanding.

### Hypotheses

The following hypotheses were registered before data collection:

- **H1:** Localization scores (U1) will be higher in the Anchor condition than in the chat LLM condition.
- **H2:** For justification (U2), the chat LLM will yield responses that appear fluent but are less grounded in the source code, manifesting as lower verification behaviour and a larger gap between confidence and accuracy.

## Results
Participant feedback
A:
- 
B: 
- Reported that she enjoyed using Anchor and that it was more comprehensive. However, within the study felt disadvantaged by having to surmount the learning curve, which ate a bit out of their 10 meaning learning time 
- Reported that she felt (being a part of Group A) the second time using Claude Code she felt she had a better understanding of what to look for which they felt affected their performance 
C: 
- Reported that they enjoyed using Anchor because they felt like it directed them to where to look. They reported by surfacing code, it was easier to not get lost in the linear conversation of chat conversations and point out gaps easier in what he didn't know 
- Struggled with the questions a lot because he did not yet take any networking courses. They were a bit earlier on in the degree than other participants, and they have never worked any software position before. Because of the lack of experience navigating large codebases, the allocated time was not enough. However, he still reported that he understand better when the code was included in the explanation. 
- During their Claude Code round, they did not reference the code at all.



## Discussion

## Limitations
- Small sample size
- Differing years of experience and course background 
- Time limit 
- Some of the questions were a lot easier if one had extensive HTTP knowledge. This is a later shortcoming of http since it was difficult to design reasonable questions under the time constraint 

## Conclusion

##  