import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { getCroppedImg, type Area } from "@/lib/cropImage";

interface PhotoEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onSave: (croppedBlob: Blob) => Promise<void>;
  onCancel: () => void;
}

export const PhotoEditorDialog = ({
  open,
  onOpenChange,
  imageFile,
  onSave,
  onCancel,
}: PhotoEditorDialogProps) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageUrl) return;

    try {
      setSaving(true);
      const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
      await onSave(croppedBlob);
    } catch (error) {
      // Cropping error handled by caller
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Photo</DialogTitle>
          <DialogDescription>
            Adjust and crop your photo. Use the slider to zoom and drag to reposition.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="zoom-slider" className="min-w-[60px]">
              Zoom
            </Label>
            <Slider
              id="zoom-slider"
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <span className="min-w-[40px] text-sm text-muted-foreground">
              {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
