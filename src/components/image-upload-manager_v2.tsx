// src/components/image-upload-manager.tsx
import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload, X, Star, RotateCw, Crop as CropIcon,
  ZoomIn, ZoomOut, Plus, Loader2, FlipHorizontal2,
} from 'lucide-react';
import api from '@/lib/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Must match the constant in CropEditor below — backend uses this to compute CONTAINER_H
const CROP_CONTAINER_W = 560;

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageData = {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
};

type UploadingFile = {
  id: string;
  name: string;
  progress: number;
  preview: string;
};

type CropState = {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  flipH: boolean;
};

type ImageUploadManagerProps = {
  userId: string;
  collectionId: string;
  itemId: string;
  initialImages?: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  onPendingDeletionsChange?: (imageIds: string[]) => void;
  resetPendingDeletions?: boolean;
  isPublicView?: boolean;
  orientation?: 'landscape' | 'portrait' | 'square';
};

// ─── ProgressiveImage ─────────────────────────────────────────────────────────

function ProgressiveImage({
  src,
  thumbnailSrc,
  alt,
  className,
  onClick,
}: {
  src: string;
  thumbnailSrc: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [isFullImageLoaded, setIsFullImageLoaded] = useState(false);

  useEffect(() => {
    setIsFullImageLoaded(false);
  }, [src]);

  return (
    <div className="relative w-full h-full">
      <img
        src={`${BACKEND_URL}${thumbnailSrc}`}
        alt={alt}
        className={`${className} transition-opacity duration-300 blur-2xl scale-110 ${
          isFullImageLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <img
        src={`${BACKEND_URL}${src}`}
        alt={alt}
        className={`absolute inset-0 ${className} transition-opacity duration-300 ${
          isFullImageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setIsFullImageLoaded(true)}
        onClick={onClick}
      />
    </div>
  );
}

// ─── CropEditor ───────────────────────────────────────────────────────────────
// Fixed-frame pan & zoom editor. The crop frame stays still; the image moves
// underneath it. Zoom is constrained so the image always fills the frame.
//
// Uses forwardRef + useImperativeHandle so the parent reads crop state at save
// time via ref.current.getCropState() — avoiding setState-during-render issues
// that occur when pushing state up via onChange callbacks from onLoad events.

type CropEditorProps = {
  src: string;
  aspect: number;
};

export type CropEditorHandle = {
  getCropState: () => CropState;
};

const CropEditor = forwardRef<CropEditorHandle, CropEditorProps>(
  function CropEditor({ src, aspect }, ref) {
  const CONTAINER_W = CROP_CONTAINER_W;

  // Measure actual rendered width so height stays proportional on mobile
  const containerRef = useRef<HTMLDivElement>(null);
  const [actualW, setActualW] = useState(CONTAINER_W);
  const actualH = Math.round(actualW / aspect);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setActualW(Math.min(w, CONTAINER_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [baseRotation, setBaseRotation] = useState(0);  // 90° steps from button
  const [fineRotation, setFineRotation] = useState(0);  // -45..+45 from slider
  const [flipH, setFlipH] = useState(false);

  // Total rotation used for CSS transform and cover-scale maths
  const rotation = baseRotation + fineRotation;
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const touchStartRef = useRef<{ tx: number; ty: number; ox: number; oy: number } | null>(null);

  // Keep a ref copy so getCropState() always reads the latest values.
  const cropStateRef = useRef<CropState>({ offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipH: false });

  // Expose getCropState() to parent via ref
  useImperativeHandle(ref, () => ({
    getCropState: () => cropStateRef.current,
  }));

  // Minimum scale to fully cover the container at any rotation angle θ.
  // Uses the "cover rotated rectangle" formula so no background ever shows.
  const coverScale = useCallback((nw: number, nh: number, deg: number): number => {
    const θ = (deg * Math.PI) / 180;
    const cosT = Math.abs(Math.cos(θ));
    const sinT = Math.abs(Math.sin(θ));
    const neededW = (actualW * cosT + actualH * sinT) / nw;
    const neededH = (actualW * sinT + actualH * cosT) / nh;
    return Math.max(neededW, neededH);
  }, [actualW, actualH]);

  // When there's no rotation: only require the height to fill the frame.
  // Width can be smaller (portrait/narrow covers get transparent side bars).
  // The moment any rotation is applied, revert to full cover so no gaps appear.
  const isRotated = rotation !== 0;
  const minScale = naturalSize
    ? isRotated
      ? coverScale(naturalSize.w, naturalSize.h, rotation)
      : actualH / naturalSize.h
    : 1;

  // Clamp offset so no background bleeds into the frame.
  // After rotation the bounding box of the rotated image is larger than the
  // natural dimensions — use the same trig to compute how far we can pan.
  const clampForRotation = useCallback((ox: number, oy: number, s: number, deg: number) => {
    if (!naturalSize) return { x: ox, y: oy };
    const normalised = ((deg % 360) + 360) % 360;
    const noRotation = normalised === 0;

    if (noRotation) {
      // Height always fills → no vertical pan freedom.
      // Width may be smaller than container → X is unconstrained (image centred by CSS).
      const scaledW = naturalSize.w * s;
      const hw = Math.max(0, (scaledW - actualW) / 2);
      return {
        x: Math.min(hw, Math.max(-hw, ox)),
        y: 0,
      };
    }

    const θ = (deg * Math.PI) / 180;
    const cosT = Math.abs(Math.cos(θ));
    const sinT = Math.abs(Math.sin(θ));
    const bboxW = (naturalSize.w * cosT + naturalSize.h * sinT) * s;
    const bboxH = (naturalSize.w * sinT + naturalSize.h * cosT) * s;
    const hw = Math.max(0, (bboxW - actualW) / 2);
    const hh = Math.max(0, (bboxH - actualH) / 2);
    return {
      x: Math.min(hw, Math.max(-hw, ox)),
      y: Math.min(hh, Math.max(-hh, oy)),
    };
  }, [naturalSize, actualW, actualH]);

  // Reset everything when src or aspect changes
  useEffect(() => {
    setNaturalSize(null);
    setReady(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setBaseRotation(0);
    setFineRotation(0);
    cropStateRef.current = { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipH: false };
  }, [src, aspect]);

  const applyScale = useCallback(
    (next: number) => {
      if (!naturalSize) return;
      const s = Math.max(minScale, Math.min(5, next));
      const o = clampForRotation(offset.x, offset.y, s, rotation);
      setScale(s);
      setOffset(o);
      cropStateRef.current = { offsetX: o.x, offsetY: o.y, scale: s, rotation, flipH };
    },
    [minScale, offset, clampForRotation, naturalSize, rotation],
  );

  // 90° button — adds to baseRotation, keeps fineRotation intact
  const applyBaseRotation = useCallback(
    (deltaDeg: number) => {
      if (!naturalSize) return;
      const newBase = ((baseRotation + deltaDeg) % 360 + 360) % 360;
      const newRot  = newBase + fineRotation;
      const s = Math.max(scale, coverScale(naturalSize.w, naturalSize.h, newRot));
      const o = clampForRotation(offset.x, offset.y, s, newRot);
      setBaseRotation(newBase);
      setScale(s);
      setOffset(o);
      cropStateRef.current = { offsetX: o.x, offsetY: o.y, scale: s, rotation: newRot, flipH };
    },
    [naturalSize, scale, offset, baseRotation, fineRotation, coverScale, clampForRotation],
  );

  // Slider — adjusts fineRotation, baseRotation stays intact
  const applyFineRotation = useCallback(
    (deg: number) => {
      if (!naturalSize) return;
      const newRot = baseRotation + deg;
      const s = Math.max(scale, coverScale(naturalSize.w, naturalSize.h, newRot));
      const o = clampForRotation(offset.x, offset.y, s, newRot);
      setFineRotation(deg);
      setScale(s);
      setOffset(o);
      cropStateRef.current = { offsetX: o.x, offsetY: o.y, scale: s, rotation: newRot, flipH };
    },
    [naturalSize, scale, offset, baseRotation, coverScale, clampForRotation],
  );

  const applyFlip = useCallback(() => {
    setFlipH(prev => {
      const next = !prev;
      // Mirror the X offset so the image stays visually centred after flip
      const o = clampForRotation(-offset.x, offset.y, scale, rotation);
      setOffset(o);
      cropStateRef.current = { offsetX: o.x, offsetY: o.y, scale, rotation, flipH: next };
      return next;
    });
  }, [offset, scale, rotation, clampForRotation]);

  // onLoad: update internal state only — no parent callback
  const handleLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNaturalSize({ w: nw, h: nh });
    // Default: fit by height so narrow covers show transparent side bars
    const s = actualH / nh;
    setScale(s);
    setOffset({ x: 0, y: 0 });
    setReady(true);
    cropStateRef.current = { offsetX: 0, offsetY: 0, scale: s, rotation: 0, flipH: false };
    // Also reset the rotation states (handleLoad fires when src changes)
    setBaseRotation(0);
    setFineRotation(0);
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging || !dragStart.current) return;
      const o = clampForRotation(
        dragStart.current.ox + e.clientX - dragStart.current.mx,
        dragStart.current.oy + e.clientY - dragStart.current.my,
        scale,
        rotation,
      );
      setOffset(o);
      cropStateRef.current = { offsetX: o.x, offsetY: o.y, scale, rotation, flipH };
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, scale, rotation, clampForRotation]);

  // Scroll wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    applyScale(scale * (e.deltaY > 0 ? 0.94 : 1.06));
  };

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { tx: t.clientX, ty: t.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const o = clampForRotation(
      touchStartRef.current.ox + t.clientX - touchStartRef.current.tx,
      touchStartRef.current.oy + t.clientY - touchStartRef.current.ty,
      scale,
      rotation,
    );
    setOffset(o);
    cropStateRef.current = { offsetX: o.x, offsetY: o.y, scale, rotation, flipH };
  };

  const zoomPercent = naturalSize ? Math.round((scale / minScale) * 100) : 100;

  return (
    <div className="space-y-3">
      {/* Toolbar — centred above the crop frame */}
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={() => applyBaseRotation(90)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Rotate 90°
        </button>
        <button
          type="button"
          onClick={applyFlip}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-colors ${
            flipH
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
          Flip H{flipH ? ' ✓' : ''}
        </button>
      </div>

      {/* Fixed crop frame — width capped at CONTAINER_W, height derived from actual width */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-md mx-auto select-none w-full"
        style={{
          maxWidth: CONTAINER_W,
          height: actualH,
          cursor: dragging ? 'grabbing' : 'grab',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
          backgroundImage: `
            linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
            linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
            linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
          `,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: '#1a1a1a',
        }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={handleLoad}
          draggable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            // Use naturalSize dimensions so scale(s) maps 1:1 to pixels.
            // Without explicit width the browser lays it out at natural size
            // before the transform, causing a flash of wrong proportions.
            width: naturalSize ? naturalSize.w : undefined,
            height: naturalSize ? naturalSize.h : undefined,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${flipH ? -scale : scale}, ${scale})`,
            transformOrigin: 'center center',
            maxWidth: 'none',
            userSelect: 'none',
            // Hidden until handleLoad has computed the correct initial scale
            opacity: ready ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        />

        {/* Rule-of-thirds grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)
            `,
            backgroundSize: '33.333% 33.333%',
          }}
        />

        {/* Corner bracket indicators */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <div
            key={corner}
            className="absolute w-4 h-4 pointer-events-none"
            style={{
              top: corner.startsWith('t') ? 8 : 'auto',
              bottom: corner.startsWith('b') ? 8 : 'auto',
              left: corner.endsWith('l') ? 8 : 'auto',
              right: corner.endsWith('r') ? 8 : 'auto',
              borderTop: corner.startsWith('t') ? '2px solid rgba(255,255,255,0.6)' : 'none',
              borderBottom: corner.startsWith('b') ? '2px solid rgba(255,255,255,0.6)' : 'none',
              borderLeft: corner.endsWith('l') ? '2px solid rgba(255,255,255,0.6)' : 'none',
              borderRight: corner.endsWith('r') ? '2px solid rgba(255,255,255,0.6)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 px-1">
        <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          type="range"
          min={minScale}
          max={minScale * 4}
          step={0.001}
          value={scale}
          onChange={(e) => applyScale(parseFloat(e.target.value))}
          className="flex-1 accent-primary cursor-pointer"
        />
        <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
          {zoomPercent}%
        </span>
      </div>

      {/* Fine rotation slider — operates on fineRotation only, baseRotation unaffected */}
      <div className="flex items-center gap-3 px-1">
        <RotateCw className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          type="range"
          min={-45}
          max={45}
          step={0.1}
          value={fineRotation}
          onChange={(e) => applyFineRotation(parseFloat(e.target.value))}
          className="flex-1 accent-primary cursor-pointer"
        />
        <div className="flex items-center justify-end gap-1 w-[68px] flex-shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums text-right">
            {fineRotation > 0 ? `+${fineRotation.toFixed(1)}°` : fineRotation < 0 ? `${fineRotation.toFixed(1)}°` : '0°'}
            {baseRotation !== 0 ? ` +${baseRotation}°` : ''}
          </span>
          {(fineRotation !== 0 || baseRotation !== 0) && (
            <button
              type="button"
              onClick={() => { applyFineRotation(0); setBaseRotation(0); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Reset all rotation"
            >
              ↺
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── ImageUploadManager ───────────────────────────────────────────────────────

export default function ImageUploadManager({
  userId,
  collectionId,
  itemId,
  initialImages = [],
  onImagesChange,
  onPendingDeletionsChange,
  resetPendingDeletions,
  isPublicView = false,
  orientation = 'landscape',
}: ImageUploadManagerProps) {
  const [images, setImages] = useState<ImageData[]>(initialImages);
  const [mainImageId, setMainImageId] = useState<string | null>(
    initialImages.length > 0 ? initialImages[0].id : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [editingImage, setEditingImage] = useState<ImageData | null>(null);
  // Read crop state from the editor via ref at save time — never stored in React state
  // to avoid the setState-during-render warning triggered by onLoad callbacks.
  const cropEditorRef = useRef<CropEditorHandle>(null);
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(
    initialImages.length > 0 ? initialImages[0].id : null,
  );
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Sync with parent-supplied initialImages ──────────────────────────────
  useEffect(() => {
    setImages(initialImages);
    setMainImageId(initialImages.length > 0 ? initialImages[0].id : null);
    setActiveImageId(initialImages.length > 0 ? initialImages[0].id : null);
  }, [initialImages]);

  useEffect(() => {
    if (resetPendingDeletions) setPendingDeletions([]);
  }, [resetPendingDeletions]);

  useEffect(() => {
    setActiveImageId(mainImageId);
  }, [mainImageId]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getAspectClass = () => {
    switch (orientation) {
      case 'portrait': return 'aspect-[3/4]';
      case 'square':   return 'aspect-square';
      default:         return 'aspect-[4/3]';
    }
  };

  const getThumbnailClass = () => {
    switch (orientation) {
      case 'portrait': return 'aspect-[3/4] w-20';
      case 'square':   return 'aspect-square w-20';
      default:         return 'aspect-[4/3] w-32';
    }
  };

  const getCropAspect = () => {
    switch (orientation) {
      case 'portrait': return 3 / 4;
      case 'square':   return 1;
      default:         return 4 / 3;
    }
  };

  const sortedImages = [...images].sort((a, b) => {
    if (a.id === mainImageId) return -1;
    if (b.id === mainImageId) return 1;
    return 0;
  });

  // ── Upload ────────────────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true);
      const newUploadingFiles: UploadingFile[] = acceptedFiles.map((file, i) => ({
        id: `uploading-${Date.now()}-${i}`,
        name: file.name,
        progress: 0,
        preview: URL.createObjectURL(file),
      }));
      setUploadingFiles(newUploadingFiles);

      try {
        const formData = new FormData();
        acceptedFiles.forEach((file) => formData.append('images', file));
        formData.append('userId', userId);
        formData.append('collectionId', collectionId);
        formData.append('itemId', itemId);

        const response = await api.post('/images/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const pct = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadingFiles((prev) => prev.map((f) => ({ ...f, progress: pct })));
          },
        });

        newUploadingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
        const newImages = [...images, ...response.data.images];
        setImages(newImages);
        onImagesChange(newImages);
        if (!mainImageId && response.data.images.length > 0) {
          setMainImageId(response.data.images[0].id);
        }
      } catch (err) {
        console.error('Upload failed:', err);
        alert('Failed to upload images');
        newUploadingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
      } finally {
        setUploadingFiles([]);
        setUploading(false);
      }
    },
    [images, userId, collectionId, itemId, mainImageId, onImagesChange],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    const imageId = deleteConfirmId;
    setDeleteConfirmId(null);
    if (!imageId) return;
    try {
      await api.delete(`/images/${userId}/${collectionId}/${itemId}/${imageId}`);
      const newImages = images.filter((img) => img.id !== imageId);
      setImages(newImages);
      onImagesChange(newImages);

      if (itemId !== 'temp') {
        const next = [...pendingDeletions, imageId];
        setPendingDeletions(next);
        onPendingDeletionsChange?.(next);
      }
      if (mainImageId === imageId) setMainImageId(newImages.length > 0 ? newImages[0].id : null);
      if (activeImageId === imageId) setActiveImageId(newImages.length > 0 ? newImages[0].id : null);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete image');
    }
  };

  // ── Set main ──────────────────────────────────────────────────────────────

  const handleSetMain = (imageId: string) => {
    setMainImageId(imageId);
    const newImages = [
      images.find((img) => img.id === imageId)!,
      ...images.filter((img) => img.id !== imageId),
    ];
    setImages(newImages);
    onImagesChange(newImages);
  };

  // ── Editor open/save ──────────────────────────────────────────────────────

  const openEditor = (image: ImageData) => {
    setEditingImage(image);
  };

  const handleSaveEdit = async () => {
    if (!editingImage) return;
    // Read crop state from the editor ref at the moment of saving
    const cropState = cropEditorRef.current?.getCropState() ?? { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipH: false };
    try {
      const response = await api.post(
        `/images/${userId}/${collectionId}/${itemId}/${editingImage.id}/process`,
        {
          rotation: cropState.rotation,
          offsetX:  cropState.offsetX,
          offsetY:  cropState.offsetY,
          scale:    cropState.scale,
          flipH:    cropState.flipH,
          aspect:   getCropAspect(),
        },
      );

      // Always cache-bust — the file on disk changed but the URL is identical,
      // so the browser would serve the stale cached version without this.
      const bust = `?t=${Date.now()}`;
      const base: ImageData = response.data?.image ?? editingImage;
      const updatedImage: ImageData = {
        ...base,
        url:          base.url.split("?")[0] + bust,
        thumbnailUrl: base.thumbnailUrl.split("?")[0] + bust,
      };

      setImages((prev) => {
        const next = prev.map((img) => (img.id === editingImage.id ? updatedImage : img));
        onImagesChange(next);
        return next;
      });

      setEditingImage(null);
    } catch (err) {
      console.error('Edit failed:', err);
      alert('Failed to process image');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC VIEW
  // ─────────────────────────────────────────────────────────────────────────

  if (isPublicView) {
    if (images.length === 0) return null;

    const activeImage = images.find((img) => img.id === activeImageId) || images[0];

    return (
      <div className="space-y-4">
        <Card className="overflow-hidden py-0">
          <div className={`relative ${getAspectClass()} bg-muted`}>
            <ProgressiveImage
              key={activeImage.id}
              src={activeImage.url}
              thumbnailSrc={activeImage.thumbnailUrl}
              alt={activeImage.filename}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setZoomImageUrl(`${BACKEND_URL}${activeImage.url}`)}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => setZoomImageUrl(`${BACKEND_URL}${activeImage.url}`)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sortedImages.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveImageId(img.id)}
                className={`relative flex-shrink-0 ${getThumbnailClass()} rounded-md overflow-hidden border-2 transition-all ${
                  img.id === activeImageId
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-muted-foreground/50'
                }`}
              >
                <img
                  src={`${BACKEND_URL}${img.thumbnailUrl}`}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
                {img.id === activeImageId && <div className="absolute inset-0 bg-primary/10" />}
                {img.id === mainImageId && (
                  <div className="absolute top-1 left-1 bg-yellow-500 rounded-full p-0.5">
                    <Star className="h-3 w-3 text-white fill-current" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <Dialog open={!!zoomImageUrl} onOpenChange={() => setZoomImageUrl(null)}>
          <DialogContent className="max-w-4xl">
            {zoomImageUrl && (
              <img
                src={zoomImageUrl}
                alt="Zoomed view"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EDIT VIEW
  // ─────────────────────────────────────────────────────────────────────────

  const activeImage =
    sortedImages.find((img) => img.id === activeImageId) || sortedImages[0] || null;

  return (
    <div className="space-y-4" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Main Image Display or Upload Zone */}
      <Card className="overflow-hidden py-0">
        <div className={`relative ${getAspectClass()} bg-muted`}>
          {activeImage ? (
            <>
              <ProgressiveImage
                key={activeImage.id}
                src={activeImage.url}
                thumbnailSrc={activeImage.thumbnailUrl}
                alt={activeImage.filename}
                className="w-full h-full object-cover"
              />

              {activeImage.id === mainImageId && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Main Image
                </div>
              )}

              <div className="absolute top-2 right-2 flex gap-2">
                {activeImage.id !== mainImageId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSetMain(activeImage.id)}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Set Main
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditor(activeImage)}
                >
                  <CropIcon className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteConfirmId(activeImage.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Upload className="h-12 w-12 mb-4 text-muted-foreground" />
              {uploading ? (
                <p className="text-muted-foreground">Uploading...</p>
              ) : isDragActive ? (
                <p className="text-muted-foreground">Drop images here...</p>
              ) : (
                <div className="text-center">
                  <p className="font-medium">No images yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add images using the button below
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Upload progress indicators */}
      <AnimatePresence>
        {uploadingFiles.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-muted border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center gap-3">
              <div className={`relative ${getThumbnailClass()} rounded overflow-hidden flex-shrink-0`}>
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={file.progress} className="flex-1" />
                  <span className="text-xs text-muted-foreground">{file.progress}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Thumbnail gallery + add button */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={open}
          disabled={uploading}
          className={`relative flex-shrink-0 ${getThumbnailClass()} rounded-md overflow-hidden border-2 border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center group ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex flex-col items-center gap-1">
            {uploading ? (
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            ) : (
              <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
              {uploading ? 'Uploading...' : 'Add Image'}
            </span>
          </div>
        </button>

        {sortedImages.map((img) => (
          <div
            key={img.id}
            className={`relative flex-shrink-0 ${getThumbnailClass()} rounded-md overflow-hidden border-2 transition-all group cursor-pointer ${
              img.id === activeImageId
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-transparent hover:border-muted-foreground/50'
            }`}
            onClick={() => setActiveImageId(img.id)}
          >
            <img
              src={`${BACKEND_URL}${img.thumbnailUrl}`}
              alt={img.filename}
              className="w-full h-full object-cover"
            />
            {img.id === mainImageId && (
              <div className="absolute top-1 left-1 bg-yellow-500 rounded-full p-0.5">
                <Star className="h-3 w-3 text-white fill-current" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending deletions warning */}
      <AnimatePresence>
        {pendingDeletions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded"
          >
            <p className="text-sm font-medium">
              {pendingDeletions.length} image(s) marked for deletion. They will be permanently
              removed when you save the item.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              This image will be permanently deleted when you save the item. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Image editor dialog ── */}
      {editingImage && (
        <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
          <DialogContent className="max-w-2xl w-full mx-2 sm:mx-auto">
            <DialogHeader>
              <DialogTitle>Edit Image</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Pan & zoom crop editor — rotation slider is inside CropEditor */}
              <CropEditor
                key={`${editingImage.id}-${getCropAspect()}`}
                ref={cropEditorRef}
                src={`${BACKEND_URL}${editingImage.url}`}
                aspect={getCropAspect()}
              />

              <p className="text-xs text-muted-foreground">
                Drag to pan · Scroll or slider to zoom · Rotate slider below the frame
              </p>
            </div>

            <DialogFooter>
              <Button type="button" onClick={handleSaveEdit}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}