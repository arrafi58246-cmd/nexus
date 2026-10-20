"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react";

// Rasio 10:3 mendekati bingkai banner di halaman Mission (±1244×372).
const RATIO = 10 / 3;
const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 480;
const MAX_ZOOM = 4;
const LOW_RES_WIDTH = 1000; // lebar area crop (px asli) di bawah ini terlihat buram
const MAX_SOURCE_BYTES = 10_485_760;

export type BannerState = { active: boolean; file: File | null };

type Point = { x: number; y: number };
type View = { sx: number; sy: number; sw: number; sh: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Area gambar asli (px) yang tampil di bingkai untuk zoom dan titik tengah tertentu.
function viewOf(image: HTMLImageElement, zoom: number, center: Point): View {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const sw = Math.min(iw, ih * RATIO) / zoom;
  const sh = sw / RATIO;
  return {
    sx: clamp(center.x - sw / 2, 0, iw - sw),
    sy: clamp(center.y - sh / 2, 0, ih - sh),
    sw, sh,
  };
}

function normalize(image: HTMLImageElement, zoom: number, center: Point): Point {
  const view = viewOf(image, zoom, center);
  return { x: view.sx + view.sw / 2, y: view.sy + view.sh / 2 };
}

export default function BannerCropper({ posterUrl, error, onChange }: {
  posterUrl: string | null;
  error?: string;
  onChange: (state: BannerState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<{ url: string; name: string } | null>(null);
  const [customError, setCustomError] = useState("");
  const [loaded, setLoaded] = useState<{ source: string; image: HTMLImageElement } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<Point>({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; start: Point; scale: number } | null>(null);

  const source = custom?.url ?? posterUrl;
  const image = loaded && loaded.source === source ? loaded.image : null;
  const loadFailed = Boolean(source) && failedSource === source;

  // Gambar kustom adalah URL sementara di browser; dilepas saat diganti atau halaman ditutup.
  useEffect(() => () => { if (custom) URL.revokeObjectURL(custom.url); }, [custom]);

  // Muat gambar sumber hanya saat bagian banner dibuka. Posisi dan zoom diatur ulang tiap sumber baru.
  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    const next = new Image();
    next.onload = () => {
      if (cancelled) return;
      setLoaded({ source, image: next });
      setZoom(1);
      setCenter({ x: next.naturalWidth / 2, y: next.naturalHeight / 2 });
    };
    next.onerror = () => { if (!cancelled) setFailedSource(source); };
    next.src = source;
    return () => { cancelled = true; };
  }, [open, source]);

  // Kirim hasil crop ke form (ditunda sebentar supaya tidak dirender setiap piksel geseran).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!open) { onChange({ active: false, file: null }); return; }
      if (!image) { onChange({ active: true, file: null }); return; }
      const view = viewOf(image, zoom, center);
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) { onChange({ active: true, file: null }); return; }
      context.fillStyle = "#0b0e14"; // latar untuk PNG transparan
      context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      context.imageSmoothingQuality = "high";
      context.drawImage(image, view.sx, view.sy, view.sw, view.sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      canvas.toBlob((blob) => {
        onChange({
          active: true,
          file: blob ? new File([blob], "banner.jpg", { type: "image/jpeg" }) : null,
        });
      }, "image/jpeg", 0.9);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, image, zoom, center, onChange]);

  function chooseCustom(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setCustomError("Gambar banner harus JPG atau PNG.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setCustomError("Gambar banner terlalu besar. Maksimal 10 MiB.");
      return;
    }
    setCustomError("");
    setCustom({ url: URL.createObjectURL(file), name: file.name });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!image) return;
    const width = event.currentTarget.getBoundingClientRect().width;
    if (!width) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY, start: center,
      scale: viewOf(image, zoom, center).sw / width,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!image || !state || state.id !== event.pointerId) return;
    setCenter(normalize(image, zoom, {
      x: state.start.x - (event.clientX - state.x) * state.scale,
      y: state.start.y - (event.clientY - state.y) * state.scale,
    }));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!image) return;
    const step = viewOf(image, zoom, center).sw * 0.05;
    const move: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    };
    const delta = move[event.key];
    if (!delta) return;
    event.preventDefault();
    setCenter(normalize(image, zoom, { x: center.x + delta.x, y: center.y + delta.y }));
  }

  function changeZoom(event: ChangeEvent<HTMLInputElement>) {
    if (!image) return;
    const next = clamp(Number(event.currentTarget.value) || 1, 1, MAX_ZOOM);
    setZoom(next);
    setCenter(normalize(image, next, center));
  }

  function close() {
    setOpen(false);
    setCustom(null);
    setCustomError("");
    setLoaded(null);
    setFailedSource(null);
  }

  const view = image ? viewOf(image, zoom, center) : null;
  const lowResolution = Boolean(view && view.sw < LOW_RES_WIDTH);
  const message = customError || (error ?? "");

  return <section aria-labelledby="banner-heading" className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="banner-heading" className="text-sm font-semibold">Banner halaman Mission (opsional)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Banner tampil di bagian atas halaman Mission. Tanpa banner, poster tampil utuh di samping judul.
        </p>
      </div>
      {open
        ? <button type="button" onClick={close}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
            Hapus banner
          </button>
        : <button type="button" onClick={() => setOpen(true)}
            className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-semibold text-indigo-700">
            Atur banner
          </button>}
    </div>

    {open && <div className="space-y-3">
      {!source && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        Pilih poster lomba di atas, atau pakai gambar lain untuk banner.</p>}
      {loadFailed && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        Gambar tidak dapat dibaca. Pilih gambar JPG atau PNG yang lain.</p>}

      {source && !loadFailed && <>
        <div role="group" tabIndex={0} onKeyDown={onKeyDown}
          aria-label="Area banner. Seret atau pakai tombol panah untuk menggeser gambar."
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={endDrag} onPointerCancel={endDrag}
          style={{ aspectRatio: "10 / 3" }}
          className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-xl border border-slate-300 bg-slate-900 active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {image && view
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={source} alt="" draggable={false}
                style={{
                  position: "absolute", maxWidth: "none", height: "auto",
                  width: `${(image.naturalWidth / view.sw) * 100}%`,
                  left: `${-(view.sx / view.sw) * 100}%`,
                  top: `${-(view.sy / view.sh) * 100}%`,
                }} />
            : <span className="absolute inset-0 grid place-items-center text-xs text-slate-300">Memuat gambar...</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-3 text-sm font-semibold">Zoom
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom}
              onChange={changeZoom} disabled={!image} aria-label="Zoom banner"
              className="w-40 sm:w-56" />
          </label>
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
            Pakai gambar lain
            <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={chooseCustom}
              className="sr-only" />
          </label>
          {custom && <button type="button" onClick={() => setCustom(null)}
            className="text-sm font-semibold text-indigo-700">Pakai poster lagi</button>}
        </div>
        <p className="text-xs text-slate-600">
          Sumber: {custom ? custom.name : "poster lomba"}. Geser gambar untuk memilih bagian yang tampil.
          Hindari bagian poster yang banyak teksnya agar judul Mission tetap terbaca.
        </p>
        {lowResolution && <p className="text-xs font-semibold text-amber-700">
          Area ini beresolusi rendah dan bisa terlihat buram. Kurangi zoom atau pakai gambar yang lebih besar.</p>}
      </>}

      {!source && <label className="inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
        Pakai gambar lain
        <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={chooseCustom}
          className="sr-only" />
      </label>}
    </div>}

    {message && <span id="banner-error" role="alert"
      className="block text-xs font-normal text-red-700">{message}</span>}
  </section>;
}
