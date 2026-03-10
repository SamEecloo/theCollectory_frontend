// src/components/BulkUpdateDialog.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/api";

type Field = {
  _id: string;
  short: string;
  long: string;
  type: string;
  options?: { _id: string; short: string; long: string }[];
};

type BulkUpdateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  fields: Field[];
  onUpdateComplete: () => void;
};

export default function BulkUpdateDialog({
  open,
  onOpenChange,
  selectedIds,
  fields,
  onUpdateComplete
}: BulkUpdateDialogProps) {
  const [selectedField, setSelectedField] = useState<string>("");
  const [updateValue, setUpdateValue] = useState<any>("");
  const [updating, setUpdating] = useState(false);

  // Get the selected field config
  const fieldConfig = fields.find(f => f._id === selectedField);

  const handleUpdate = async () => {
    if (!selectedField || updateValue === "") {
      alert("Please select a field and enter a value");
      return;
    }

    setUpdating(true);
    try {
      await api.post('/items/bulk-update', {
        itemIds: selectedIds,
        updates: {
          [selectedField]: updateValue
        }
      });
      
      onOpenChange(false);
      setSelectedField("");
      setUpdateValue("");
      onUpdateComplete();
    } catch (err) {
      console.error("Bulk update failed", err);
      alert("Failed to update items");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Update {selectedIds.length} Items</DialogTitle>
          <DialogDescription>
            Select a field and set a new value for all selected items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field selector */}
          <div className="space-y-2">
            <Label>Field to Update</Label>
            <Select value={selectedField} onValueChange={(v) => {
              setSelectedField(v);
              setUpdateValue(""); // Reset value when field changes
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field..." />
              </SelectTrigger>
              <SelectContent>
                {fields
                  .filter(f => f.type !== 'image') // Exclude image fields from bulk update
                  .map(f => (
                    <SelectItem key={f._id} value={f._id}>
                      {f.long}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value input based on field type */}
          {selectedField && fieldConfig && (
            <div className="space-y-2">
              <Label>New Value</Label>
              
              {fieldConfig.type === "text" || fieldConfig.type === "textarea" ? (
                <Input
                  value={updateValue}
                  onChange={(e) => setUpdateValue(e.target.value)}
                  placeholder="Enter value..."
                />
              ) : fieldConfig.type === "number" ? (
                <Input
                  type="number"
                  value={updateValue}
                  onChange={(e) => setUpdateValue(e.target.value ? Number(e.target.value) : "")}
                  placeholder="Enter number..."
                />
              ) : fieldConfig.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={updateValue === true}
                    onCheckedChange={(v) => setUpdateValue(v === true)}
                  />
                  <Label>Set to checked</Label>
                </div>
              ) : fieldConfig.type === "dropdown" ? (
                <Select value={updateValue} onValueChange={setUpdateValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select value..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(fieldConfig.options || []).map(opt => (
                      <SelectItem key={opt._id} value={opt._id}>
                        {opt.long}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={!selectedField || updateValue === "" || updating}
          >
            {updating ? "Updating..." : `Update ${selectedIds.length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}