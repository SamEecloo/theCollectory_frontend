import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

type Props = {
  mode: 'view' | 'edit';
  onBack?: () => void;
};

export default function ItemNavigation({ mode, onBack }: Props) {
  const { username, collectionName, itemId } = useParams();
  const navigate = useNavigate();

  // Get navigation list from sessionStorage
  const navigationData = sessionStorage.getItem('itemNavigationList');
  const navigationList = navigationData ? JSON.parse(navigationData) : null;
  
  const itemIds = navigationList?.itemIds || [];
  const currentIndex = itemIds.indexOf(itemId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < itemIds.length - 1;
  
  const goToPrevious = () => {
    if (hasPrevious && collectionName) {
      const prevId = itemIds[currentIndex - 1];
      const path = mode === 'edit' 
        ? `/collections/${encodeURIComponent(collectionName)}/items/${prevId}/edit`
        : `/${username}/${encodeURIComponent(collectionName)}/items/${prevId}`;
      navigate(path);
    }
  };
  
  const goToNext = () => {
    if (hasNext && collectionName) {
      const nextId = itemIds[currentIndex + 1];
      const path = mode === 'edit'
        ? `/collections/${encodeURIComponent(collectionName)}/items/${nextId}/edit`
        : `/${username}/${encodeURIComponent(collectionName)}/items/${nextId}`;
      navigate(path);
    }
  };
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(`/${username}/${encodeURIComponent(collectionName || '')}`);
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable) {
        return;
      }
      
      if (e.key === 'ArrowLeft' && hasPrevious) {
        e.preventDefault();
        goToPrevious();
      }
      if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        goToNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [hasPrevious, hasNext, currentIndex, mode]);

  // Don't render if no navigation context
  if (itemIds.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleBack}
          title="Back to collection"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
   <div className="flex items-center justify-between w-full">
      <Button
        variant="outline"
        onClick={goToPrevious}
        disabled={!hasPrevious}
        title="Previous item (←)"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>
      
      <span className="text-sm text-muted-foreground">
        {currentIndex + 1} of {itemIds.length}
      </span>
      
      <Button
        variant="outline"
        onClick={goToNext}
        disabled={!hasNext}
        title="Next item (→)"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}