// src/components/image-upload-manager.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
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
import { Upload, X, Star, RotateCw, Crop as CropIcon, ZoomIn, ZoomOut, Check, Plus, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

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

type ImageUploadManagerProps = {
  userId: string;
  collectionId: string;
  itemId: string;
  initialImages?: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  onPendingDeletionsChange?: (imageIds: string[]) => void;
  resetPendingDeletions?: boolean;
  isPublicView?: boolean;
  orientation?: "landscape" | "portrait" | "square";
};

// Progressive Image Component with loading state reset on src change
function ProgressiveImage({ 
  src, 
  thumbnailSrc, 
  alt, 
  className,
  onClick
}: { 
  src: string; 
  thumbnailSrc: string; 
  alt: string; 
  className?: string;
  onClick?: () => void;
}) {
  const [isFullImageLoaded, setIsFullImageLoaded] = useState(false);

  // Reset loading state when src changes
  useEffect(() => {
    setIsFullImageLoaded(false);
  }, [src]);

  return (
    <div className="relative w-full h-full">
      {/* Thumbnail - visible while full image loads */}
      <img
        src={`${BACKEND_URL}${thumbnailSrc}`}
        alt={alt}
        className={`${className} transition-opacity duration-300 blur-2xl scale-110 ${
          isFullImageLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      />
      
      {/* Full image - fades in when loaded */}
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

export default function ImageUploadManager({
  userId,
  collectionId,
  itemId,
  initialImages = [],
  onImagesChange,
  onPendingDeletionsChange,
  resetPendingDeletions,
  isPublicView = false,
  orientation = "landscape",
}: ImageUploadManagerProps) {
  const [images, setImages] = useState<ImageData[]>(initialImages);
  const [mainImageId, setMainImageId] = useState<string | null>(
    initialImages.length > 0 ? initialImages[0].id : null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [editingImage, setEditingImage] = useState<ImageData | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(
    initialImages.length > 0 ? initialImages[0].id : null
  );
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setImages(initialImages);
    setMainImageId(initialImages.length > 0 ? initialImages[0].id : null);
    setActiveImageId(initialImages.length > 0 ? initialImages[0].id : null);
  }, [initialImages]);

  useEffect(() => {
    if (resetPendingDeletions) {
      setPendingDeletions([]);
    }
  }, [resetPendingDeletions]);

  useEffect(() => {
    setActiveImageId(mainImageId);
  }, [mainImageId]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);

    // Create preview URLs and initial uploading file objects
    const newUploadingFiles: UploadingFile[] = acceptedFiles.map((file, index) => ({
      id: `uploading-${Date.now()}-${index}`,
      name: file.name,
      progress: 0,
      preview: URL.createObjectURL(file),
    }));

    setUploadingFiles(newUploadingFiles);

    try {
      const formData = new FormData();
      acceptedFiles.forEach(file => formData.append('images', file));
      formData.append('userId', userId);
      formData.append('collectionId', collectionId);
      formData.append('itemId', itemId);

      const response = await api.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;

          // Update all uploading files with the same progress
          setUploadingFiles(prev =>
            prev.map(file => ({ ...file, progress: percentCompleted }))
          );
        },
      });

      // Clean up preview URLs
      newUploadingFiles.forEach(file => URL.revokeObjectURL(file.preview));

      const newImages = [...images, ...response.data.images];
      setImages(newImages);
      onImagesChange(newImages);

      if (!mainImageId && response.data.images.length > 0) {
        setMainImageId(response.data.images[0].id);
      }

      setUploadingFiles([]);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload images');
      // Clean up preview URLs on error
      newUploadingFiles.forEach(file => URL.revokeObjectURL(file.preview));
      setUploadingFiles([]);
    } finally {
      setUploading(false);
    }
  }, [images, userId, collectionId, itemId, mainImageId, onImagesChange]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const handleDelete = async (imageId: string) => {
    if (!confirm('Mark this image for deletion? It will be permanently deleted when you save the item.')) return;

    try {
      await api.delete(`/images/${userId}/${collectionId}/${itemId}/${imageId}`);

      const newImages = images.filter(img => img.id !== imageId);
      setImages(newImages);
      onImagesChange(newImages);
      if (itemId !== 'temp') {
        const newPendingDeletions = [...pendingDeletions, imageId];
        setPendingDeletions(newPendingDeletions);
        if (onPendingDeletionsChange) {
          onPendingDeletionsChange(newPendingDeletions);
        }
      }

      if (mainImageId === imageId) {
        setMainImageId(newImages.length > 0 ? newImages[0].id : null);
      }
      if (activeImageId === imageId) {
        setActiveImageId(newImages.length > 0 ? newImages[0].id : null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete image');
    }
  };

  const handleSetMain = (imageId: string) => {
    setMainImageId(imageId);
    const newImages = [
      images.find(img => img.id === imageId)!,
      ...images.filter(img => img.id !== imageId),
    ];
    setImages(newImages);
    onImagesChange(newImages);
  };

  const openEditor = (image: ImageData) => {
    setEditingImage(image);
    setCrop(undefined);
    setRotation(0);
    setZoom(1);
  };

  const handleSaveEdit = async () => {
    if (!editingImage) return;

    try {
      const response = await api.post(`/images/${userId}/${collectionId}/${itemId}/${editingImage.id}/process`, {
        rotation,
        crop: crop ? {
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height,
        } : null,
        zoom,
      });

      // Use the updated image returned by the backend, or bust the cache on the existing URLs
      const updatedImage: ImageData = response.data?.image ?? {
        ...editingImage,
        url: `${editingImage.url}?t=${Date.now()}`,
        thumbnailUrl: `${editingImage.thumbnailUrl}?t=${Date.now()}`,
      };

      setImages(prev => {
        const newImages = prev.map(img =>
          img.id === editingImage.id ? updatedImage : img
        );
        onImagesChange(newImages);
        return newImages;
      });

      setEditingImage(null);
    } catch (err) {
      console.error('Edit failed:', err);
      alert('Failed to process image');
    }
  };
  const sortedImages = [...images].sort((a, b) => {
    if (a.id === mainImageId) return -1;
    if (b.id === mainImageId) return 1;
    return 0;
  });

  const getAspectClass = () => {
    switch (orientation) {
      case 'portrait':
        return 'aspect-[3/4]';
      case 'square':
        return 'aspect-square';
      case 'landscape':
      default:
        return 'aspect-video';
    }
  };

  const getThumbnailClass = () => {
    switch (orientation) {
      case 'portrait':
        return 'aspect-[3/4] w-20';
      case 'square':
        return 'aspect-square w-20';
      case 'landscape':
      default:
        return 'aspect-[4/3] w-32';
    }
  };

  const getCropAspect = () => {
    switch (orientation) {
      case 'portrait':
        return 3 / 4;
      case 'square':
        return 1;
      case 'landscape':
      default:
        return 4 / 3;
    }
  };

  // PUBLIC VIEW MODE
  if (isPublicView) {
    if (images.length === 0) {
      return null;
    }

    const activeImage = images.find(img => img.id === activeImageId) || images[0];

    return (
      <div className="space-y-4">
        {/* Main Image Display */}
        <Card className="overflow-hidden py-0">
          <div className={`relative ${getAspectClass()} bg-muted`}>
            <ProgressiveImage
              key={activeImage.id}
              src={activeImage.url}
              thumbnailSrc={activeImage.thumbnailUrl}
              alt={activeImage.filename}
              className="w-full h-full object-contain cursor-zoom-in"
              onClick={() => setZoomImageUrl(`${BACKEND_URL}${activeImage.url}`)}
            />
            <Button
              variant="secondary"
              type="button"
              size="icon"
              className="absolute top-2 right-2 opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => setZoomImageUrl(`${BACKEND_URL}${activeImage.url}`)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Thumbnail Gallery */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sortedImages.map((img) => (
              <button
                type="button"
                key={img.id}
                onClick={() => setActiveImageId(img.id)}
                className={`relative flex-shrink-0 ${getThumbnailClass()} rounded-md overflow-hidden border-2 transition-all ${
                  img.id === activeImageId
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent hover:border-muted-foreground/50"
                }`}
              >
                <img
                  src={`${BACKEND_URL}${img.thumbnailUrl}`}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
                {img.id === activeImageId && (
                  <div className="absolute inset-0 bg-primary/10" />
                )}
                {img.id === mainImageId && (
                  <div className="absolute top-1 left-1 bg-yellow-500 rounded-full p-0.5">
                    <Star className="h-3 w-3 text-white fill-current" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Zoom Dialog */}
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

  // EDIT MODE
  const activeImage = sortedImages.find(img => img.id === activeImageId) || sortedImages[0] || null;

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
                className="w-full h-full object-contain"
              />
              
              {/* Main Image Badge */}
              {activeImage.id === mainImageId && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Main Image
                </div>
              )}

              {/* Actions */}
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
                  onClick={() => handleDelete(activeImage.id)}
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
                  <p className="text-sm text-muted-foreground mt-1">Add images using the button below</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Upload Progress Indicators - Always visible when uploading */}
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

      {/* Thumbnail Gallery with Add Button */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {/* Add Image Button */}
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

        {/* All Images */}
        {sortedImages.map((img) => (
          <div
            key={img.id}
            className={`relative flex-shrink-0 ${getThumbnailClass()} rounded-md overflow-hidden border-2 transition-all group cursor-pointer ${
              img.id === activeImageId
                ? "border-primary ring-2 ring-primary/20"
                : "border-transparent hover:border-muted-foreground/50"
            }`}
            onClick={() => setActiveImageId(img.id)}
          >
            <img
              src={`${BACKEND_URL}${img.thumbnailUrl}`}
              alt={img.filename}
              className="w-full h-full object-cover"
            />

            {/* Star badge for main image */}
            {img.id === mainImageId && (
              <div className="absolute top-1 left-1 bg-yellow-500 rounded-full p-0.5">
                <Star className="h-3 w-3 text-white fill-current" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending Deletions Warning */}
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
              {pendingDeletions.length} image(s) marked for deletion. They will be permanently removed when you save the item.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Editor Dialog */}
      {editingImage && (
        <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Image</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Controls */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRotation((rotation + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  Rotate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                >
                  <ZoomOut className="h-4 w-4 mr-1" />
                  Zoom Out
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                >
                  <ZoomIn className="h-4 w-4 mr-1" />
                  Zoom In
                </Button>
                <span className="text-sm self-center">Zoom: {(zoom * 100).toFixed(0)}%</span>
              </div>

              {/* Crop Area */}
              <div className="max-h-[60vh] overflow-auto">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  aspect={getCropAspect()}
                >
                  <img
                    ref={imgRef}
                    src={`${BACKEND_URL}${editingImage.url}`}
                    alt=""
                    style={{
                      transform: `rotate(${rotation}deg) scale(${zoom})`,
                      maxWidth: '100%',
                    }}
                  />
                </ReactCrop>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingImage(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveEdit}>
                <Check className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}