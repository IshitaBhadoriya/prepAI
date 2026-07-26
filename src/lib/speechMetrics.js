export function computeSpeechMetrics(text, elapsedSeconds) {
  const trimmed = (text || "").trim();

  if (!trimmed) {
    return { fillerWords: { um: 0, uh: 0, like: 0 }, wordsPerMinute: 0 };
  }

  const wordCount = trimmed.split(/\s+/).length;

  const countMatches = (pattern) => (trimmed.match(pattern) || []).length;

  const fillerWords = {
    um: countMatches(/\bumm?\b/gi),
    uh: countMatches(/\buhh?\b/gi),
    like: countMatches(/\blike\b/gi),
  };

  const minutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;
  const wordsPerMinute = minutes > 0 ? Math.round(wordCount / minutes) : 0;

  return { fillerWords, wordsPerMinute };
}
