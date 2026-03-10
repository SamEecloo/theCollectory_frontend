import { useDropzone } from 'react-dropzone';
import { type ReactNode } from 'react';
import { Upload } from 'lucide-react';

type Props = {
  onDrop: (files: File[]) => void;
  children: ReactNode;
  isUploading?: boolean;
  disabled?: boolean;
  as?: 'div' | 'tr'; // Add this
  className?: string; // Add this
};

export default function ItemDropZone({ 
  onDrop, 
  children, 
  isUploading, 
  disabled,
  as: Component = 'div', // Default to div
  className 
}: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
    disabled,
  });

  return (
    <Component {...getRootProps()} className={className}>
      <input {...getInputProps()} />
      {isDragActive && (
        <td 
          colSpan={999} 
          className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded flex items-center justify-center z-10 pointer-events-none"
        >
          <Upload className="h-6 w-6 text-primary" />
        </td>
      )}
      
      {isUploading && (
        <td 
          colSpan={999}
          className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 pointer-events-none"
        >
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        </td>
      )}
      {children}
    </Component>
  );
}