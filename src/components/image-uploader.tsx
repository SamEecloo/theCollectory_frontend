import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "@/lib/api";

type Props = {
  onUpload: (url: string) => void;
};

export default function ImageUploader({ onUpload }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("image", file);

    axios.post("/upload", formData).then(res => {
      onUpload(res.data.imageUrl);
    });
  }, [onUpload]);

  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { "image/*": [] } });

  return (
    <div {...getRootProps()} className="border p-4 rounded cursor-pointer text-center">
      <input {...getInputProps()} />
      {preview ? <img src={preview} alt="Preview" className="mx-auto h-80 max-h-80" /> : "Click or drop image"}
    </div>
  );
}
