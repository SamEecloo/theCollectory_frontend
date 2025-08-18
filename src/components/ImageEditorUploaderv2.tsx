// src/components/ImageEditorUploader.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
// This registers all cropper custom elements globally:
import "cropperjs";

// --- TS: allow JSX for the custom elements (quick inline declaration) ---
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "cropper-canvas": any;
      "cropper-image": any;
      "cropper-selection": any;
      "cropper-handle": any;
    }
  }
}

export type UploadedImage = { url: string; thumbUrl?: string };
type Orientation = "landscape" | "portrait" | "square";

type Props = {
  orientation?: Orientation;          // optional; default "landscape"
  collectionId: string;
  itemId: string;
  max?: number;
  onDone: (images: UploadedImage[]) => void;
};

const aspectByOrientation: Record<Orientation, number> = {
  landscape: 16 / 9,
  portrait: 3 / 4,
  square: 1,
};

// Helper to clamp numbers
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export default function ImageEditorUploader({
  orientation = "landscape",
  collectionId,
  itemId,
  max = 1,
  onDone,
}: Props) {
  const canvasRef = useRef<any>(null);     // <cropper-canvas>
  const imageRef = useRef<any>(null);      // <cropper-image>
  const selectionRef = useRef<any>(null);  // <cropper-selection>

  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Absolute scale of the image (NOT a delta)
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(0.1);
  const [maxScale, setMaxScale] = useState(10);

  const aspect = aspectByOrientation[orientation];

  const containerHeight = useMemo(() => {
    if (orientation === "portrait") return 520;
    if (orientation === "square") return 460;
    return 380; // landscape
  }, [orientation]);

  // When a new file is chosen
  const handleFile = (f: File | null) => {
    if (!f) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setFile(f);
    setObjectUrl(URL.createObjectURL(f));
  };

  // Compute baseline scale (fit height for portrait, fit width for landscape, fill for square)
  useEffect(() => {
    if (!objectUrl) return;

    const imgEl = imageRef.current as any;
    const canvasEl = canvasRef.current as any;

    if (!imgEl || !canvasEl) return;

    // Wait until the image is loaded into the element
    imgEl.$ready((htmlImg: HTMLImageElement) => {
      const rect = (canvasEl as HTMLElement).getBoundingClientRect();
      const naturalW = htmlImg.naturalWidth || 1;
      const naturalH = htmlImg.naturalHeight || 1;

      let fitScale = 1;

      if (orientation === "portrait") {
        // Fit HEIGHT baseline
        fitScale = rect.height / naturalH;
      } else if (orientation === "landscape") {
        // Fit WIDTH baseline
        fitScale = rect.width / naturalW;
      } else {
        // Square: fill the frame (like "cover")
        const scaleW = rect.width / naturalW;
        const scaleH = rect.height / naturalH;
        fitScale = Math.max(scaleW, scaleH);
      }

      // Allow inward & outward zoom around the baseline
      const min = fitScale * 0.3; // zoom out up to 30% of baseline
      const max = fitScale * 5;   // zoom in up to 5x baseline

      // Center the image at the baseline scale
      const scaledW = naturalW * fitScale;
      const scaledH = naturalH * fitScale;
      const tx = (rect.width - scaledW) / 2;
      const ty = (rect.height - scaledH) / 2;

      // Set absolute transform: matrix(a,b,c,d,e,f) with no skew
      imgEl.$setTransform(fitScale, 0, 0, fitScale, tx, ty);

      // Pin a fixed-aspect selection that covers the canvas
      // (cover the full frame; user will move/zoom the image)
      const selEl = selectionRef.current as any;
      if (selEl) {
        selEl.aspectRatio = aspect;
        selEl.initialCoverage = 1; // fill canvas
        // If selection already rendered, force refresh:
        selEl.$render?.();
      }

      setScale(fitScale);
      setMinScale(min);
      setMaxScale(max);
    });
  }, [objectUrl, orientation, aspect]);

  // Zoom slider -> absolute scale. We apply a RELATIVE zoom delta so translations are preserved.
  const onZoomSlider = (absScale: number) => {
    const imgEl = imageRef.current as any;
    if (!imgEl) return;
    const target = clamp(absScale, minScale, maxScale);
    const delta = target / scale - 1; // e.g., 1.2 -> +20% | 0.8 -> -20%
    if (delta !== 0) {
      imgEl.$zoom(delta); // v2 API: positive=in, negative=out (relative)  :contentReference[oaicite:0]{index=0}
      setScale(target);
    }
  };

  // Export cropped image (PNG = transparent side borders)
  const exportImage = async () => {
    const selEl = selectionRef.current as any;
    if (!selEl) return;

    // Render only the selected area into a canvas (transparent background by default)
    const canvas: HTMLCanvasElement = await selEl.$toCanvas(); // v2 API  :contentReference[oaicite:1]{index=1}
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/png", 0.92)
    );

    // TODO: replace with your real upload endpoint
    // Example quick success path: return a preview object URL
    const url = URL.createObjectURL(blob);
    onDone([{ url }]);
  };

  return (
    <div className="space-y-2">
      {/* Pick a file */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Cropper */}
      {objectUrl && (
        <>
          <div style={{ width: "100%", height: containerHeight, borderRadius: 8, overflow: "hidden" }}>
            <cropper-canvas ref={canvasRef} background>
              {/* The image users pan/zoom */}
              <cropper-image
                ref={imageRef}
                src={objectUrl}
                alt="Uploaded"
                // Enable transforms we want:
                translatable
                scalable
                rotatable
                skewable={false}
              />
              {/* Drag to move image */}
              <cropper-handle action="move" plain />
              {/* Fixed aspect selection that covers the whole frame */}
              <cropper-selection
                ref={selectionRef}
                // Initial values set in the effect; keeping attributes for first render:
                initial-coverage="1"
                // we keep it fixed; users manipulate the image instead
                movable={false}
                resizable={false}
                outlined
                precise
              />
            </cropper-canvas>
          </div>

          {/* Zoom control (absolute scale) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Zoom</label>
            <input
              type="range"
              min={minScale}
              max={maxScale}
              step={0.001}
              value={scale}
              onChange={(e) => onZoomSlider(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={exportImage} className="border px-3 py-1 rounded">
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}
