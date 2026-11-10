import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";

interface ReadingStepProps {
  // The object URL of the photo that the model reads. null: a link or a text, shown as a page.
  preview: string | null;
  // "Mistral Small reads it.", or the reason of a switch.
  line: string;
  onCancel: () => void;
}

const PAGE_LINES = ["70%", "90%", "82%", "88%", "40%", "92%", "76%", "85%", "60%"];

export function ReadingStep({ preview, line, onCancel }: ReadingStepProps) {
  const card = {
    width: 180,
    height: 232,
    borderRadius: "16px",
    border: 1,
    borderColor: "divider",
    bgcolor: "background.paper",
    boxShadow: "0 10px 30px rgba(22, 32, 27, 0.10)",
    transform: "rotate(-3deg)",
    overflow: "hidden",
  } as const;

  return (
    <Stack spacing={3.5} sx={{ alignItems: "center", textAlign: "center", py: { xs: 4, md: 3 }, minHeight: { xs: "60vh", md: 0 }, justifyContent: "center" }}>
      {preview ? (
        <Box component="img" src={preview} alt="" sx={{ ...card, objectFit: "cover" }} />
      ) : (
        <Box aria-hidden sx={{ ...card, p: 2.25, display: "flex", flexDirection: "column", gap: 1.25 }}>
          {PAGE_LINES.map((width, i) => (
            <Box
              key={i}
              sx={(t) => ({
                width,
                height: i === 0 ? 10 : 6,
                mt: i === 4 ? 1 : 0,
                borderRadius: "3px",
                bgcolor: i === 0 || i === 4 ? t.herb.ink2 : t.herb.line,
                opacity: i === 0 || i === 4 ? 0.4 : 1,
              })}
            />
          ))}
        </Box>
      )}
      <Stack spacing={1.5} sx={{ alignItems: "center", width: "100%" }}>
        <LinearProgress aria-label="Reading the recipe" sx={{ width: 200, borderRadius: 2 }} />
        <Typography data-step-focus tabIndex={-1} variant="h5" component="h1" sx={{ fontSize: 24, outline: "none" }}>
          Reading the recipe…
        </Typography>
        <Typography role="status" color="text.secondary" sx={{ fontSize: 15, maxWidth: 420 }}>
          {line} This can take 30 seconds.
        </Typography>
      </Stack>
      <Button variant="outlined" color="inherit" onClick={onCancel} sx={{ width: { xs: "100%", md: "auto" }, minWidth: 160 }}>
        Cancel
      </Button>
    </Stack>
  );
}
