import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ContentPasteRounded from "@mui/icons-material/ContentPasteRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import type { RecipeFields } from "../utils/recipeText";
import { api, type ReadSource } from "./api";
import { PhotoError, readingPhoto } from "./photo";

interface ImportFieldProps {
  tags: string[];
  model: string;
  // "photo", "text" or the host of the link, after a fill that the form kept. null: nothing filled.
  filledFrom: string | null;
  onFilled: (fields: RecipeFields, source: string) => void;
  onAgain: () => void;
  onBusy: (busy: boolean) => void;
}

type State = "rest" | "link" | "text" | "reading";

function filledLabel(source: string): string {
  if (source === "photo") return "Filled from a photo";
  if (source === "text") return "Filled from text";
  return `Filled from ${source}`;
}

export function ImportField({ tags, model, filledFrom, onFilled, onAgain, onBusy }: ImportFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const reading = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>("rest");
  const [link, setLink] = useState("");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const again = useRef<HTMLButtonElement>(null);

  // A read that is still running when the form closes stops here.
  useEffect(() => () => reading.current?.abort(), []);

  // The block that had the focus is gone after a fill. The focus goes to its next control.
  useEffect(() => {
    if (filledFrom !== null) again.current?.focus();
  }, [filledFrom]);

  // `label` is "photo", "text" or the host of the link, for the "Filled from" line.
  async function read(source: () => Promise<ReadSource>, label: string) {
    const controller = new AbortController();
    reading.current = controller;
    setError(null);
    setState("reading");
    onBusy(true);
    try {
      const result = await api.readRecipe(await source(), tags, model, controller.signal);
      onFilled(result.fields, label);
      setLink("");
      setPasted("");
      setState("rest");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "The recipe could not be read. Try again.");
      setState("rest");
    } finally {
      // A cancelled read can end during the next one. Only the current read turns Save back on.
      if (reading.current === controller) {
        reading.current = null;
        onBusy(false);
      }
    }
  }

  function choose(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    read(async () => {
      try {
        return { image: await readingPhoto(file) };
      } catch (e) {
        throw e instanceof PhotoError ? e : new Error("The photo could not be processed. Try another photo.");
      }
    }, "photo");
  }

  function submitLink(event: FormEvent) {
    event.preventDefault();
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("Paste a link that starts with http:// or https://.");
      return;
    }
    read(async () => ({ url }), URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : url);
  }

  function submitText(event: FormEvent) {
    event.preventDefault();
    const text = pasted.trim();
    if (text) read(async () => ({ text }), "text");
  }

  function back() {
    setError(null);
    setState("rest");
  }

  function open(next: "link" | "text") {
    setError(null);
    setState(next);
  }

  function cancel() {
    reading.current?.abort();
    reading.current = null;
    onBusy(false);
    setState("rest");
  }

  if (filledFrom !== null && state !== "reading") {
    return (
      <Box
        component="section"
        aria-label="Fill from a photo or link"
        sx={{ border: 1, borderColor: "divider", borderRadius: "20px", bgcolor: "background.paper", py: 0.5, pl: 2, pr: 1 }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <CheckRounded color="primary" />
          <Typography role="status" noWrap sx={{ flexGrow: 1, minWidth: 0, fontWeight: 600 }}>
            {filledLabel(filledFrom)}
          </Typography>
          <Button ref={again} onClick={onAgain} sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
            Fill again
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      component="section"
      aria-label="Fill from a photo or link"
      sx={{ border: 1, borderColor: "divider", borderRadius: "20px", bgcolor: "background.paper", p: 2 }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontSize: 17 }}>
            Fill from a photo or link
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The form fills in. You check it before you save.
          </Typography>
        </Box>
        {state === "reading" && (
          <>
            <LinearProgress aria-label="Reading the recipe" />
            <Typography variant="body2" role="status">
              Reading the recipe… This can take 30 seconds.
            </Typography>
            <Button variant="outlined" color="inherit" fullWidth onClick={cancel}>
              Cancel
            </Button>
          </>
        )}
        {state === "link" && (
          <Stack component="form" spacing={1.5} onSubmit={submitLink} noValidate>
            <TextField
              label="Recipe link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              autoFocus
              slotProps={{ htmlInput: { inputMode: "url", autoCapitalize: "none", autoCorrect: "off" } }}
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button color="inherit" onClick={back}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={!link.trim()}>
                Fill
              </Button>
            </Stack>
          </Stack>
        )}
        {state === "text" && (
          <Stack component="form" spacing={1.5} onSubmit={submitText} noValidate>
            <TextField
              label="Recipe text"
              multiline
              minRows={5}
              maxRows={12}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              autoFocus
              helperText="On the recipe page, select all, copy, and paste here."
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button color="inherit" onClick={back}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={!pasted.trim()}>
                Fill
              </Button>
            </Stack>
          </Stack>
        )}
        {error && state !== "reading" && <Alert severity="error">{error}</Alert>}
        {state === "rest" && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              fullWidth
              startIcon={<PhotoCameraOutlined />}
              onClick={() => input.current?.click()}
            >
              Take or choose a photo
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              fullWidth
              startIcon={<LinkRounded />}
              onClick={() => open("link")}
            >
              Paste a link
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              fullWidth
              startIcon={<ContentPasteRounded />}
              onClick={() => open("text")}
            >
              Paste text
            </Button>
          </Stack>
        )}
      </Stack>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label="Recipe photo to read"
        onChange={(e) => choose(e.target.files?.[0])}
      />
    </Box>
  );
}
