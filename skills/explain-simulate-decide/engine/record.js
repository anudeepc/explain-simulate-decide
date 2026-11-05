// Records the film frame by frame (fixed time step, so every frame is exact),
// encodes with WebCodecs and muxes to MP4 in the browser. No server, no ffmpeg.
import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.mjs';

const VIDEO_CODECS = [
  ['avc1.640033', 'avc'],
  ['avc1.4d0033', 'avc'],
  ['avc1.42003e', 'avc'],
  ['vp09.00.40.08', 'vp9'],
];

async function pickVideo(width, height, fps) {
  if (!('VideoEncoder' in globalThis)) throw new Error('This browser cannot record video (WebCodecs missing). Try Chrome or Edge.');
  for (const [codec, mux] of VIDEO_CODECS) {
    const config = { codec, width, height, bitrate: 8_000_000, framerate: fps };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, mux };
    } catch {}
  }
  throw new Error('No supported video codec for recording.');
}

async function pickAudio() {
  if (!('AudioEncoder' in globalThis)) return null;
  const config = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160_000 };
  try {
    return (await AudioEncoder.isConfigSupported(config)).supported ? config : null;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   total: number,
 *   drawFrame: (t: number) => HTMLCanvasElement|OffscreenCanvas,
 *   renderAudio?: (sampleRate: number) => Promise<AudioBuffer|null>,
 * }} film
 * @param {{width?: number, height?: number, fps?: number, onProgress?: (p: number) => void, signal?: AbortSignal}} [o]
 * @returns {Promise<Blob>}
 */
export async function recordFilm(film, { width = 1920, height = 1080, fps = 60, onProgress = () => {}, signal } = {}) {
  const video = await pickVideo(width, height, fps);
  const audioConfig = film.renderAudio ? await pickAudio() : null;
  const audio = audioConfig ? await film.renderAudio(audioConfig.sampleRate) : null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: video.mux, width, height, frameRate: fps },
    ...(audio ? { audio: { codec: 'aac', sampleRate: audioConfig.sampleRate, numberOfChannels: 2 } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let failure = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
  venc.configure(video.config);

  const frames = Math.ceil(film.total * fps);
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) throw new Error('Recording cancelled');
    if (failure) throw failure;
    const canvas = film.drawFrame(i / fps);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    venc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    if (venc.encodeQueueSize > 6) await new Promise((r) => venc.addEventListener('dequeue', r, { once: true }));
    if (i % 15 === 0) {
      onProgress((i / frames) * (audio ? 0.95 : 1));
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await venc.flush();

  if (audio) {
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => (failure = e) });
    aenc.configure(audioConfig);
    const block = 4800;
    const L = audio.getChannelData(0);
    const R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
    for (let s = 0; s < audio.length; s += block) {
      const n = Math.min(block, audio.length - s);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(s, s + n), 0);
      data.set(R.subarray(s, s + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: audio.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((s / audio.sampleRate) * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
  }
  if (failure) throw failure;
  muxer.finalize();
  onProgress(1);
  return new Blob([target.buffer], { type: 'video/mp4' });
}
