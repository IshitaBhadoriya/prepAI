export const CONFIDENCE_THRESHOLD = 0.6;

const EMPTY_FILLERS = { um: 0, uh: 0, like: 0 };

function normalizeText(value) {
  return String(value || "").trim();
}

function countFillerWords(text) {
  const trimmed = normalizeText(text);
  const countMatches = (pattern) => (trimmed.match(pattern) || []).length;

  return {
    um: countMatches(/\bumm?\b/gi),
    uh: countMatches(/\buhh?\b/gi),
    like: countMatches(/\blike\b/gi),
  };
}

function tokenize(text) {
  return (
    normalizeText(text)
      .toLowerCase()
      .match(/\b[\w']+\b/g) || []
  );
}

function findRepeatedPhrases(transcript) {
  const tokens = tokenize(transcript);
  const phraseCounts = new Map();

  for (let size = 3; size <= tokens.length; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }

  return [...phraseCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort(
      (a, b) => b[1] - a[1] || b[0].split(" ").length - a[0].split(" ").length,
    )
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

function computePlainTextMetrics(transcript, duration) {
  const trimmed = normalizeText(transcript);

  if (!trimmed) {
    return {
      fillerWords: EMPTY_FILLERS,
      wordsPerMinute: 0,
      longestPauseSeconds: null,
      averagePauseSeconds: null,
      repeatedPhrases: [],
      usedRealTimestamps: false,
    };
  }

  const wordCount = trimmed.split(/\s+/).length;
  const minutes = duration > 0 ? duration / 60 : 0;

  return {
    fillerWords: countFillerWords(trimmed),
    wordsPerMinute: minutes > 0 ? Math.round(wordCount / minutes) : 0,
    longestPauseSeconds: null,
    averagePauseSeconds: null,
    repeatedPhrases: findRepeatedPhrases(trimmed),
    usedRealTimestamps: false,
  };
}

function normalizeWordEntry(entry) {
  const word = normalizeText(entry?.word || entry?.punctuated_word);
  const start = Number(entry?.start);
  const end = Number(entry?.end);
  const confidence = Number(entry?.confidence);

  if (!word || !Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return {
    word,
    start,
    end,
    confidence: Number.isFinite(confidence) ? confidence : 1,
  };
}

export function computeSpeechMetrics({ transcript, words, duration } = {}) {
  const usableWords = Array.isArray(words)
    ? words
        .map(normalizeWordEntry)
        .filter(Boolean)
        .filter((word) => word.confidence >= CONFIDENCE_THRESHOLD)
    : [];

  if (usableWords.length === 0) {
    return computePlainTextMetrics(transcript, Number(duration) || 0);
  }

  const spokenText = usableWords.map((item) => item.word).join(" ");
  const firstWordStart = usableWords[0].start;
  const lastWordEnd = usableWords[usableWords.length - 1].end;
  const measuredSeconds = Math.max(lastWordEnd - firstWordStart, 0);
  const minutes = measuredSeconds > 0 ? measuredSeconds / 60 : 0;
  const pauses = [];

  for (let index = 1; index < usableWords.length; index += 1) {
    pauses.push(
      Math.max(0, usableWords[index].start - usableWords[index - 1].end),
    );
  }

  const totalPauseSeconds = pauses.reduce((sum, pause) => sum + pause, 0);

  return {
    fillerWords: countFillerWords(spokenText),
    wordsPerMinute: minutes > 0 ? Math.round(usableWords.length / minutes) : 0,
    longestPauseSeconds: pauses.length > 0 ? Math.max(...pauses) : 0,
    averagePauseSeconds:
      pauses.length > 0 ? totalPauseSeconds / pauses.length : 0,
    repeatedPhrases: findRepeatedPhrases(transcript),
    usedRealTimestamps: true,
  };
}
export function getPacingLabel(wpm) {
  if (!wpm) return null;
  if (wpm < 110) return "Slow";
  if (wpm > 160) return "Fast";
  return "Good pace";
}
