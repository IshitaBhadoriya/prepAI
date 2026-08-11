import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const DEEPGRAM_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&punctuate=true&filler_words=true";
const TIMESLICE_MS = 250;

function getMicrophoneMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const supportedTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];

  return (
    supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ""
  );
}

function normalizeDeepgramWords(words) {
  return Array.isArray(words)
    ? words
        .map((item) => ({
          word: String(item?.word || item?.punctuated_word || "").trim(),
          start: Number(item?.start),
          end: Number(item?.end),
          confidence: Number(item?.confidence),
        }))
        .filter(
          (item) =>
            item.word &&
            Number.isFinite(item.start) &&
            Number.isFinite(item.end),
        )
    : [];
}

export function useDeepgramTranscription() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [words, setWords] = useState([]);
  const [duration, setDuration] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const [isSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof WebSocket !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const socketRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const accumulatedDurationRef = useRef(0);
  const manuallyStoppedRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const isConnectingRef = useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  function updateTranscript() {
    setTranscript(
      `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim(),
    );
  }

  const cleanup = useCallback(() => {
    clearTimer();
    isConnectingRef.current = false;
    setIsConnecting(false);

    const recorder = recorderRef.current;
    const socket = socketRef.current;
    const stream = streamRef.current;

    recorderRef.current = null;
    socketRef.current = null;
    streamRef.current = null;

    const finalizeSocket = () => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "CloseStream" }));
        // Give Deepgram a brief window to flush the final transcript for the
        // last audio chunk before we close our end of the connection.
        window.setTimeout(() => {
          if (socket.readyState !== WebSocket.CLOSED) socket.close();
        }, 1200);
      } else if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };

    if (recorder && recorder.state !== "inactive") {
      // The recorder's final ondataavailable (triggered by stop()) fires
      // before its "stop" event — wait for that before tearing the
      // socket down, or the last chunk of audio gets silently dropped.
      recorder.addEventListener("stop", finalizeSocket, { once: true });
      recorder.stop();
    } else {
      finalizeSocket();
    }

    setIsListening(false);
  }, [clearTimer]);

  function fail(message) {
    setConnectionError(message);
    cleanup();
  }

  async function fetchToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Please sign in again before using voice recognition.");
    }

    const response = await fetch("/api/deepgram-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          `Deepgram token request failed with status ${response.status}.`,
      );
    }

    if (!data?.token) {
      throw new Error("Deepgram token response was missing a token.");
    }

    return data.token;
  }

  async function startListening() {
    if (!isSupported || isListening || isConnectingRef.current) return;

    isConnectingRef.current = true;
    setIsConnecting(true);
    manuallyStoppedRef.current = false;
    // Transcript/words/duration are intentionally NOT cleared here — clearing
    // only happens in resetTranscript(), called when moving to a new question.
    // This lets stopping and restarting the mic mid-answer keep what was
    // already said instead of wiping it.
    setConnectionError(null);

    try {
      const token = await fetchToken();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const socket = new WebSocket(DEEPGRAM_URL, ["bearer", token]);
      const mimeType = getMicrophoneMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      socketRef.current = socket;
      recorderRef.current = recorder;

      socket.onopen = () => {
        isConnectingRef.current = false;
        setIsConnecting(false);
        startedAtRef.current = Date.now();
        setIsListening(true);
        timerRef.current = window.setInterval(() => {
          setDuration(
            accumulatedDurationRef.current +
              (Date.now() - startedAtRef.current) / 1000,
          );
        }, 250);
        recorder.start(TIMESLICE_MS);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type !== "Results") return;

        const alternative = data.channel?.alternatives?.[0];
        const nextTranscript = String(alternative?.transcript || "").trim();
        const nextWords = normalizeDeepgramWords(alternative?.words);

        if (nextWords.length > 0 && data.is_final) {
          setWords((current) => [...current, ...nextWords]);
        }

        if (!nextTranscript) return;

        if (data.is_final) {
          finalTranscriptRef.current =
            `${finalTranscriptRef.current} ${nextTranscript}`.trim();
          interimTranscriptRef.current = "";
        } else {
          interimTranscriptRef.current = nextTranscript;
        }
        updateTranscript();
      };

      socket.onerror = () => {
        fail("Deepgram voice recognition could not connect.");
      };

      socket.onclose = (event) => {
        if (!manuallyStoppedRef.current && !event.wasClean) {
          fail("Deepgram voice recognition disconnected unexpectedly.");
          return;
        }

        clearTimer();
        setIsListening(false);
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };

      recorder.onerror = () => {
        fail("Microphone recording failed.");
      };
    } catch (error) {
      fail(error?.message || "Deepgram voice recognition failed.");
    }
  }

  function stopListening() {
    if (!isListening && !socketRef.current && !recorderRef.current) return;
    manuallyStoppedRef.current = true;
    if (startedAtRef.current) {
      accumulatedDurationRef.current +=
        (Date.now() - startedAtRef.current) / 1000;
    }
    setDuration(accumulatedDurationRef.current);
    cleanup();
  }

  function resetTranscript() {
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    accumulatedDurationRef.current = 0;
    setTranscript("");
    setWords([]);
    setDuration(0);
    setConnectionError(null);
  }

  useEffect(() => {
    return () => {
      manuallyStoppedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    words,
    duration,
    connectionError,
    isConnecting,
  };
}
