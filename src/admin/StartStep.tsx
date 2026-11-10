import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Box, Button, ButtonBase, ListItemText, Menu, MenuItem, Stack, TextField, Typography } from "@mui/material";
import ContentPasteRounded from "@mui/icons-material/ContentPasteRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import type { ModelChoice } from "./api";

type StartScreen = "start" | "link" | "text";

interface StartStepProps {
  screen: StartScreen;
  // Another dialog is open over this one: a paste or a drop does nothing.
  paused: boolean;
  models: ModelChoice[];
  model: ModelChoice;
  onModel: (model: ModelChoice) => void;
  link: string;
  onLink: (link: string) => void;
  text: string;
  onText: (text: string) => void;
  error: string | null;
  onOpen: (screen: "link" | "text") => void;
  onBack: () => void;
  onType: () => void;
  onPhoto: (file: File) => void;
  onReadLink: (url: string) => void;
  onReadText: (text: string) => void;
}

const LINK = /^https?:\/\/\S+$/i;

function Tile({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: ReactNode; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={(t) => ({
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        minHeight: { xs: 150, md: 168 },
        p: { xs: 2, md: 2.25 },
        border: 1,
        borderColor: "divider",
        borderRadius: "20px",
        bgcolor: "background.paper",
        textAlign: "left",
        "&:hover": { borderColor: t.herb.herb },
      })}
    >
      <Box
        sx={(t) => ({
          width: 44,
          height: 44,
          borderRadius: "14px",
          bgcolor: t.herb.herbTint,
          color: t.herb.herb,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 17, fontWeight: 600 }}>{title}</Typography>
        {/* Two lines on a computer for each tile, so the titles line up. */}
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, minHeight: { md: "2.9em" } }}>
          {hint}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

function ModelMenu({ models, model, onModel }: Pick<StartStepProps, "models" | "model" | "onModel">) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        id="read-with-model"
        aria-labelledby="read-with-label read-with-model"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        endIcon={<ExpandMoreRounded />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ px: 1 }}
      >
        {model.name}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {models.map((m) => (
          <MenuItem
            key={m.id}
            role="menuitemradio"
            aria-checked={m.id === model.id}
            selected={m.id === model.id}
            onClick={() => {
              onModel(m);
              setAnchor(null);
            }}
            sx={{ minHeight: { xs: 48, sm: 48 } }}
          >
            <ListItemText primary={m.name} secondary={m.company} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// The start screen of Add recipe, and its link and text steps.
export function StartStep(props: StartStepProps) {
  const { screen, paused, error, onPhoto, onReadLink, onOpen, onText } = props;
  const input = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // A photo dropped anywhere on the page starts a read. Else the browser opens the photo in the
  // tab, and the admin page is gone.
  useEffect(() => {
    if (screen !== "start" || paused) return;
    const over = (event: globalThis.DragEvent) => {
      event.preventDefault();
      setDragging(true);
    };
    const drop = (event: globalThis.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) onPhoto(file);
    };
    const leave = (event: globalThis.DragEvent) => {
      if (event.relatedTarget === null) setDragging(false);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    window.addEventListener("dragleave", leave);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      window.removeEventListener("dragleave", leave);
    };
  }, [screen, paused, onPhoto]);

  // Ctrl+V on the start screen: a photo or a link starts a read, other text opens the text step.
  useEffect(() => {
    if (screen !== "start" || paused) return;
    const onPaste = (event: ClipboardEvent) => {
      // An open menu, like "Read with", takes the paste.
      if (document.querySelector('[role="menu"]')) return;
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      const pasted = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (!file && !pasted) return;
      event.preventDefault();
      if (file) onPhoto(file);
      else if (LINK.test(pasted)) onReadLink(pasted);
      else {
        onText(pasted);
        onOpen("text");
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [screen, paused, onPhoto, onReadLink, onOpen, onText]);

  function submitLink(event: FormEvent) {
    event.preventDefault();
    const url = props.link.trim();
    if (!LINK.test(url)) {
      setInvalid("Paste a link that starts with http:// or https://.");
      return;
    }
    setInvalid(null);
    onReadLink(url);
  }

  function submitText(event: FormEvent) {
    event.preventDefault();
    const text = props.text.trim();
    if (text) props.onReadText(text);
  }

  const shown = invalid ?? error;
  const alert = shown && (
    <Alert severity="error" sx={{ mb: 2 }}>
      {shown}
    </Alert>
  );

  if (screen === "link" || screen === "text") {
    const link = screen === "link";
    return (
      <Stack component="form" spacing={2.5} onSubmit={link ? submitLink : submitText} noValidate sx={{ pt: 1 }}>
        <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
          {link ? "Paste the link of the recipe" : "Paste the text of the recipe"}
        </Typography>
        {shown && <Alert severity="error">{shown}</Alert>}
        {link ? (
          <TextField
            label="Recipe link"
            type="url"
            value={props.link}
            onChange={(e) => {
              setInvalid(null);
              props.onLink(e.target.value);
            }}
            autoFocus
            slotProps={{ htmlInput: { inputMode: "url", autoCapitalize: "none", autoCorrect: "off" } }}
          />
        ) : (
          <TextField
            label="Recipe text"
            multiline
            minRows={8}
            maxRows={16}
            value={props.text}
            onChange={(e) => props.onText(e.target.value)}
            autoFocus
            helperText="On the recipe page, select all, copy, and paste here."
          />
        )}
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button color="inherit" onClick={props.onBack}>
            Back
          </Button>
          <Button type="submit" variant="contained" disabled={!(link ? props.link : props.text).trim()}>
            Fill
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Box
      sx={(t) => ({
        borderRadius: "20px",
        outline: dragging ? `2px dashed ${t.herb.herb}` : "none",
        outlineOffset: 6,
      })}
    >
      <Typography data-step-focus tabIndex={-1} variant="h4" component="h1" sx={{ fontSize: { xs: 28, md: 32 }, outline: "none" }}>
        Where is the recipe?
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3, fontSize: 15 }}>
        The form fills in. You check it before you save.
      </Typography>
      {alert}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
        <Tile
          icon={<PhotoCameraOutlined />}
          title="Photo"
          hint={
            <>
              <Box component="span" sx={{ display: { md: "none" } }}>
                Take or choose one
              </Box>
              <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
                Choose a file, or drop it here
              </Box>
            </>
          }
          onClick={() => input.current?.click()}
        />
        <Tile icon={<LinkRounded />} title="Link" hint="A recipe web page" onClick={() => onOpen("link")} />
        <Tile icon={<ContentPasteRounded />} title="Text" hint="Copied from a page" onClick={() => onOpen("text")} />
        <Tile icon={<EditOutlined />} title="Type it" hint="An empty form" onClick={props.onType} />
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ mt: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <Typography id="read-with-label" variant="body2" color="text.secondary">
          Read with
        </Typography>
        <ModelMenu models={props.models} model={props.model} onModel={props.onModel} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: "auto !important", display: { xs: "none", md: "block" } }}>
          You can also paste a link or a photo with Ctrl+V.
        </Typography>
      </Stack>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label="Recipe photo to read"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPhoto(file);
        }}
      />
    </Box>
  );
}
