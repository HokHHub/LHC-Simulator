import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function cleanTextFromRoot(root) {
  if (!root) return "";

  const clone = root.cloneNode(true);

  // не читаем мусор
  clone.querySelectorAll("script, style, noscript, svg, canvas").forEach((n) => n.remove());
  // скрытое и помеченное
  clone.querySelectorAll('[aria-hidden="true"], [data-tts-ignore="true"]').forEach((n) => n.remove());

  // inputs/textarea — читаем value
  clone.querySelectorAll("input, textarea").forEach((el) => {
    const val = el.value || el.getAttribute("value") || "";
    if (val) el.replaceWith(document.createTextNode(val));
  });

  return (clone.innerText || "").replace(/\s+/g, " ").trim();
}

function splitText(text, maxLen = 180) {
  if (!text) return [];
  const parts = text
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];
  for (const p of parts) {
    if (p.length <= maxLen) chunks.push(p);
    else {
      const words = p.split(" ");
      let buf = "";
      for (const w of words) {
        const next = buf ? `${buf} ${w}` : w;
        if (next.length > maxLen) {
          chunks.push(buf);
          buf = w;
        } else buf = next;
      }
      if (buf) chunks.push(buf);
    }
  }
  return chunks;
}

export function usePageTTS({
  rootSelector = "main, #root",
  lang = "ru-RU",
  rate = 1,
  pitch = 1,
  volume = 1,
} = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const queueRef = useRef([]);
  const idxRef = useRef(0);

  const supported = useMemo(
    () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    []
  );

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    idxRef.current = 0;
    setIsSpeaking(false);
  }, [supported]);

  const toggleSpeak = useCallback(() => {
    if (!supported) return;

    // повторное нажатие — выключаем
    if (isSpeaking) {
      stop();
      return;
    }

    const root = document.querySelector(rootSelector) || document.body;
    const text = cleanTextFromRoot(root);
    if (!text) return;

    const chunks = splitText(text);
    queueRef.current = chunks;
    idxRef.current = 0;

    const voice =
      voices.find((v) => (v.lang || "").toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) || voices[0];

    const speakNext = () => {
      const q = queueRef.current;
      const i = idxRef.current;

      if (!q.length || i >= q.length) {
        setIsSpeaking(false);
        return;
      }

      const u = new SpeechSynthesisUtterance(q[i]);
      u.lang = voice?.lang || lang;
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;

      u.onend = () => {
        idxRef.current += 1;
        speakNext();
      };
      u.onerror = () => stop();

      window.speechSynthesis.speak(u);
    };

    setIsSpeaking(true);
    speakNext();
  }, [supported, isSpeaking, stop, voices, lang, rate, pitch, volume, rootSelector]);

  // если вкладку закрыли/перешли — стоп
  useEffect(() => stop, [stop]);

  return { supported, isSpeaking, toggleSpeak, stop };
}
