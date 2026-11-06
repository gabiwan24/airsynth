// Webcam + MediaPipe HandLandmarker on the GPU. Runs detection exactly once per new camera frame
// (requestVideoFrameCallback), so no frame is processed twice and none waits for the next rAF tick.
import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export async function loadLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let landmarker, delegate = "GPU";
  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, opts("GPU"));
  } catch (err) {
    console.warn("GPU delegate unavailable, falling back to CPU", err);
    delegate = "CPU";
    landmarker = await HandLandmarker.createFromOptions(fileset, opts("CPU"));
  }
  return { landmarker, delegate };
}

/**
 * The first detection compiles GPU shaders (measured ~4 s, blocks the main thread). Run it behind the
 * loading state instead of on the first live frame. Timestamp 0 keeps later performance.now() stamps increasing.
 */
export function warmUp(landmarker) {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 480;
  c.getContext("2d").fillRect(0, 0, 640, 480);
  landmarker.detectForVideo(c, 0);
}

export async function startCamera(video) {
  // Small frames + high frame rate: detection cost scales with pixels, latency with frame interval.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 } },
  });
  video.srcObject = stream;
  await video.play();
  return stream.getVideoTracks()[0].getSettings();
}

/** Calls onResult(result, detectMs) for every new video frame. Returns a stop function. */
export function runLoop(video, landmarker, onResult) {
  let handle, stopped = false, lastTs = 0;
  const tick = (now) => {
    if (stopped) return;
    // timestamps must strictly increase for VIDEO mode (warm-up used 0)
    const ts = Math.max(lastTs + 1, Math.round(now));
    lastTs = ts;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, ts);
    onResult(result, performance.now() - t0);
    handle = video.requestVideoFrameCallback(tick);
  };
  handle = video.requestVideoFrameCallback(tick);
  return () => { stopped = true; video.cancelVideoFrameCallback(handle); };
}
