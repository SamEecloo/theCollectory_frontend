// Utilities
const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

const toRad = (deg: number) => (deg * Math.PI) / 180;

const rotateSize = (width: number, height: number, rotation: number) => {
  const rw = Math.abs(Math.cos(rotation) * width) + Math.abs(Math.sin(rotation) * height);
  const rh = Math.abs(Math.sin(rotation) * width) + Math.abs(Math.cos(rotation) * height);
  return { width: rw, height: rh };
};

// Main helper compatible with react-easy-crop's croppedAreaPixels
export async function getCroppedBlob(
  imageSrc: string,
  croppedAreaPixels: { x: number; y: number; width: number; height: number },
  rotation = 0,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const rot = toRad(rotation);

  // 1) Draw the rotated image onto a temp canvas large enough to contain it
  const { width: bWidth, height: bHeight } = rotateSize(image.width, image.height, rot);
  const tempCanvas = document.createElement("canvas");
  const tctx = tempCanvas.getContext("2d")!;
  tempCanvas.width = Math.round(bWidth);
  tempCanvas.height = Math.round(bHeight);

  // move origin to center, rotate, draw image centered
  tctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
  tctx.rotate(rot);
  tctx.drawImage(image, -image.width / 2, -image.height / 2);
  tctx.setTransform(1, 0, 0, 1, 0, 0);

  // 2) Now crop from the rotated canvas using the provided pixel box
  // croppedAreaPixels are relative to the image pixels, which now live on tempCanvas
  const { x, y, width, height } = croppedAreaPixels;

  const out = document.createElement("canvas");
  out.width = Math.round(width);
  out.height = Math.round(height);
  const octx = out.getContext("2d")!;

  octx.drawImage(
    tempCanvas,
    Math.round(x),           // sx
    Math.round(y),           // sy
    Math.round(width),       // sWidth
    Math.round(height),      // sHeight
    0,                       // dx
    0,                       // dy
    Math.round(width),       // dWidth
    Math.round(height)       // dHeight
  );

  return await new Promise<Blob>((resolve) => {
    out.toBlob((b) => resolve(b as Blob), mime, quality);
  });
}

export const blobToFile = (b: Blob, name: string) => new File([b], name, { type: b.type || "image/jpeg" });
