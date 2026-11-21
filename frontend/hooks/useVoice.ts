import { useCallback, useEffect, useRef, useState } from 'react';

// Browser speech for Nova: wake-word listening, one-shot command capture, and spoken replies.
// Uses the Web Speech API (Chrome and Edge). In Chrome, recognised audio is processed by Google.

export type VoiceState = 'off' | 'waiting' | 'listening' | 'speaking';

const SpeechRecognitionImpl: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

export const speechSupported = Boolean(SpeechRecognitionImpl);

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Finds "hey nova ..." (or "ok/hi nova", or just "nova ...") and returns what follows the name. */
export const matchWakeWord = (transcript: string, name: string): string | null => {
  const text = normalise(transcript);
  const wake = normalise(name);
  const match = text.match(new RegExp(`(?:^|\\b)(?:(?:hey|hi|ok|okay|hello)\\s+)?${wake}\\b(.*)$`));
  return match ? match[1].trim() : null;
};

interface Options {
  name: string;
  wakeEnabled: boolean;
  onCommand: (text: string) => void;
  onError: (message: string) => void;
}

export const useVoice = ({ name, wakeEnabled, onCommand, onError }: Options) => {
  const [state, setState] = useState<VoiceState>('off');
  const [heard, setHeard] = useState('');
  const recognition = useRef<any>(null);
  const mode = useRef<'idle' | 'wake' | 'command'>('idle');
  const busy = useRef(false); // true while a command is being answered or spoken
  const latest = useRef({ name, wakeEnabled, onCommand, onError });
  latest.current = { name, wakeEnabled, onCommand, onError };

  const stop = useCallback(() => {
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onend = null;
      current.onresult = null;
      current.onerror = null;
      try { current.abort(); } catch { /* already stopped */ }
    }
  }, []);

  const start = useCallback((next: 'wake' | 'command') => {
    if (!SpeechRecognitionImpl) return;
    stop();
    mode.current = next;
    const rec = new SpeechRecognitionImpl();
    rec.lang = 'en-US';
    rec.continuous = next === 'wake';
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript: string = result[0].transcript;
      setHeard(transcript);
      if (mode.current === 'wake') {
        const rest = matchWakeWord(transcript, latest.current.name);
        if (rest === null) return;
        if (result.isFinal && rest.split(' ').length >= 2) {
          // "Hey Nova, remind me ..." in one breath
          busy.current = true;
          stop();
          latest.current.onCommand(rest);
        } else if (result.isFinal || rest === '') {
          start('command');
        }
      } else if (result.isFinal) {
        busy.current = true;
        stop();
        setState('off');
        const command = matchWakeWord(transcript, latest.current.name) || transcript;
        if (command.trim()) latest.current.onCommand(command.trim());
        else busy.current = false;
      }
    };
    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        latest.current.onError('Microphone access is blocked. Allow it in the browser to talk to Nova.');
        mode.current = 'idle';
      } else if (event.error === 'audio-capture') {
        latest.current.onError('No microphone was found.');
        mode.current = 'idle';
      }
    };
    rec.onend = () => {
      recognition.current = null;
      if (busy.current) return;
      // Chrome ends recognition after silence; keep waiting for the wake word while it's on.
      if (mode.current !== 'idle' && latest.current.wakeEnabled) {
        window.setTimeout(() => !busy.current && recognition.current === null && start('wake'), 250);
      } else {
        mode.current = 'idle';
        setState('off');
      }
    };

    try {
      rec.start();
      recognition.current = rec;
      setState(next === 'wake' ? 'waiting' : 'listening');
    } catch {
      /* start() throws if a session is already running; the onend restart covers it */
    }
  }, [stop]);

  /** Tap-to-talk: listen for one command now. */
  const listen = useCallback(() => {
    if (!SpeechRecognitionImpl) {
      latest.current.onError('Voice needs Chrome or Edge. You can type to Nova instead.');
      return;
    }
    window.speechSynthesis?.cancel();
    busy.current = false;
    start('command');
  }, [start]);

  /** Speaks a reply, then goes back to waiting (or listens again when Nova asked a question). */
  const speak = useCallback((text: string, muted: boolean) => {
    const resume = () => {
      busy.current = false;
      if (text.trim().endsWith('?')) start('command');
      else if (latest.current.wakeEnabled) start('wake');
      else setState('off');
    };
    if (muted || !('speechSynthesis' in window)) {
      resume();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find(v => /en-(GB|US)/.test(v.lang) && /Google|Natural|Microsoft/.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en')) ||
      null;
    utterance.rate = 1.03;
    utterance.onend = resume;
    utterance.onerror = resume;
    setState('speaking');
    window.speechSynthesis.speak(utterance);
  }, [start]);

  /** Call when a command finished without speaking (e.g. it failed). */
  const done = useCallback(() => {
    busy.current = false;
    if (latest.current.wakeEnabled) start('wake');
    else setState('off');
  }, [start]);

  // Turn wake-word listening on and off with the setting.
  useEffect(() => {
    if (!SpeechRecognitionImpl) return;
    if (wakeEnabled && mode.current === 'idle' && !busy.current) start('wake');
    if (!wakeEnabled && mode.current === 'wake') {
      mode.current = 'idle';
      stop();
      setState('off');
    }
  }, [wakeEnabled, start, stop]);

  useEffect(() => () => { mode.current = 'idle'; stop(); window.speechSynthesis?.cancel(); }, [stop]);

  return { state, heard, listen, speak, done };
};
