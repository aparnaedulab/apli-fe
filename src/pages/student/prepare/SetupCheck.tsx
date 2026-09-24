import { useEffect, useRef, useState } from 'react';

type Light = 'dark' | 'good' | 'bright' | null;

/**
 * A camera and microphone check for online interviews.
 *
 * It checks the set-up - is there enough light, can the microphone hear you -
 * and never the person. The only thing read from the picture is its average
 * brightness, and nothing leaves the browser: no frame, no sound, no number.
 * Everything stops the moment the student leaves the page or presses Stop.
 */
export default function SetupCheck() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [state, setState] = useState<'idle' | 'starting' | 'on' | 'denied' | 'unavailable'>('idle');
  const [light, setLight] = useState<Light>(null);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioRef.current?.close().catch(() => undefined);
    audioRef.current = null;
    setState((s) => (s === 'on' || s === 'starting' ? 'idle' : s));
    setLevel(0);
  }

  useEffect(() => stop, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    setState('starting');
    setHeard(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      let analyser: AnalyserNode | null = null;
      if (Ctx && stream.getAudioTracks().length) {
        const ctx = new Ctx();
        audioRef.current = ctx;
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
      }
      const samples = analyser ? new Uint8Array(analyser.fftSize) : null;

      let frame = 0;
      const tick = () => {
        frame++;
        // Brightness every ten frames is plenty, and keeps a slow laptop cool.
        if (frame % 10 === 0) setLight(measureLight(videoRef.current, canvasRef.current));
        if (analyser && samples) {
          analyser.getByteTimeDomainData(samples);
          let peak = 0;
          for (const v of samples) peak = Math.max(peak, Math.abs(v - 128));
          const l = Math.min(1, peak / 64);
          setLevel(l);
          if (l > 0.18) setHeard(true);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setState('on');
    } catch (err) {
      const name = (err as { name?: string }).name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }

  return (
    <div className="setup">
      <p className="setup-privacy">
        This check runs only in your browser. Nothing is recorded or uploaded, and it looks at the light in the room - never at
        you.
      </p>

      <div className="setup-grid">
        <div className="setup-video">
          <video ref={videoRef} muted playsInline aria-label="Your camera preview" />
          {state !== 'on' && (
            <div className="setup-overlay">
              {state === 'denied' ? (
                <p>
                  Your browser blocked the camera or microphone. Allow them from the lock icon next to the address, then try
                  again.
                </p>
              ) : state === 'unavailable' ? (
                <p>No camera or microphone was found, or this browser cannot use them here.</p>
              ) : (
                <p>See your set-up the way an interviewer will.</p>
              )}
              <button type="button" className="btn btn-primary" onClick={start} disabled={state === 'starting'}>
                {state === 'starting' ? 'Starting…' : 'Start the check'}
              </button>
            </div>
          )}
          {/* Eye-level guide: the top third of the frame is where your eyes should sit. */}
          {state === 'on' && <div className="setup-guide" aria-hidden="true" />}
          <canvas ref={canvasRef} width={64} height={36} hidden />
        </div>

        <ul className="setup-results">
          <li className={light === 'good' ? 'ok' : light ? 'warn' : ''}>
            <strong>Light</strong>
            <span>
              {light === null
                ? 'Waiting for the camera'
                : light === 'good'
                  ? 'Good - your face will be clearly visible'
                  : light === 'dark'
                    ? 'Too dark - face a window or put a lamp in front of you'
                    : 'Too bright - move away from a window behind you, or dim a light'}
            </span>
          </li>
          <li className={heard ? 'ok' : state === 'on' ? 'warn' : ''}>
            <strong>Microphone</strong>
            <span>{heard ? 'We can hear you' : state === 'on' ? 'Say a few words at your normal volume' : 'Waiting for the microphone'}</span>
            <span className="setup-meter" aria-hidden="true">
              <span style={{ width: `${Math.round(level * 100)}%` }} />
            </span>
          </li>
          <li>
            <strong>Framing</strong>
            <span>Camera at eye level, your eyes on the top line of the guide, head and shoulders in view.</span>
          </li>
          <li>
            <strong>Background</strong>
            <span>A plain wall or a tidy corner. Tell people at home the time of your interview.</span>
          </li>
          {state === 'on' && (
            <li className="setup-stop">
              <button type="button" className="btn btn-secondary" onClick={stop}>
                Stop the check
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Average brightness of a tiny copy of the frame - the only thing read from the picture. */
function measureLight(video: HTMLVideoElement | null, canvas: HTMLCanvasElement | null): Light {
  if (!video || !canvas || video.readyState < 2) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
  const avg = sum / (data.length / 4);
  return avg < 70 ? 'dark' : avg > 200 ? 'bright' : 'good';
}
