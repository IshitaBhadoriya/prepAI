import { useState, useEffect, useRef } from "react";

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  const recognitionRef = useRef(null);
  // Text carried over from previous start/stop cycles within the same
  // question. The browser's SpeechRecognition API starts a brand-new,
  // empty results list on every .start() call, so without this, stopping
  // and restarting the mic mid-answer would silently discard everything
  // said before the restart.
  const baseTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let sessionTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        sessionTranscript += event.results[i][0].transcript;
      }
      const base = baseTranscriptRef.current;
      setTranscript(
        base ? `${base} ${sessionTranscript}`.trim() : sessionTranscript,
      );
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  function startListening() {
    if (!recognitionRef.current || isListening) return;
    // Do NOT clear transcript here — baseTranscriptRef already holds
    // whatever was said in earlier start/stop cycles for this question,
    // and onresult will combine it with this new session's results.
    recognitionRef.current.start();
    setIsListening(true);
  }

  function stopListening() {
    if (!recognitionRef.current || !isListening) return;
    // Persist what's been said so far before the browser wipes its
    // internal results list on the next .start() call.
    baseTranscriptRef.current = transcript;
    recognitionRef.current.stop();
    setIsListening(false);
  }

  function resetTranscript() {
    baseTranscriptRef.current = "";
    setTranscript("");
  }

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
