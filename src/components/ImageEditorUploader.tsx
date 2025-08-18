// src/components/ImageEditorUploader.tsx
import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import api from "@/lib/api";
import { getCroppedBlob, blobToFile } from "@/lib/cropImage";

type UploadedImage = { url: string; thumbUrl: string };

export default function ImageEditorUploader({
  orientation,
  collectionId,
  itemId,
  max = 10,
  onDone,
}: {
  orientation: string;
  collectionId: string;
  itemId: string;
  max?: number;
  onDone: (images: UploadedImage[]) => void;
}) {
  const [files, setFiles] = useState<string[]>([]); // local previews (data URLs)
  const [current, setCurrent] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [queue, setQueue] = useState<{ src: string; name: string; blob: Blob }[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl?.length) return;
    const arr = Array.from(fl)
      .slice(0, max - files.length)
      .map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...arr]);
    setCurrent((prev) => (prev === null ? 0 : prev));
  };

  const onCropComplete = useCallback((_area: any, areaPixels: any) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const addToQueue = async () => {
    if (current === null || !files[current] || !croppedAreaPixels) return;
    const blob = await getCroppedBlob(files[current], croppedAreaPixels, rotation);
    const name = `img_${Date.now()}.jpg`;
    setQueue((prev) => [...prev, { src: files[current], name, blob }]);
    // move to next image if available
    setCurrent((idx) => (idx === null ? null : Math.min(idx + 1, files.length - 1)));
  };

  const uploadAll = async () => {
    if (!queue.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      queue.forEach((q) => fd.append("images", new File([q.blob], q.name, { type: "image/jpeg" })));
      const res = await api.post(`/upload/images/${collectionId}/${itemId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onDone(res.data.images as UploadedImage[]); // [{ url, thumbUrl }]
      // reset
      setFiles([]);
      setQueue([]);
      setCurrent(null);
      setZoom(1);
      setRotation(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input ref={inputRef} type="file" accept="image/*" multiple onChange={onSelect} />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Pick images
        </Button>
      </div>

      {current !== null && files[current] && (
        <div className="grid gap-3 md:grid-cols-[1fr,260px]">
          <div className="relative aspect-video w-full rounded-md overflow-hidden border">
            <Cropper
              image={files[current]}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={orientation === "portrait" ? 3/4 : orientation === "landscape" ? 16/9 : 1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              zoomWithScroll
              showGrid
              objectFit={
                orientation === "portrait"
                  ? "vertical-cover"     // fit height; width can overflow
                  : orientation === "landscape"
                  ? "horizontal-cover"   // fit width; height can overflow
                  : "contain"            // square: show full image
              }
            />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-sm mb-2">Zoom</div>
              <Slider value={[zoom]} min={1} max={4} step={0.1} onValueChange={(v) => setZoom(v[0])} />
            </div>
            <div>
              <div className="text-sm mb-2">Rotation</div>
              <Slider value={[rotation]} min={-180} max={180} step={1} onValueChange={(v) => setRotation(v[0])} />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => setRotation((r) => r - 90)}>-90°</Button>
              <Button type="button" onClick={() => setRotation((r) => r + 90)}>+90°</Button>
            </div>
            <Button type="button" onClick={addToQueue}>Add crop to queue</Button>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((src, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrent(idx)}
              className={`h-20 w-20 rounded border overflow-hidden ${current === idx ? "ring-2 ring-primary" : ""}`}
            >
              <img src={src} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm">Queued crops: {queue.length}</div>
          <div className="flex gap-2">
            <Button type="button" onClick={uploadAll} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload all"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setQueue([])} disabled={uploading}>
              Clear queue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
