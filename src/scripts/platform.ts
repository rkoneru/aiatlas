/**
 * Platform shim: `window.claude.use(name)` with the contract the Atlas runtime expects,
 * implemented with browser APIs and the site's own AI proxy. Read the call sites
 * (docs/inventory-findings.md B12) before changing a shape here.
 *
 *   downloads -> { save({filename, data}) }                 Blob URL + <a download>
 *   tts       -> { speak, stop, setRate, onState, onLine }  window.speechSynthesis
 *   sample    -> sample(prompt|messages, opts) / .json / .limits   POST /api/claude
 *                (rejects unless PUBLIC_AI_ENABLED=true at build time)
 *   db, user  -> reject (Team mode is off, decision 4)
 *
 * Errors are Error objects with `.code` (and `.text` for partial output), the codes the
 * UI already handles: cancelled, rate_limited, invalid_json, unavailable, prompt_too_large…
 */
declare const __AI_ENABLED__: boolean;
declare const __AI_ENDPOINT__: string;

type Code = 'cancelled' | 'rate_limited' | 'invalid_json' | 'unavailable' | 'prompt_too_large' | 'refused' | 'empty_completion' | 'image_rejected' | 'declined' | 'no_gesture' | 'busy' | 'upstream_error' | string;
class CapError extends Error {
  code: Code; text?: string;
  constructor(code: Code, message?: string, text?: string) { super(message || code); this.code = code; if (text) this.text = text; }
}
const fail = (code: Code, msg?: string) => Promise.reject(new CapError(code, msg));

/* ---------------- downloads ---------------- */
const MIME: Record<string, string> = {
  svg: 'image/svg+xml', png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  html: 'text/html', htm: 'text/html', json: 'application/json', md: 'text/markdown', txt: 'text/plain', csv: 'text/csv',
  mmd: 'text/plain', js: 'text/javascript', css: 'text/css', xml: 'application/xml', pdf: 'application/pdf', yaml: 'text/yaml', yml: 'text/yaml',
};
const downloads = {
  async save({ filename, data }: { filename: string; data: string | Blob | ArrayBuffer | ArrayBufferView }) {
    const name = String(filename || 'download').replace(/[\\/:*?"<>|]+/g, '-');
    const ext = (name.split('.').pop() || '').toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const blob = data instanceof Blob ? data
      : typeof data === 'string' ? new Blob([data], { type: type.startsWith('text/') || type.endsWith('json') || type.endsWith('xml') || type.endsWith('svg+xml') ? type + ';charset=utf-8' : type })
      : new Blob([data as ArrayBuffer], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
};

/* ---------------- tts (speechSynthesis) ---------------- */
type Line = { text: string; id?: string };
function makeTts() {
  const synth = window.speechSynthesis;
  let rate = 1, run = 0;
  const stateCbs: Array<(s: { state: string; reason?: string }) => void> = [];
  const lineCbs: Array<(l: { id?: string }) => void> = [];
  const emit = (state: string, reason?: string) => stateCbs.forEach((f) => { try { f({ state, reason }); } catch { /* ignore */ } });
  // The Atlas offers four named voices; map them onto distinct installed English voices.
  const NAMES = ['buttery', 'airy', 'glassy', 'rounded'];
  const pickVoice = (name: string, lang: string) => {
    const all = synth.getVoices();
    const en = all.filter((v) => v.lang && v.lang.toLowerCase().startsWith((lang || 'en').toLowerCase().slice(0, 2)));
    const pool = (en.length ? en : all).slice().sort((a, b) => Number(b.localService) - Number(a.localService));
    if (!pool.length) return null;
    const i = Math.max(0, NAMES.indexOf(name));
    return pool[i % pool.length];
  };
  // Long utterances stall in some browsers; speak each line in sentence-sized chunks.
  const chunks = (t: string) => (String(t).match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [String(t)])
    .reduce<string[]>((acc, s) => { const last = acc[acc.length - 1]; if (last && (last + s).length < 220) acc[acc.length - 1] = last + s; else acc.push(s); return acc; }, [])
    .map((s) => s.trim()).filter(Boolean);
  const mapErr = (e: string): Code => (e === 'not-allowed' ? 'no_gesture' : e === 'interrupted' || e === 'canceled' ? 'cancelled' : 'unavailable');

  return {
    speak(input: string | Line[], opts: { voice?: string; rate?: number; language?: string } = {}) {
      const lines: Line[] = typeof input === 'string' ? [{ text: input }] : (input || []);
      synth.cancel();
      const my = ++run;
      if (typeof opts.rate === 'number') rate = opts.rate;
      const voice = pickVoice(opts.voice || 'buttery', opts.language || 'en');
      return new Promise<void>((resolve, reject) => {
        const queue: Array<{ text: string; id?: string; first: boolean }> = [];
        lines.forEach((l) => chunks(l.text || '').forEach((c, k) => queue.push({ text: c, id: l.id, first: k === 0 })));
        if (!queue.length) { resolve(); return; }
        emit('speaking');
        const next = (i: number) => {
          if (my !== run) { resolve(); return; }
          if (i >= queue.length) { emit('idle', 'done'); resolve(); return; }
          const q = queue[i];
          const u = new SpeechSynthesisUtterance(q.text);
          if (voice) u.voice = voice;
          u.lang = (voice && voice.lang) || opts.language || 'en';
          u.rate = rate;
          u.onstart = () => { if (q.first && my === run) lineCbs.forEach((f) => { try { f({ id: q.id }); } catch { /* ignore */ } }); };
          u.onend = () => next(i + 1);
          u.onerror = (ev) => {
            if (my !== run) { resolve(); return; }
            const code = mapErr(ev.error);
            if (code === 'cancelled') { resolve(); return; }
            emit('idle', code); reject(new CapError(code, ev.error));
          };
          synth.speak(u);
        };
        next(0);
      });
    },
    async stop() { run++; synth.cancel(); emit('idle', 'stopped'); },
    async setRate(r: number) { rate = +r || 1; },
    onState(cb: (s: { state: string; reason?: string }) => void) { stateCbs.push(cb); },
    onLine(cb: (l: { id?: string }) => void) { lineCbs.push(cb); },
  };
}

/* ---------------- sample (site AI proxy) ---------------- */
type SampleOpts = { signal?: AbortSignal; modelTier?: 'default' | 'quick'; cache?: boolean; onText?: (p: { text: string }) => void; images?: Blob[] };
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 3_750_000;

async function imageOf(b: Blob) {
  if (!IMAGE_TYPES.includes(b.type)) throw new CapError('image_rejected', 'unsupported image type');
  if (b.size > MAX_IMAGE_BYTES) throw new CapError('image_rejected', 'image too large');
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { media_type: b.type, data: btoa(bin) };
}

async function call(input: unknown, opts: SampleOpts, json: boolean): Promise<{ text: string; truncated: boolean }> {
  const body: Record<string, unknown> = { json, tier: opts.modelTier === 'quick' ? 'quick' : 'default' };
  if (Array.isArray(input)) body.messages = input; else body.prompt = String(input ?? '');
  if (opts.images && opts.images.length) body.images = await Promise.all(opts.images.map(imageOf));
  // Optional Cloudflare Turnstile (docs/ai-proxy.md): a page that renders the widget can set
  // window.atlasTurnstileToken = async () => token, and the proxy verifies it when TURNSTILE_SECRET is set.
  const ts = (window as any).atlasTurnstileToken;
  if (typeof ts === 'function') { try { body.turnstile = await ts(); } catch { /* proxy will refuse if required */ } }
  let res: Response;
  try {
    res = await fetch(__AI_ENDPOINT__, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: opts.signal, credentials: 'same-origin' });
  } catch (e: any) {
    if (e && e.name === 'AbortError') throw new CapError('cancelled');
    throw new CapError('unavailable', 'network error');
  }
  let payload: any = null;
  try { payload = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !payload || payload.error) {
    const code = payload?.error?.code || (res.status === 429 ? 'rate_limited' : res.status === 413 ? 'prompt_too_large' : 'unavailable');
    throw new CapError(code, payload?.error?.message);
  }
  const text = String(payload.text ?? '');
  if (!text.trim()) throw new CapError('empty_completion');
  return { text, truncated: !!payload.truncated };
}

/** Parse a model reply as JSON, tolerating code fences and prose around one object or array. */
function parseJSON(text: string) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const s = t.search(/[[{]/);
  const e = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch { /* fall through */ } }
  throw new CapError('invalid_json', 'reply was not JSON', text);
}

function makeSample() {
  const sample = async (input: unknown, opts: SampleOpts = {}) => {
    const r = await call(input, opts, false);
    if (opts.onText) { try { opts.onText({ text: r.text }); } catch { /* ignore */ } }
    return r;
  };
  sample.json = async (input: unknown, opts: SampleOpts = {}) => parseJSON((await call(input, opts, true)).text);
  sample.limits = async () => ({ images: { mediaTypes: IMAGE_TYPES.slice(), maxBytes: MAX_IMAGE_BYTES } });
  return sample;
}

/* ---------------- use() ---------------- */
function use(name: string): Promise<unknown> {
  switch (name) {
    case 'downloads': return Promise.resolve(downloads);
    case 'tts': return typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
      ? Promise.resolve(makeTts()) : fail('unavailable', 'speech synthesis is not supported in this browser');
    case 'sample': return __AI_ENABLED__ ? Promise.resolve(makeSample()) : fail('unavailable', 'AI features are turned off on this site');
    case 'db': case 'user': return fail('unavailable', 'Team mode is not available on this site');
    default: return fail('unavailable', `unknown capability: ${name}`);
  }
}

(window as any).claude = Object.assign((window as any).claude || {}, { use });
export {};
