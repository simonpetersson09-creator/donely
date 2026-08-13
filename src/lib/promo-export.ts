import { toCanvas } from "html-to-image";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";

export const PROMO_W = 1080;
export const PROMO_H = 1920;
export const PROMO_FPS = 30;

const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export type ExportProgress = (done: number, total: number) => void;

/**
 * Renders the promo stage frame-by-frame (deterministic clock) and encodes an
 * H.264 MP4 with WebCodecs. Falls back to a WebM MediaRecorder pipeline when
 * WebCodecs/H.264 is unavailable.
 */
export async function exportPromoVideo(opts: {
  stage: HTMLElement;
  durationMs: number;
  setTime: (t: number) => void;
  onProgress?: ExportProgress;
}): Promise<{ blob: Blob; filename: string }> {
  const { stage, durationMs, setTime, onProgress } = opts;
  const total = Math.round((durationMs / 1000) * PROMO_FPS);

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = PROMO_W;
  captureCanvas.height = PROMO_H;
  const ctx = captureCanvas.getContext("2d")!;

  const h264 = await supportsH264();

  let encoder: VideoEncoder | null = null;
  let muxer: Muxer<ArrayBufferTarget> | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recorderTrack: CanvasCaptureMediaStreamTrack | null = null;

  if (h264) {
    muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width: PROMO_W, height: PROMO_H },
      fastStart: "in-memory",
    });
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer!.addVideoChunk(chunk, meta),
      error: (e) => console.error(e),
    });
    encoder.configure({
      codec: "avc1.640034",
      width: PROMO_W,
      height: PROMO_H,
      bitrate: 16_000_000,
      framerate: PROMO_FPS,
      latencyMode: "quality",
    });
  } else {
    const stream = captureCanvas.captureStream(0);
    recorderTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
      videoBitsPerSecond: 16_000_000,
    });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start();
  }

  for (let i = 0; i < total; i++) {
    setTime((i / PROMO_FPS) * 1000);
    await nextFrame();

    const frameCanvas = await toCanvas(stage, {
      width: PROMO_W,
      height: PROMO_H,
      canvasWidth: PROMO_W,
      canvasHeight: PROMO_H,
      pixelRatio: 1,
      cacheBust: false,
    });
    ctx.clearRect(0, 0, PROMO_W, PROMO_H);
    ctx.drawImage(frameCanvas, 0, 0, PROMO_W, PROMO_H);

    if (encoder) {
      const frame = new VideoFrame(captureCanvas, {
        timestamp: Math.round((i / PROMO_FPS) * 1_000_000),
        duration: Math.round(1_000_000 / PROMO_FPS),
      });
      encoder.encode(frame, { keyFrame: i % PROMO_FPS === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 8) await encoder.flush();
    } else if (recorderTrack) {
      recorderTrack.requestFrame();
      // MediaRecorder is realtime; give it a tick per frame.
      await new Promise((r) => setTimeout(r, 1000 / PROMO_FPS));
    }

    onProgress?.(i + 1, total);
  }

  if (encoder && muxer) {
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    const buf = (muxer.target as ArrayBufferTarget).buffer;
    return { blob: new Blob([buf], { type: "video/mp4" }), filename: "donely-promo.mp4" };
  }

  await new Promise<void>((res) => {
    recorder!.onstop = () => res();
    recorder!.stop();
  });
  return { blob: new Blob(chunks, { type: "video/webm" }), filename: "donely-promo.webm" };
}

async function supportsH264() {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    const { supported } = await VideoEncoder.isConfigSupported({
      codec: "avc1.640034",
      width: PROMO_W,
      height: PROMO_H,
      bitrate: 16_000_000,
      framerate: PROMO_FPS,
    });
    return !!supported;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
