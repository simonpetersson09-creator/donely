import { toCanvas } from "html-to-image";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebMTarget, Muxer as WebMMuxer } from "webm-muxer";

export const PROMO_W = 1080;
export const PROMO_H = 1920;
export const PROMO_FPS = 30;

const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export type ExportProgress = (done: number, total: number) => void;

const H264_CANDIDATES = ["avc1.640034", "avc1.640033", "avc1.4d0034", "avc1.42003c"];
const VP9_CANDIDATES = ["vp09.00.51.08", "vp09.00.10.08", "vp8"];

async function pickCodec(list: string[]) {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of list) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec,
        width: PROMO_W,
        height: PROMO_H,
        bitrate: 12_000_000,
        framerate: PROMO_FPS,
      });
      if (supported) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Renders the promo stage frame-by-frame on a deterministic clock and encodes
 * with WebCodecs. Every frame gets timestamp = frameIndex / FPS (in µs), so the
 * resulting video duration is exactly durationMs regardless of how long the
 * export takes to run. No MediaRecorder / realtime capture is involved.
 */
export async function exportPromoVideo(opts: {
  stage: HTMLElement;
  durationMs: number;
  setTime: (t: number) => void;
  onProgress?: ExportProgress;
}): Promise<{ blob: Blob; filename: string }> {
  const { stage, durationMs, setTime, onProgress } = opts;
  const total = Math.round((durationMs / 1000) * PROMO_FPS);
  const frameDurUs = Math.round(1_000_000 / PROMO_FPS);

  const h264 = await pickCodec(H264_CANDIDATES);
  const vp = h264 ? null : await pickCodec(VP9_CANDIDATES);
  if (!h264 && !vp) {
    throw new Error("Videoexport stöds inte i den här webbläsaren (WebCodecs saknas).");
  }

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = PROMO_W;
  captureCanvas.height = PROMO_H;
  const ctx = captureCanvas.getContext("2d")!;

  const mp4Muxer = h264
    ? new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: "avc", width: PROMO_W, height: PROMO_H, frameRate: PROMO_FPS },
        fastStart: "in-memory",
      })
    : null;
  const webmMuxer = vp
    ? new WebMMuxer({
        target: new WebMTarget(),
        video: {
          codec: vp.startsWith("vp09") ? "V_VP9" : "V_VP8",
          width: PROMO_W,
          height: PROMO_H,
          frameRate: PROMO_FPS,
        },
      })
    : null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (mp4Muxer) mp4Muxer.addVideoChunk(chunk, meta);
      else webmMuxer!.addVideoChunk(chunk, meta);
    },
    error: (e) => console.error(e),
  });
  encoder.configure({
    codec: (h264 ?? vp)!,
    width: PROMO_W,
    height: PROMO_H,
    bitrate: 12_000_000,
    framerate: PROMO_FPS,
    latencyMode: "quality",
  });

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

    // Deterministic presentation timestamp: frame index / FPS.
    const frame = new VideoFrame(captureCanvas, {
      timestamp: Math.round((i * 1_000_000) / PROMO_FPS),
      duration: frameDurUs,
    });
    encoder.encode(frame, { keyFrame: i % (PROMO_FPS * 2) === 0 });
    frame.close();

    while (encoder.encodeQueueSize > 6) await nextFrame();

    onProgress?.(i + 1, total);
  }

  await encoder.flush();
  encoder.close();

  if (mp4Muxer) {
    mp4Muxer.finalize();
    const buf = (mp4Muxer.target as ArrayBufferTarget).buffer;
    return { blob: new Blob([buf], { type: "video/mp4" }), filename: "donely-promo.mp4" };
  }
  webmMuxer!.finalize();
  const buf = (webmMuxer!.target as WebMTarget).buffer;
  return { blob: new Blob([buf], { type: "video/webm" }), filename: "donely-promo.webm" };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
