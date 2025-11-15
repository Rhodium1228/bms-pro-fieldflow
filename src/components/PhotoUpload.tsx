import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  jobId: string;
  existingPhotos?: string[];
  onPhotosUpdate?: (photos: string[]) => void;
  label?: string;
}

const PhotoUpload = ({ jobId, existingPhotos = [], onPhotosUpdate, label = "Upload Photos" }: PhotoUploadProps) => {
  const [photos, setPhotos] = useState<string[]>(existingPhotos);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Invalid file",
            description: `${file.name} is not an image`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 5MB limit`,
            variant: "destructive",
          });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${jobId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
          .from('job-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Use signed URL for private bucket (24 hour expiry)
        const { data: signedData, error: signedError } = await supabase.storage
          .from('job-photos')
          .createSignedUrl(fileName, 86400); // 24 hours

        if (signedError) throw signedError;
        if (signedData) uploadedUrls.push(signedData.signedUrl);
      }

      const updatedPhotos = [...photos, ...uploadedUrls];
      setPhotos(updatedPhotos);
      onPhotosUpdate?.(updatedPhotos);

      toast({
        title: "Success",
        description: `${uploadedUrls.length} photo(s) uploaded`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload photos",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async (photoUrl: string, index: number) => {
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/job-photos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('job-photos').remove([filePath]);
      }

      const updatedPhotos = photos.filter((_, i) => i !== index);
      setPhotos(updatedPhotos);
      onPhotosUpdate?.(updatedPhotos);

      toast({
        title: "Photo removed",
        description: "Photo deleted successfully",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete photo",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              {label}
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo, index) => (
            <Card key={index} className="relative overflow-hidden">
              <img
                src={photo}
                alt={`Job photo ${index + 1}`}
                className="w-full h-32 object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => handleRemovePhoto(photo, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
