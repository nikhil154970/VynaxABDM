import { useCallback, useEffect, useRef, useState } from "react";

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  supported: boolean;
  ttsMode: "backend" | "browser" | "none";
}

function findEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const byNameAndLang = voices.find(
    (v) => /english|en-US|en-GB|en-AU|en-IN/i.test(v.name) && (v.lang.startsWith("en")),
  );
  if (byNameAndLang) return byNameAndLang;
  const byLang = voices.find((v) => v.lang.startsWith("en-US")) || voices.find((v) => v.lang.startsWith("en-GB")) || voices.find((v) => v.lang.startsWith("en-IN"));
  if (byLang) return byLang;
  const byName = voices.find((v) => /english|en-US|en-GB/i.test(v.name));
  if (byName) return byName;
  return voices.find((v) => v.lang.startsWith("en")) || null;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [speaking, setSpeaking] = useState(false);
  const [ttsMode, setTtsMode] = useState<"backend" | "browser" | "none">("none");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const readyRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;

    const dumpVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log(`[TTS] ${voices.length} voices available`);
      voices.forEach((v) => console.log(`  · ${v.name} (${v.lang}) ${v.default ? "[default]" : ""}`));
      const picked = findEnglishVoice();
      if (picked) {
        console.log(`[TTS] picked → ${picked.name} (${picked.lang})`);
      } else {
        console.warn("[TTS] no English voice found — using browser default");
      }
      readyRef.current = true;
    };

    dumpVoices();
    window.speechSynthesis.onvoiceschanged = dumpVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [supported]);

  const speakViaBackend = useCallback(async (text: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/assistant/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: "en" }),
      });
      if (!res.ok) {
        console.warn(`[TTS] backend returned ${res.status}`);
        return false;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.volume = 1;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        audio.play().catch((e) => { URL.revokeObjectURL(url); reject(e); });
      });
      return true;
    } catch (err) {
      console.warn("[TTS] backend failed, falling back to browser:", err);
      return false;
    }
  }, []);

  const speakViaBrowser = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    const voice = findEnglishVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;

    setSpeaking(true);

    speakViaBackend(text).then((ok) => {
      if (ok) {
        setTtsMode("backend");
        setSpeaking(false);
      } else {
        setTtsMode("browser");
        speakViaBrowser(text);
      }
    });
  }, [supported, speakViaBackend, speakViaBrowser]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported, ttsMode };
}
