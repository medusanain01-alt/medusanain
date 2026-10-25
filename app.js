"use strict";

const fileInput = document.querySelector("#file-input");
const dropzone = document.querySelector("#dropzone");
const moduleText = document.querySelector("#module-text");
const fileStatus = document.querySelector("#file-status");
const clearMaterialButton = document.querySelector("#clear-material");
const generateButton = document.querySelector("#generate-button");
const setupPanel = document.querySelector("#setup-panel");
const quizPanel = document.querySelector("#quiz-panel");
const resultsPanel = document.querySelector("#results-panel");
const breadcrumbCurrent = document.querySelector("#breadcrumb-current");
const profilePreviewButton = document.querySelector("#profile-preview-button");
const profileDialog = document.querySelector("#profile-dialog");
const profileDialogClose = document.querySelector("#profile-dialog-close");

let selectedCount = 10;
let selectedDifficulty = "easy";
let sourceName = "your notes";
let questions = [];
let currentQuestionIndex = 0;
let selectedAnswerIndex = null;
let isAnswerChecked = false;
let questionDeadline = null;
let questionTimerId = null;
let timedOut = false;
let score = 0;
let sessionStartedAt = null;
let questionStartedAt = null;

const secondsPerQuestion = { easy: 25, hard: 15, extreme: 10 };

const instructionStartPattern = /^(?:please\s+)?(?:read|review|study|complete|answer|write|discuss|describe|identify|explain|compare|contrast|differentiate|distinguish|apply|create|implement|list|define|submit|upload|choose|select|watch|listen|click|turn in|refer to|take note|fill in|fill out|work on|make sure|remember to|do not|don't|ensure|follow|perform|conduct|solve|calculate|draw|label|visit|open|download|prepare|present|share|reflect|think about|try to|kindly|let us|let's)\b/i;
const instructionHeadingPattern = /^(?:learning objectives?|module objectives?|instructions?|directions?|activities|activity|assessment|assignment|task|requirements?|submission guidelines?)\s*[:\-]/i;
const learningOutcomePattern = /^(?:in this module|after (?:completing|reading|studying)|at the end|by the end|upon completion|students? (?:will|should|must) be able to|students? are expected to|you (?:will|should|must) be able to|you are expected to|this (?:module|lesson|chapter|section) (?:will|covers|aims|provides)|the following (?:activity|questions?|tasks?))\b/i;
const studentInstructionPattern = /^(?:(?:students?|learners?)\s+(?:(?:should|must|will|are expected to)\s+)?|each\s+(?:student|group|team|learner)\s+(?:(?:should|must|will)\s+)?)(?:identify|create|answer|describe|explain|apply|differentiate|distinguish|compare|complete|list|write|discuss|draw|prepare|submit|present)\b/i;
const sentenceFragmentPattern = /^(?:provides|allows|ensures|creates|makes|includes|contains|uses|focuses|prevents|reduces|increases|helps|supports|hides|avoids|requires|enables|when|while|where|and|or|but|because|which|that)\b/i;

profilePreviewButton.addEventListener("click", () => profileDialog.showModal());
profileDialogClose.addEventListener("click", () => profileDialog.close());
profileDialog.addEventListener("click", (event) => {
  if (event.target === profileDialog) {
    profileDialog.close();
  }
});
profileDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    profileDialog.close();
  }
});

const stopWords = new Set(
  ("about above after again against all also am an and any are as at be because been before being " +
    "below between both but by can could did do does doing down during each few for from further " +
    "had has have having he her here hers herself him himself his how i if in into is it its itself " +
    "just more most my myself no nor not of off on once only or other ought our ours ourselves out " +
    "over own same she should so some such than that the their theirs them themselves then there " +
    "these they this those through to too under until up very was we were what when where which while " +
    "who whom why will with would you your yours yourself yourselves absorbs absorb breaks breaking called " +
    "close converted convert contains contain enters release releases split splits stores store travels travel " +
    "produces produce provides provide regulates regulate uses use needed requires required open opens inside tiny " +
    "green own called different important first second main large small").split(/\s+/)
);

document.querySelectorAll("[data-count]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedCount = Number(button.dataset.count);
    document.querySelectorAll("[data-count]").forEach((option) => {
      const isSelected = option === button;
      option.classList.toggle("selected", isSelected);
      option.setAttribute("aria-pressed", String(isSelected));
    });
  });
});

document.querySelectorAll("[data-difficulty]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedDifficulty = button.dataset.difficulty;
    document.querySelectorAll("[data-difficulty]").forEach((option) => {
      const isSelected = option === button;
      option.classList.toggle("selected", isSelected);
      option.setAttribute("aria-pressed", String(isSelected));
    });
  });
});

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  if (file) {
    await loadFile(file);
  }
});

dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  });
});

dropzone.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer.files;
  if (file) {
    await loadFile(file);
  }
});

moduleText.addEventListener("input", () => {
  if (moduleText.value.trim()) {
    sourceName = "your notes";
    showFileStatus(`${countWords(moduleText.value).toLocaleString()} words in your notes`, "success");
  } else if (!fileInput.files.length) {
    showFileStatus("Your material is processed privately in your browser.");
  }
  clearMaterialButton.hidden = !moduleText.value.trim() && !fileInput.files.length;
});

clearMaterialButton.addEventListener("click", clearMaterial);
generateButton.addEventListener("click", startQuiz);

async function loadFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supportedExtensions = ["txt", "md", "markdown", "pdf", "docx"];
  if (!supportedExtensions.includes(extension)) {
    showFileStatus("Choose a PDF, DOCX, TXT or Markdown file.", "error");
    fileInput.value = "";
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showFileStatus("That file is over 15 MB. Choose a smaller file.", "error");
    fileInput.value = "";
    return;
  }
  if (file.size === 0) {
    showFileStatus("That file is empty. Choose another file.", "error");
    fileInput.value = "";
    return;
  }

  showFileStatus(`Reading ${file.name}…`);
  try {
    let text;
    if (extension === "pdf") {
      text = await readPdf(file);
    } else if (extension === "docx") {
      text = await readDocx(file);
    } else {
      text = await file.text();
    }
    text = text
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!text) {
      throw new Error("No readable text was found. Try a text-based file or paste your notes.");
    }
    moduleText.value = text;
    sourceName = file.name;
    showFileStatus(`${file.name} · ${countWords(text).toLocaleString()} words ready`, "success");
    clearMaterialButton.hidden = false;
  } catch (error) {
    showFileStatus(error instanceof Error ? error.message : "The file could not be read. Try another file.", "error");
  }
}

async function readPdf(file) {
  const pdfjs = await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    () => Boolean(window.pdfjsLib)
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const documentProxy = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = await Promise.all(
    Array.from({ length: documentProxy.numPages }, async (_, index) => {
      const page = await documentProxy.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    })
  );
  return pages.join(" ");
}

async function readDocx(file) {
  const mammoth = await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
    () => Boolean(window.mammoth)
  );
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

function loadScript(src, isReady) {
  if (isReady()) {
    return Promise.resolve(window.pdfjsLib || window.mammoth);
  }
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (isReady()) resolve(window.pdfjsLib || window.mammoth);
        else reject(new Error("The file-reading library did not load correctly. Check your connection and try again."));
      }, { once: true });
      existingScript.addEventListener("error", () => {
        reject(new Error("Could not load the file-reading library. Check your internet connection and try again."));
      }, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (isReady()) resolve(window.pdfjsLib || window.mammoth);
      else reject(new Error("The file-reading library did not load correctly. Check your connection and try again."));
    };
    script.onerror = () => {
      reject(new Error("Could not load the file-reading library. Check your internet connection and try again."));
    };
    document.head.append(script);
  });
}

function showFileStatus(message, state = "") {
  fileStatus.textContent = message;
  fileStatus.classList.toggle("error", state === "error");
  fileStatus.classList.toggle("success", state === "success");
}

function clearMaterial() {
  moduleText.value = "";
  fileInput.value = "";
  sourceName = "your notes";
  showFileStatus("Your material is processed privately in your browser.");
  clearMaterialButton.hidden = true;
}

function countWords(text) {
  return text.trim().match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length || 0;
}

function startQuiz() {
  const text = moduleText.value.trim();
  if (!text) {
    showFileStatus("Add your study material first, then create your quiz.", "error");
    moduleText.focus();
    return;
  }

  const generated = generateQuestions(text, selectedDifficulty, selectedCount);
  if (!generated.questions.length) {
    showFileStatus("Add a little more text with full sentences so Quizy can make useful questions.", "error");
    return;
  }

  questions = generated.questions;
  questions.forEach((question) => {
    question.userAnswer = null;
  });
  currentQuestionIndex = 0;
  selectedAnswerIndex = null;
  isAnswerChecked = false;
  questionDeadline = null;
  questionStartedAt = null;
  timedOut = false;
  score = 0;
  sessionStartedAt = Date.now();
  setupPanel.hidden = true;
  resultsPanel.hidden = true;
  quizPanel.hidden = false;
  breadcrumbCurrent.textContent = "Quiz in progress";
  renderQuestion();
  quizPanel.scrollIntoView({ behavior: "smooth", block: "start" });

  if (generated.questions.length < selectedCount) {
    showFileStatus(
      `Created ${generated.questions.length} questions from the available material. Add more notes for a ${selectedCount}-question quiz.`,
      "error"
    );
  }
}

function generateQuestions(text, difficulty, requestedCount) {
  const sentences = getStudySentences(text)
    .filter((sentence) =>
      countWords(sentence) >= 6 &&
      !isInstructionalSentence(sentence) &&
      !isReferenceSentence(sentence) &&
      !sentence.includes("?") &&
      !sentenceFragmentPattern.test(sentence)
    );
  const frequency = new Map();
  const sentenceWords = sentences.map((sentence) => {
    const words = sentence.match(/[\p{L}][\p{L}\p{N}'’-]*/gu) || [];
    for (const word of words) {
      const normalized = word.toLocaleLowerCase();
      if (normalized.length >= 4 && !stopWords.has(normalized) && !/^\d+$/.test(normalized)) {
        frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
      }
    }
    return words;
  });

  const rankedWords = [...frequency.entries()]
    .map(([word, count]) => ({ word, count, score: word.length * Math.log2(count + 1) }))
    .sort((a, b) => b.score - a.score);
  const wordRanks = new Map(rankedWords.map((item) => [item.word, item.score]));
  const candidateSentences = sentences.map((sentence, index) => {
    const words = sentenceWords[index];
    const topicTerm = findDefinitionTopicTerm(sentence);
    const seen = new Set();
    const candidates = words
      .filter((word) => {
        const normalized = word.toLocaleLowerCase();
        const isShortSentenceOpener = words[0] === word && word.length <= 8;
        if (normalized.length < 4 || stopWords.has(normalized) || seen.has(normalized) || isShortSentenceOpener) return false;
        seen.add(normalized);
        return frequency.has(normalized);
      })
      .map((word) => {
        const normalized = word.toLocaleLowerCase();
        const count = frequency.get(normalized);
        const rank = wordRanks.get(normalized) || 0;
        const difficultyScore =
          difficulty === "easy" ? count * 2 - word.length * 0.2 :
            difficulty === "hard" ? word.length - Math.log2(count + 1) :
              word.length * 2 - count;
        const topicBonus = normalized === topicTerm ? 100 : 0;
        return { word, normalized, count, rank, difficultyScore: difficultyScore + topicBonus };
      })
      .sort((a, b) => b.difficultyScore - a.difficultyScore);
    return { sentence, candidates, topicTerm };
  });

  const usedAnswers = new Set();
  const prepared = [];
  for (const { sentence, candidates, topicTerm } of candidateSentences) {
    const candidate = candidates.find((item) => !usedAnswers.has(item.normalized));
    if (!candidate) continue;
    const options = buildOptions(candidate, rankedWords);
    if (options.length !== 4) continue;
    usedAnswers.add(candidate.normalized);
    const blankedSentence = sentence.replace(
      new RegExp(`\\b${escapeRegExp(candidate.word)}\\b`, "i"),
      "________"
    );
    prepared.push({
      prompt: "Choose the term that best completes this statement:",
      statement: blankedSentence,
      original: sentence,
      answer: candidate.word,
      options: shuffle(options),
      difficulty,
      topicPriority: candidate.normalized === topicTerm
    });
  }

  const prioritized = shuffle(prepared.filter((question) => question.topicPriority));
  const otherQuestions = shuffle(prepared.filter((question) => !question.topicPriority));
  return { questions: [...prioritized, ...otherQuestions].slice(0, requestedCount) };
}

function getStudySentences(text) {
  const sentences = [];
  let skipSection = false;
  const lines = text.replace(/\r\n?/g, "\n").split(/\n+/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*[•●▪◦*-]\s*/, "").replace(/\s+/g, " ").trim();
    if (!line) continue;

    const sectionHeading = line.match(/^[IVXLCDM]+\.\s+(.+)$/i);
    if (sectionHeading) {
      skipSection = isExcludedSectionHeading(sectionHeading[1]);
      continue;
    }
    if (isExcludedSectionHeading(line)) {
      skipSection = true;
      continue;
    }
    if (skipSection) continue;

    sentences.push(...line.split(/(?<=[.!?])\s+(?=[\p{Lu}\d])/u).map((sentence) => sentence.trim()));
  }

  return sentences.filter(Boolean);
}

function isExcludedSectionHeading(line) {
  return /^(?:(?:group activity|practical activity|activity|exercise|assignment|try this|think about(?: it)?|answer guide|learning outcomes?|instructions?|directions?|review questions?|assessment|task|question)(?:\s+\d+)?)(?:\s*[:\-].*)?$/i.test(line);
}

function isInstructionalSentence(sentence) {
  return instructionStartPattern.test(sentence) ||
    instructionHeadingPattern.test(sentence) ||
    learningOutcomePattern.test(sentence) ||
    studentInstructionPattern.test(sentence);
}

function isReferenceSentence(sentence) {
  return /^(?:references?|bibliography|works cited)\b|^[\p{Lu}][\p{L}'’-]+,\s*[\p{Lu}]\.,.*\b(?:19|20)\d{2}\b/iu.test(sentence);
}

function findDefinitionTopicTerm(sentence) {
  const definitionMatch = sentence.match(
    /^(?:(?:the|a|an)\s+)?([\p{L}][\p{L}\p{N}'’-]*(?:\s+[\p{L}][\p{L}\p{N}'’-]*){0,2})\s+(?:is|are|was|were|refers|means|describes|represents|consists|contains|includes|occurs|happens|forms|produces|causes|requires|uses|allows|enables|provides|involves|defines|ensures)\b|^([\p{L}][\p{L}\p{N}'’-]*(?:\s+[\p{L}][\p{L}\p{N}'’-]*){0,2})\s*[–—:-]\s*(?:focuses|focus|allows|enables|ensures|provides|describes|refers|means|is|are)\b/iu
  );
  const topicPhrase = definitionMatch?.[1] || definitionMatch?.[2];
  if (!topicPhrase) return "";

  const topicWords = topicPhrase
    .match(/[\p{L}][\p{L}\p{N}'’-]*/gu)
    ?.filter((word) => word.length >= 4 && !stopWords.has(word.toLocaleLowerCase())) || [];
  return topicWords[0]?.toLocaleLowerCase() || "";
}

function buildOptions(answer, rankedWords) {
  const candidates = rankedWords
    .filter((item) => item.word !== answer.normalized)
    .sort((a, b) => Math.abs(a.score - answer.rank) - Math.abs(b.score - answer.rank));
  const distractors = [];
  for (const candidate of candidates) {
    if (distractors.every((word) => word.length !== candidate.word.length)) {
      distractors.push(candidate.word);
    }
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) {
    for (const candidate of candidates) {
      if (!distractors.includes(candidate.word)) distractors.push(candidate.word);
      if (distractors.length === 3) break;
    }
  }
  return [answer.word, ...distractors];
}

function renderQuestion() {
  const question = questions[currentQuestionIndex];
  const checked = isAnswerChecked;
  const answeredCorrectly = selectedAnswerIndex !== null && question.options[selectedAnswerIndex] === question.answer;
  const timeLimit = secondsPerQuestion[question.difficulty];
  if (questionDeadline === null) {
    questionStartedAt = Date.now();
    questionDeadline = Date.now() + timeLimit * 1000;
  }
  quizPanel.innerHTML = `
    <div class="quiz-topline">
      <span class="quiz-tag"><span class="quiz-tag-dot"></span>${escapeHtml(question.difficulty)} practice · ${escapeHtml(sourceName)}</span>
      <span class="quiz-count"><strong>${currentQuestionIndex + 1}</strong> / ${questions.length}</span>
    </div>
    <div class="progress-track" role="progressbar" aria-label="Quiz progress" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${currentQuestionIndex + 1}">
      <div class="progress-fill" style="width:${((currentQuestionIndex + 1) / questions.length) * 100}%"></div>
    </div>
    <div class="timer-row">
      <span class="timer-label">${timedOut ? "Time's up" : "TIME LEFT"}</span>
      <span class="timer-display" id="timer-display" aria-live="off">${timeLimit}</span>
    </div>
    <div class="timer-track${timedOut ? " timer-expired" : ""}" id="timer-track" role="progressbar" aria-label="Time remaining for this question" aria-valuemin="0" aria-valuemax="${timeLimit}">
      <div class="timer-fill" id="timer-fill"></div>
    </div>
    ${questions.length < selectedCount ? `<p class="quiz-count-notice">We found ${questions.length} distinct practice questions in your material. Add more notes for a longer quiz.</p>` : ""}
    <p class="question-kicker">${escapeHtml(question.prompt)}</p>
    <h2 class="question-title">${escapeHtml(question.statement)}</h2>
    <p class="question-helper">${timedOut ? "Take a moment to review the answer before continuing." : checked ? "Answer checked — review the feedback before continuing." : "Choose the best answer to complete the statement."}</p>
    <div class="answer-list" role="group" aria-label="Answer choices">
      ${question.options.map((option, index) => {
        let stateClass = selectedAnswerIndex === index ? " is-selected" : "";
        if (checked && option === question.answer) stateClass = " is-correct";
        else if (checked && selectedAnswerIndex === index) stateClass = " is-incorrect";
        return `<button class="answer-option${stateClass}" type="button" data-answer-index="${index}" ${checked ? "disabled" : ""}>
          <span class="answer-letter">${String.fromCharCode(65 + index)}</span><span>${escapeHtml(option)}</span>
        </button>`;
      }).join("")}
    </div>
    ${checked ? `<div class="answer-feedback ${answeredCorrectly ? "correct" : "incorrect"}" role="status">
      <span class="feedback-mark">${answeredCorrectly ? "✓" : "!"}</span>
      <span><strong>${timedOut ? "Time's up." : answeredCorrectly ? "That's right!" : selectedAnswerIndex === null ? "Question skipped." : "Not quite."}</strong> ${answeredCorrectly ? "You got it." : `The answer is ${escapeHtml(question.answer)}.`} ${escapeHtml(question.original)}</span>
    </div>` : ""}
    <div class="quiz-actions">
      <button class="secondary-button" type="button" id="back-to-setup"${checked ? " disabled" : ""}>Exit quiz</button>
      ${checked ?
        `<button class="quiz-primary-button" type="button" id="next-question">${currentQuestionIndex === questions.length - 1 ? "See my results" : "Next question"} <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></button>` :
        `<button class="quiz-primary-button" type="button" id="check-answer">${selectedAnswerIndex === null ? "Skip question" : "Check answer"} <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></button>`}
    </div>`;

  quizPanel.querySelectorAll("[data-answer-index]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedAnswerIndex = Number(button.dataset.answerIndex);
      renderQuestion();
    });
  });
  quizPanel.querySelector("#check-answer")?.addEventListener("click", () => checkAnswer());
  quizPanel.querySelector("#next-question")?.addEventListener("click", nextQuestion);
  quizPanel.querySelector("#back-to-setup")?.addEventListener("click", exitQuiz);
  startQuestionTimer(timeLimit);
}

function startQuestionTimer(timeLimit) {
  if (questionTimerId !== null) {
    clearInterval(questionTimerId);
    questionTimerId = null;
  }
  updateQuestionTimer(timeLimit);
  if (isAnswerChecked) return;
  questionTimerId = window.setInterval(() => {
    if (!updateQuestionTimer(timeLimit)) {
      timedOut = true;
      checkAnswer(true);
    }
  }, 200);
}

function updateQuestionTimer(timeLimit) {
  const secondsLeft = Math.max(0, Math.ceil((questionDeadline - Date.now()) / 1000));
  const timerDisplay = quizPanel.querySelector("#timer-display");
  const timerTrack = quizPanel.querySelector("#timer-track");
  const timerFill = quizPanel.querySelector("#timer-fill");
  if (timerDisplay) timerDisplay.textContent = String(secondsLeft);
  if (timerTrack) {
    timerTrack.setAttribute("aria-valuenow", String(secondsLeft));
    timerTrack.classList.toggle("timer-low", secondsLeft <= 5 && secondsLeft > 0);
  }
  if (timerFill) timerFill.style.width = `${(secondsLeft / timeLimit) * 100}%`;
  return secondsLeft > 0;
}

function checkAnswer(fromTimeout = false) {
  if (isAnswerChecked) return;
  if (questionTimerId !== null) {
    clearInterval(questionTimerId);
    questionTimerId = null;
  }
  const question = questions[currentQuestionIndex];
  timedOut = fromTimeout;
  question.userAnswer = selectedAnswerIndex === null ? null : question.options[selectedAnswerIndex];
  question.timeSpentSeconds = Math.min(
    secondsPerQuestion[question.difficulty],
    Math.max(0, Math.ceil((Date.now() - questionStartedAt) / 1000))
  );
  if (selectedAnswerIndex !== null && question.options[selectedAnswerIndex] === question.answer) {
    score += 1;
  }
  isAnswerChecked = true;
  renderQuestion();
}

function nextQuestion() {
  if (currentQuestionIndex === questions.length - 1) {
    showResults();
    return;
  }
  currentQuestionIndex += 1;
  selectedAnswerIndex = null;
  isAnswerChecked = false;
  questionDeadline = null;
  questionStartedAt = null;
  timedOut = false;
  renderQuestion();
}

function showResults() {
  if (questionTimerId !== null) {
    clearInterval(questionTimerId);
    questionTimerId = null;
  }
  quizPanel.hidden = true;
  resultsPanel.hidden = false;
  breadcrumbCurrent.textContent = "Quiz results";
  const percentage = Math.round((score / questions.length) * 100);
  const title = percentage >= 80 ? "Brilliant work!" : percentage >= 50 ? "You're getting there!" : "Every try is progress.";
  const resultMessage = percentage >= 80
    ? "You know this material well. Keep that momentum going."
    : percentage >= 50
      ? "A little more review will make these ideas stick."
      : "Revisit the module, then give it another go. You've got this.";
  const wrongCount = questions.length - score;
  const unansweredCount = questions.filter((question) => question.userAnswer === null).length;
  const elapsedSeconds = Math.floor((Date.now() - sessionStartedAt) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingSeconds = elapsedSeconds % 60;
  const elapsedLabel = `${elapsedMinutes}:${String(remainingSeconds).padStart(2, "0")}`;
  resultsPanel.innerHTML = `
    <div class="results-header">
      <div class="results-badge" aria-hidden="true">${percentage >= 80 ? "✦" : percentage >= 50 ? "↗" : "✳"}</div>
      <p class="results-kicker">SESSION COMPLETE · ${escapeHtml(selectedDifficulty.toUpperCase())} PRACTICE</p>
      <h2 class="results-title">${title}</h2>
      <p class="results-subtitle">${escapeHtml(resultMessage)}</p>
      <div class="score-ring" style="--score:${percentage}%" aria-label="${percentage}% score"><span class="score-value">${percentage}%</span><span class="score-label">YOUR SCORE</span></div>
      <div class="score-stats">
        <div class="score-stat correct"><strong>${score}</strong><span>Correct</span></div>
        <div class="score-stat incorrect"><strong>${wrongCount}</strong><span>To review</span></div>
        <div class="score-stat"><strong>${unansweredCount}</strong><span>Unanswered</span></div>
        <div class="score-stat"><strong>${questions.length}</strong><span>Questions</span></div>
      </div>
    </div>
    <p class="session-duration">Time spent: <strong>${elapsedLabel}</strong></p>
    <div class="review-heading">Your answer review <span>${wrongCount ? `${wrongCount} to revisit` : "Perfect score — every answer is right!"}</span></div>
    <div class="review-list">
      ${questions.map((question, index) => {
        const chosen = question.userAnswer;
        const correct = chosen === question.answer;
        return `<article class="review-item ${correct ? "review-right" : "review-missed"}">
          <p class="review-question"><strong>${index + 1}.</strong> ${escapeHtml(question.original)}</p>
          <div class="review-answer">
            ${chosen ? `<span>Your answer: <strong class="${correct ? "" : "your-wrong-answer"}">${escapeHtml(chosen)}</strong></span>` : `<span>Not answered</span>`}
            ${correct ? "" : `<span>Correct answer: <strong>${escapeHtml(question.answer)}</strong></span>`}
          </div>
        </article>`;
      }).join("")}
    </div>
    <div class="results-actions">
      <button class="secondary-button" type="button" id="review-again">Review my module</button>
      <button class="quiz-primary-button" type="button" id="try-again">Try another quiz</button>
    </div>`;
  resultsPanel.querySelector("#review-again").addEventListener("click", () => {
    setupPanel.hidden = false;
    resultsPanel.hidden = true;
    breadcrumbCurrent.textContent = "New quiz";
    moduleText.focus();
    setupPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  resultsPanel.querySelector("#try-again").addEventListener("click", () => {
    resultsPanel.hidden = true;
    startQuiz();
  });
  resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitQuiz() {
  if (questionTimerId !== null) {
    clearInterval(questionTimerId);
    questionTimerId = null;
  }
  quizPanel.hidden = true;
  setupPanel.hidden = false;
  breadcrumbCurrent.textContent = "New quiz";
  setupPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
