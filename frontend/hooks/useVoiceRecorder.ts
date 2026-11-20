import { useCallback, useEffect, useRef, useState } from 'react';

// Records a voice note in the browser (MediaRecorder): Chrome and Edge make WebM/Opus, Safari
// makes MP4/AAC. A live level meter shows the microphone is hearing you.

export const MAX_VOICE_SECONDS = 5 * 60;

const pickType = () => {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) ?? '';
};

export const voiceSupported = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

export type RecorderState = 'idle' | 'recording';

export const useVoiceRecorder = (onError: (message: string) => void) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0));
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const timer = useRef(0);
  const finish = useRef<((file: File | null) => void) | null>(null);
  const keep = useRef(true);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(frame.current);
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    audio.current?.close().catch(() => {});
    audio.current = null;
    recorder.current = null;
    setState('idle');
    setSeconds(0);
    setLevels(Array(28).fill(0));
  }, []);

  useEffect(() => () => { keep.current = false; recorder.current?.state === 'recording' && recorder.current.stop(); cleanup(); }, [cleanup]);

  const start = useCallback(async () => {
    if (!voiceSupported()) { onError('Voice notes need a browser with microphone recording (Chrome, Edge, Firefox or Safari).'); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      const type = pickType();
      const rec = new MediaRecorder(media, type ? { mimeType: type, audioBitsPerSecond: 48_000 } : undefined);
      chunks.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        const mime = (rec.mimeType || type || 'audio/webm').split(';')[0];
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        const stamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
        const blob = new Blob(chunks.current, { type: mime });
        const file = keep.current && blob.size > 0 ? new File([blob], `Voice note ${stamp}.${ext}`, { type: mime }) : null;
        cleanup();
        finish.current?.(file);
        finish.current = null;
      };
      recorder.current = rec;
      keep.current = true;
      rec.start(250);
      setState('recording');

      // Level meter from the live signal.
      const ctx = new AudioContext();
      audio.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const tick = (t: number) => {
        if (t - last > 90) {
          last = t;
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setLevels(current => [...current.slice(1), Math.min(1, peak / 64)]);
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);

      const began = Date.now();
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000);
        setSeconds(s);
        if (s >= MAX_VOICE_SECONDS && recorder.current?.state === 'recording') recorder.current.stop();
      }, 250);
    } catch (error) {
      cleanup();
      const name = (error as DOMException)?.name;
      onError(name === 'NotAllowedError' ? 'Microphone access is blocked. Allow it in the browser to record a voice note.'
        : name === 'NotFoundError' ? 'No microphone was found.' : "Couldn't start recording.");
    }
  }, [cleanup, onError]);

  /** Stops and returns the recording (null if it was empty). */
  const stop = useCallback(() => new Promise<File | null>(resolve => {
    const rec = recorder.current;
    if (!rec || rec.state !== 'recording') { resolve(null); return; }
    keep.current = true;
    finish.current = resolve;
    rec.stop();
  }), []);

  /** Stops and throws the recording away. */
  const cancel = useCallback(() => {
    const rec = recorder.current;
    keep.current = false;
    finish.current = null;
    if (rec && rec.state === 'recording') rec.stop(); else cleanup();
  }, [cleanup]);

  return { state, seconds, levels, start, stop, cancel };
};

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
