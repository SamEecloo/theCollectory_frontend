// src/components/bulk-actions.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, X, Edit } from "lucide-react";
import  BulkUpdateDialog from "@/components/bulk-update-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import api from "@/lib/api";

type Field = {
  _id: string;
  short: string;
  long: string;
  type: string;
  options?: { _id: string; short: string; long: string }[];
};

type BulkActionsProps = {
  selectedIds: string[];
  fields: Field[]; // ADD this
  onClearSelection: () => void;
  onDeleteComplete: () => void;
  onUpdateComplete: () => void; // ADD this
};

export default function BulkActions({ 
  selectedIds, 
  fields,
  onClearSelection, 
  onDeleteComplete,
  onUpdateComplete 
}: BulkActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false); // ADD this
  const [deleting, setDeleting] = useState(false);

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      await api.post('/items/delete-multiple', { itemIds: selectedIds });
      setShowDeleteDialog(false);
      onClearSelection();
      onDeleteComplete(); // Refresh the list
    } catch (err) {
      console.error("Bulk delete failed", err);
      alert("Failed to delete items");
    } finally {
      setDeleting(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4 z-50">
      <span className="text-sm font-medium">
        {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
      </span>
      
      <div className="flex gap-2">
        <Button
            variant="default"
            size="sm"
            onClick={() => setShowUpdateDialog(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Update
          </Button>
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the selected items from your collection.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : `Delete ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="outline"
          size="sm"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
    </div>
    <BulkUpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        selectedIds={selectedIds}
        fields={fields}
        onUpdateComplete={onUpdateComplete}
      />
      </>
  );
}