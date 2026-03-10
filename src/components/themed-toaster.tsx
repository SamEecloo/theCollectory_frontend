import { Toaster } from 'sonner';
import { useTheme } from '@/context/theme-context';

export function ThemedToaster() {
  const { theme } = useTheme();

  return (
    <Toaster 
      position="top-right" 
      richColors 
      theme={theme as 'light' | 'dark'}
      closeButton
    />
  );
}