# Quizy — AI Assistant Guide & Documentation

Quizy is a client-side, browser-based study tool that turns uploaded course notes (PDF, DOCX, TXT, Markdown) or pasted text into interactive multiple-choice quizzes.

## Project overview

- **Browser-only:** Quizy runs from `index.html` without a backend or build step.
- **Privacy-first:** Notes and files are processed in the browser and are not uploaded or saved by Quizy. PDF and DOCX parsing libraries are loaded from a CDN when those formats are used.
- **Rule-based generation:** Quizy does not use a generative AI service at runtime. Questions are generated locally from sentences, key terms, definitions, and repeated vocabulary in the source.
- **Native web technologies:** The interface uses HTML and CSS; app behavior uses vanilla JavaScript.

## Technology and dependencies

- HTML5 and responsive CSS.
- Vanilla JavaScript (ES6+).
- PDF.js, loaded from cdnjs for PDF text extraction.
- Mammoth.js, loaded from cdnjs for DOCX text extraction.

PDF.js and Mammoth are only needed when reading their respective document formats. Pasted text, TXT, and Markdown do not require those libraries. Scanned, image-only PDFs need text recognition before they can be used.

## Question generation guidelines

When changing the question generator:

1. Preserve paragraph boundaries, and filter common instructions, learning objectives, activity prompts, and reference entries.
2. Prefer explanatory sentences and definitions that introduce a term or concept. Repeated vocabulary and capitalized key terms can help identify candidates.
3. Draw distractors dynamically from other key terms in the same document.
4. If there are not enough distinct, valid questions for the requested count, return the questions available without failing. Clearly tell the user when the quiz is shorter than requested.
5. Do not introduce generative AI APIs or external services for question generation.

Quizy uses local language heuristics, so generated questions can still be imperfect. Review question wording and answer choices against the source material.

## Quiz behavior

- Choose 10, 20, or 30 questions and an Easy, Hard, or Extreme difficulty.
- Each question is timed: Easy gives 25 seconds, Hard gives 15 seconds, and Extreme gives 10 seconds.
- Answers, skips, and timeouts show the correct answer with its source-text context. An unanswered timed-out question earns no point and is counted as wrong.
- The results screen shows the score, unanswered count, total quiz time, and an answer-by-answer review.

## Working on Quizy

- Keep the app runnable by opening `index.html`; do not add a framework or build tool unless requested.
- Keep plain-text quiz generation available offline, with external dependencies limited to document parsing.
- Keep parsing, question generation, timer/state management, and DOM rendering separated into small, understandable functions.
- Add brief comments only where code needs clarification.

## Run locally

Open `index.html` in a modern browser. No installation or build step is required. PDF and DOCX uploads need an internet connection to load their parsing libraries; pasted notes and plain-text files work without those libraries.
