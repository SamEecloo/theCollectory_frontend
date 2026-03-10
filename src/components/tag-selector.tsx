import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

type Props = {
  collectionName: string;
  collectionId: string;
  value: string[]; // Array of selected tags
  onChange: (tags: string[]) => void;
  placeholder?: string;
  allowCreate?: boolean; // ADD THIS
  isPublicView?: boolean;
};

export default function TagSelector({ 
  collectionId,
  value = [], 
  onChange,
  placeholder = "Select tags...",
  allowCreate = false,
}: Props) {
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // ADD THIS

  useEffect(() => {
    if (collectionId) {
      fetchTags();
    }
  }, [collectionId]);

  const fetchTags = async () => {
    try {
      
      const res = await api.get(`/collections/${collectionId}/tags`);
      setAvailableTags(res.data.tags || []);
    } catch (e) {
      console.error("Failed to load tags", e);
    }
  };

  const toggleTag = (tag: string) => {
    const newTags = value.includes(tag)
      ? value.filter((t) => t !== tag)
      : [...value, tag];
    onChange(newTags);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const createNewTag = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    
    // Add to selected tags
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    
    // Add to available tags if not already there
    if (!availableTags.includes(trimmed)) {
      setAvailableTags([...availableTags, trimmed]);
    }
    
    setSearchQuery('');
  };

  // Check if search query matches an existing tag
  const searchMatchesExisting = availableTags.some(
    tag => tag.toLowerCase() === searchQuery.toLowerCase()
  );

  return (
    <div className="space-y-2">
      {/* Popover Selector */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={popoverOpen}
            className="w-full justify-between"
          >
            {value.length > 0
              ? `${value.length} tag${value.length > 1 ? 's' : ''} selected`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search tags..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {/* Create new tag option */}
              {allowCreate && searchQuery.trim() && !searchMatchesExisting && (
                <CommandGroup>
                  <CommandItem
                    onSelect={createNewTag}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create "{searchQuery.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}

              {/* Existing tags filtered by search */}
              <CommandGroup>
                {availableTags
                  .filter(tag => 
                    tag.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((tag) => {
                    const isSelected = value.includes(tag);
                    return (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={() => toggleTag(tag)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {tag}
                      </CommandItem>
                    );
                  })}
              </CommandGroup>

              {availableTags.filter(tag => 
                tag.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && !allowCreate && (
                <CommandEmpty>No tags found.</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
            {/* Selected Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeTag(tag)}
              />
            </Badge>
          ))}
        </div>
      )}

    </div>
  );
}