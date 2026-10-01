"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A small camera modal. Opens the device camera via getUserMedia (rear camera
 * on mobile, webcam on desktop), lets the owner snap a photo, and returns it as
 * a File to the parent. Requires a secure context (https or localhost).
 */
export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 1280, height: 960 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        const name = (err as { name?: string })?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser and try again."
            : "Couldn't open the camera. Your device may not have one, or it's in use.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.9,
    );
  }

  function close() {
    stop();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#3a2b1e] bg-[#211710] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-[family-name:var(--font-fraunces)] text-lg text-[#f2e8da]">
            Take a photo
          </p>
          <button onClick={close} className="text-[#c7b7a2] hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        {error ? (
          <p className="rounded-lg bg-[#2c2015] px-4 py-6 text-center text-sm text-[#e29b84]">
            {error}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="h-auto w-full" />
          </div>
        )}

        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={close}
            className="rounded-full border border-[#3a2b1e] px-5 py-2.5 text-sm text-[#c7b7a2] hover:border-[#8a5a34]"
          >
            Cancel
          </button>
          <button
            onClick={snap}
            disabled={!ready}
            className="rounded-full bg-[#8a5a34] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a06a3e] disabled:opacity-50"
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
