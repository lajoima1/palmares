import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import AddPhotoAlternate from "@mui/icons-material/AddPhotoAlternate";
import Delete from "@mui/icons-material/Delete";
import type { PhotoChange } from "./api";
import { PhotoError, processPhoto } from "./photo";

interface PhotoFieldProps {
  // The saved photo, or null if the recipe has none.
  currentUrl: string | null;
  change: PhotoChange;
  onChange: (change: PhotoChange) => void;
  onBusy: (busy: boolean) => void;
}

export function PhotoField({ currentUrl, change, onChange, onBusy }: PhotoFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProcessing(true);
    onBusy(true);
    try {
      const photo = await processPhoto(file);
      setPreview(URL.createObjectURL(photo.blob));
      setSize(`${photo.width} × ${photo.height}, ${Math.round(photo.blob.size / 1024)} KB`);
      onChange(photo.base64);
    } catch (e) {
      setError(e instanceof PhotoError ? e.message : "The photo could not be processed. Try another photo.");
    } finally {
      setProcessing(false);
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const shown = typeof change === "string" ? preview : change === null ? null : currentUrl;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" color="text.secondary">
        Photo
      </Typography>
      <Box
        sx={{
          width: "100%",
          aspectRatio: "4 / 3",
          maxHeight: 320,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "action.hover",
        }}
      >
        {shown ? (
          <Box component="img" src={shown} alt="Recipe photo" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Typography color="text.secondary">No photo</Typography>
        )}
      </Box>
      {processing && <LinearProgress aria-label="Processing the photo" />}
      {size && typeof change === "string" && (
        <Typography variant="caption" color="text.secondary">
          New photo: {size}
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" startIcon={<AddPhotoAlternate />} onClick={() => input.current?.click()} disabled={processing}>
          Choose photo
        </Button>
        {shown && (
          <Button color="error" startIcon={<Delete />} onClick={() => onChange(null)} disabled={processing}>
            Remove
          </Button>
        )}
      </Stack>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label="Photo file"
        onChange={(e) => choose(e.target.files?.[0])}
      />
    </Stack>
  );
}
