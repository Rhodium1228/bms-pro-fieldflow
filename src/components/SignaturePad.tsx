import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, RotateCcw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SignaturePadProps {
  onSignatureSave: (signatureUrl: string) => void;
  onCancel: () => void;
  label?: string;
}

const SignaturePad = ({ onSignatureSave, onCancel, label = "Customer Signature" }: SignaturePadProps) => {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleClear = () => {
    sigPadRef.current?.clear();
  };

  const handleSave = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      toast({
        title: "Signature required",
        description: "Please provide a signature before saving",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Convert canvas to blob
      const canvas = sigPadRef.current.getCanvas();
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob as Blob);
        }, "image/png");
      });

      // Upload to Supabase Storage
      const fileName = `${user.id}/signatures/${Date.now()}.png`;
      const { error: uploadError, data } = await supabase.storage
        .from('job-photos')
        .upload(fileName, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName);

      onSignatureSave(publicUrl);

      toast({
        title: "Signature saved",
        description: "Signature captured successfully",
      });
    } catch (error) {
      console.error('Signature save error:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save signature",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-border rounded-lg bg-background overflow-hidden">
          <SignatureCanvas
            ref={sigPadRef}
            canvasProps={{
              className: "w-full h-48 touch-none",
              style: { touchAction: 'none' }
            }}
            backgroundColor="#ffffff"
            penColor="#000000"
            minWidth={1}
            maxWidth={2}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="flex-1"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            <Check className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Sign above to confirm job completion
        </p>
      </CardContent>
    </Card>
  );
};

export default SignaturePad;
