"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Placement = "ears" | "neck";

// MediaPipe face-mesh landmark indices used as anchors.
const EAR_LEFT = 132; // near left earlobe (viewer's right)
const EAR_RIGHT = 361; // near right earlobe
const CHIN = 152; // bottom of chin, for necklaces
const FACE_L = 234; // left face edge — used to gauge face width
const FACE_R = 454; // right face edge

// CDN sources — MediaPipe fetches WASM + the model at runtime.
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Status = "idle" | "loading" | "running" | "error" | "denied";

// Average adult face width (bizygomatic), used to convert a real-world
// jewellery size in mm into on-screen pixels against the detected face.
const AVG_FACE_WIDTH_MM = 140;
const DEFAULT_SIZE_MM = 25;

export default function LiveTryOn({
  jewelUrl,
  sizeMm,
  placement,
}: {
  jewelUrl: string | null;
  sizeMm: number | null;
  placement: Placement;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jewelImg = useRef<HTMLImageElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarker = useRef<any>(null);
  const raf = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  // Keep the latest size/placement without restarting the loop.
  const sizeRef = useRef(sizeMm ?? DEFAULT_SIZE_MM);
  const placementRef = useRef(placement);
  useEffect(() => {
    sizeRef.current = sizeMm ?? DEFAULT_SIZE_MM;
  }, [sizeMm]);
  useEffect(() => {
    placementRef.current = placement;
  }, [placement]);

  // Load the jewellery image whenever it changes.
  useEffect(() => {
    if (!jewelUrl) {
      jewelImg.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => (jewelImg.current = img);
    img.onerror = () => (jewelImg.current = null);
    img.src = jewelUrl;
  }, [jewelUrl]);

  const draw = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarker.current;
    if (!video || !canvas || !lm || video.readyState < 2) {
      raf.current = requestAnimationFrame(draw);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Mirror the feed so it reads like a selfie.
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    let result;
    try {
      result = lm.detectForVideo(video, performance.now());
    } catch {
      result = null;
    }

    const pts = result?.faceLandmarks?.[0];
    const jewel = jewelImg.current;
    if (pts && jewel) {
      const W = canvas.width;
      const H = canvas.height;
      const mx = (x: number) => (1 - x) * W; // mirror X to match the flipped feed
      const my = (y: number) => y * H;

      // Convert the piece's real size (mm) into pixels using the measured face
      // width as a ruler — so it appears life-size, not a guessed scale.
      const faceW = Math.abs(mx(pts[FACE_R].x) - mx(pts[FACE_L].x));
      const size = faceW * (sizeRef.current / AVG_FACE_WIDTH_MM);
      const ratio = jewel.height / jewel.width;

      const place = (cx: number, cy: number) => {
        const w = size;
        const h = size * ratio;
        ctx.drawImage(jewel, cx - w / 2, cy, w, h);
      };

      if (placementRef.current === "ears") {
        place(mx(pts[EAR_LEFT].x), my(pts[EAR_LEFT].y));
        place(mx(pts[EAR_RIGHT].x), my(pts[EAR_RIGHT].y));
      } else {
        const w = size * 2.4;
        const h = w * ratio;
        ctx.drawImage(jewel, mx(pts[CHIN].x) - w / 2, my(pts[CHIN].y) + h * 0.1, w, h);
      }
    }

    raf.current = requestAnimationFrame(draw);
  }, []);

  const start = useCallback(async () => {
    setStatus("loading");
    setMessage("Loading the try-on engine…");
    try {
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      landmarker.current = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });

      setMessage("Requesting camera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      setStatus("running");
      setMessage("");
      raf.current = requestAnimationFrame(draw);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied");
        setMessage("Camera access was blocked. Allow it and try again.");
      } else {
        setStatus("error");
        setMessage(
          "Couldn't start live try-on. Your browser may not support it, or the model failed to load.",
        );
      }
    }
  }, [draw]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      const v = videoRef.current;
      const s = v?.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
      landmarker.current?.close?.();
    };
  }, []);

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-ink">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="h-full w-full object-cover" />

        {status !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-alt/95 p-6 text-center">
            {status === "loading" ? (
              <p className="text-ink-soft">{message}</p>
            ) : (
              <>
                <p className="max-w-xs text-sm text-ink-soft">
                  {status === "idle"
                    ? "Turn on your camera to see earrings and necklaces track your face in real time. Video stays on your device."
                    : message}
                </p>
                <button
                  onClick={start}
                  className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface hover:bg-brand-deep"
                >
                  {status === "idle" ? "Start camera" : "Try again"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {status === "running" && (
        <p className="mt-2 text-center text-xs text-silver">
          Live · move your head to see it track
        </p>
      )}
    </div>
  );
}
