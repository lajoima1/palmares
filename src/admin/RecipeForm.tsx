import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import { emptyRecipe, linesToItems, oneLine, type RecipeFields } from "../utils/recipeText";
import { api, ApiError, type ModelChoice, type PhotoChange, type ReadSource, type SaveResult } from "./api";
import { readWithBackup } from "./models";
import { PhotoError, readingPhoto } from "./photo";
import { PhotoField } from "./PhotoField";
import { ReadBar, type SourceKind } from "./ReadBar";
import { ReadingStep } from "./ReadingStep";
import { StartStep } from "./StartStep";
import { servedCommit } from "./useLiveStatus";

export type SaveKind = "added" | "saved" | "deleted";

interface RecipeFormProps {
  // null: a new recipe.
  slug: string | null;
  tagOptions: string[];
  // The models that can read a recipe, the default first.
  models: ModelChoice[];
  onClose: () => void;
  // `before`: the commit that the site served just before the save.
  onDone: (result: SaveResult, kind: SaveKind, name: string, before: string | undefined) => void;
}

// A longer name makes a folder name that some file systems refuse (255 bytes at most).
export const MAX_NAME = 100;

const ONE_LINE_FIELDS = [
  { key: "name", label: "Name", required: true, area: "name" },
  { key: "description", label: "Description", area: "desc" },
  { key: "servings", label: "Servings", placeholder: "4 portions", area: "serv" },
  { key: "prep_time", label: "Prep time", placeholder: "15 minutes", area: "prep" },
  { key: "cook_time", label: "Cook time", placeholder: "1 heure", area: "cook" },
  { key: "total_time", label: "Total time", placeholder: "1 heure 15 minutes", area: "total" },
] as const;

const LIST_FIELDS = [
  {
    key: "ingredients",
    label: "Ingredients — one per line",
    help: "A line like “## Pour la sauce:” shows as a heading.",
    area: "ing",
  },
  { key: "instructions", label: "Steps — one per line", help: "The page numbers the steps.", area: "steps" },
  { key: "notes", label: "Notes — one per line", help: undefined, area: "notes" },
] as const;

// From the md width (900 px), the form uses the width of the dialog. A phone keeps one column, in
// the same order.
const WIDE_LAYOUT = {
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gridTemplateAreas: `
    "photo name name name"
    "photo desc desc desc"
    "photo serv serv serv"
    "prep cook total diff"
    "tags tags tags tags"
    "ing ing steps steps"
    "notes notes notes notes"`,
};

type ListKey = (typeof LIST_FIELDS)[number]["key"];

// The steps of Add recipe. Change recipe has only the form.
type Step = "start" | "link" | "text" | "reading" | "form";

// The photo, link or text that a model read. The dialog keeps it for "Read again".
interface Source {
  kind: SourceKind;
  body: ReadSource;
  // The object URL of the photo, for the reading screen.
  preview: string | null;
}

interface FilledBy {
  by: ModelChoice;
  kind: SourceKind;
  // "Mistral Small was busy." after a switch.
  switched: string | null;
}

// The link step and the text step have a history entry of their own, so Back goes to the start.
const entriesFor = (step: Step) => (step === "link" || step === "text" ? 2 : 1);

interface FormState {
  fields: RecipeFields;
  lists: Record<ListKey, string>;
}

const EMPTY_FORM = JSON.stringify(toForm(emptyRecipe()));

function toForm(fields: RecipeFields): FormState {
  return {
    fields,
    lists: {
      ingredients: fields.ingredients.join("\n"),
      instructions: fields.instructions.join("\n"),
      notes: fields.notes.join("\n"),
    },
  };
}

// A pasted line break would make a new key line in recipe.txt. The space stays while typing;
// the save trims it.
function noLineBreak(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ");
}

export function RecipeForm({ slug, tagOptions, models, onClose, onDone }: RecipeFormProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  const [form, setForm] = useState<FormState | null>(slug ? null : toForm(emptyRecipe()));
  const [baseOid, setBaseOid] = useState("");
  const [image, setImage] = useState<PhotoChange>(undefined);
  const [hasImage, setHasImage] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreMenu, setMoreMenu] = useState<HTMLElement | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [step, setStep] = useState<Step>(slug || models.length === 0 ? "form" : "start");
  // Each Add recipe starts on the first model of the list.
  const [model, setModel] = useState<ModelChoice | undefined>(models[0]);
  const [source, setSource] = useState<Source | null>(null);
  const [link, setLink] = useState("");
  const [pasted, setPasted] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [readingLine, setReadingLine] = useState("");
  const [readingPreview, setReadingPreview] = useState<string | null>(null);
  // The step that Cancel or a failed read goes back to: the step of the source, or the form.
  const [readFrom, setReadFrom] = useState<Step>("start");
  const [filledBy, setFilledBy] = useState<FilledBy | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  // The form JSON after the last read. A new read replaces the form at once if it did not change.
  const [lastRead, setLastRead] = useState<string | null>(null);
  // A read that waits for "Replace what is in the form?".
  const [pending, setPending] = useState<({ fields: RecipeFields } & FilledBy) | null>(null);
  const reading = useRef<AbortController | null>(null);
  const previews = useRef<string[]>([]);
  // The history entries that the dialog added, 1 or 2. See entriesFor.
  const entries = useRef(0);
  // The form as it was loaded, to tell if the owner changed something.
  const [loaded, setLoaded] = useState<string | null>(slug ? null : EMPTY_FORM);
  const alerts = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const dirty = form !== null && (JSON.stringify(form) !== loaded || image !== undefined);
  const formNow = useRef(form);
  const onBackNow = useRef<() => void>(() => {});
  useEffect(() => {
    formNow.current = form;
  });

  function go(next: Step) {
    setStep(next);
    while (entries.current < entriesFor(next)) {
      history.pushState({ recipeForm: true }, "");
      entries.current += 1;
    }
  }

  function leave(then: () => void) {
    closing.current = true;
    reading.current?.abort();
    if (entries.current > 0) history.go(-entries.current);
    entries.current = 0;
    then();
  }

  function cancelRead() {
    reading.current?.abort();
    reading.current = null;
    go(readFrom);
  }

  // After "Other photo, link or text" the form keeps its values, so a close asks on each step.
  function requestClose() {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else leave(onClose);
  }

  // Back on a phone: the browser removes one entry of the dialog, then this picks the next step.
  // A step that needs the entry again pushes it again.
  useEffect(() => {
    onBackNow.current = () => {
      entries.current = Math.max(0, entries.current - 1);
      // During a save or a delete the form stays, so its result or its error shows.
      if (busy) go(step);
      else if (step === "link" || step === "text") go("start");
      else if (step === "reading") cancelRead();
      else if (dirty) {
        go(step);
        setConfirmDiscard(true);
      } else leave(onClose);
    };
  });

  useEffect(() => {
    if (!history.state?.recipeForm) history.pushState({ recipeForm: true }, "");
    entries.current = 1;
    const onBack = () => {
      if (!closing.current) onBackNow.current();
    };
    window.addEventListener("popstate", onBack);
    const created = previews.current;
    return () => {
      window.removeEventListener("popstate", onBack);
      reading.current?.abort();
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // A save error shows at the top of the form. At 375 px the owner is often at the bottom.
  useEffect(() => {
    if (error || conflict) alerts.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [error, conflict]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoadError(null);
    setConflict(false);
    setError(null);
    try {
      const recipe = await api.recipe(slug);
      setForm(toForm(recipe.fields));
      setLoaded(JSON.stringify(toForm(recipe.fields)));
      setBaseOid(recipe.baseOid);
      setHasImage(recipe.hasImage);
      setImage(undefined);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "The recipe could not load.");
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // A new read replaces the form at once only if the owner changed nothing after the last read.
  function filled(fields: RecipeFields, meta: FilledBy) {
    if (JSON.stringify(formNow.current) !== (lastRead ?? EMPTY_FORM)) setPending({ fields, ...meta });
    else fill(fields, meta);
  }

  function fill(fields: RecipeFields, meta: FilledBy) {
    const next = toForm({ ...fields, name: fields.name.slice(0, MAX_NAME) });
    setPending(null);
    setForm(next);
    setLastRead(JSON.stringify(next));
    setFilledBy(meta);
  }

  // `from` is the step that Cancel and a failed read go back to.
  async function startRead(next: () => Promise<Source>, preview: string | null, first: ModelChoice, from: Step) {
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    setStepError(null);
    setReadError(null);
    setReadFrom(from);
    setReadingPreview(preview);
    setReadingLine(`${first.name} reads it.`);
    go("reading");
    try {
      const read = await next();
      if (controller.signal.aborted) return;
      setSource(read);
      const outcome = await readWithBackup(
        models,
        first,
        (m) => api.readRecipe(read.body, tagOptions, m.id, controller.signal),
        (text) => setReadingLine(text),
      );
      if (controller.signal.aborted) return;
      filled(outcome.result.fields, { by: outcome.model, kind: read.kind, switched: outcome.switched });
      go("form");
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : "The recipe could not be read. Try again.";
      if (from === "form") setReadError(message);
      else setStepError(message);
      go(from);
    } finally {
      if (reading.current === controller) reading.current = null;
    }
  }

  function readPhoto(file: File) {
    if (!model) return;
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    startRead(
      async () => {
        try {
          return { kind: "photo", body: { image: await readingPhoto(file) }, preview };
        } catch (e) {
          throw e instanceof PhotoError ? e : new Error("The photo could not be processed. Try another photo.");
        }
      },
      preview,
      model,
      "start",
    );
  }

  function readLink(url: string) {
    if (!model) return;
    setLink(url);
    startRead(async () => ({ kind: "link", body: { url }, preview: null }), null, model, "link");
  }

  function readText(text: string) {
    if (!model) return;
    startRead(async () => ({ kind: "text", body: { text }, preview: null }), null, model, "text");
  }

  function readAgain(next: ModelChoice) {
    if (source) startRead(async () => source, source.preview, next, "form");
  }

  // "Other photo, link or text" drops the source, so the start screen begins again.
  function otherSource() {
    setSource(null);
    setFilledBy(null);
    setLink("");
    setPasted("");
    setStepError(null);
    go("start");
  }

  const setField = (key: keyof RecipeFields, value: string | string[]) =>
    setForm((f) => f && { ...f, fields: { ...f.fields, [key]: value } });

  function collect(state: FormState): RecipeFields {
    const f = state.fields;
    return {
      name: oneLine(f.name),
      description: oneLine(f.description),
      servings: oneLine(f.servings),
      prep_time: oneLine(f.prep_time),
      cook_time: oneLine(f.cook_time),
      total_time: oneLine(f.total_time),
      difficulty: f.difficulty,
      tags: f.tags.map(oneLine).filter(Boolean),
      ingredients: linesToItems(state.lists.ingredients, "list"),
      instructions: linesToItems(state.lists.instructions, "steps"),
      notes: linesToItems(state.lists.notes, "list"),
    };
  }

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && slug) setConflict(true);
      else setError(e instanceof Error ? e.message : "The save failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    act(async () => {
      if (!form) return;
      const fields = collect(form);
      const before = await servedCommit();
      const result = slug
        ? await api.updateRecipe(slug, fields, baseOid, image)
        : await api.createRecipe(fields, image);
      leave(() => onDone(result, slug ? "saved" : "added", fields.name, before));
    });

  const remove = () =>
    act(async () => {
      setConfirmDelete(false);
      const before = await servedCommit();
      const result = await api.deleteRecipe(slug!, baseOid);
      leave(() => onDone(result, "deleted", form?.fields.name ?? slug!, before));
    });

  const name = form?.fields.name ?? "";

  const onForm = step === "form";
  const closeButton = (
    <IconButton aria-label="Close" onClick={requestClose} disabled={busy} sx={{ width: 44, height: 44 }}>
      <CloseRounded />
    </IconButton>
  );

  return (
    <Dialog
      open
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      onClose={requestClose}
      aria-labelledby="recipe-form-title"
      slotProps={{
        paper: {
          sx: {
            maxWidth: { md: onForm ? 960 : 800 },
            bgcolor: onForm ? "background.paper" : "background.default",
          },
        },
      }}
    >
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          py: 1,
          pl: { xs: 1, sm: 3 },
          pr: { xs: 1.5, sm: 2 },
          borderBottom: onForm ? 1 : 0,
          borderColor: "divider",
        }}
      >
        {fullScreen && closeButton}
        <Typography id="recipe-form-title" variant="h6" component="h2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
          {slug ? "Change recipe" : "Add recipe"}
        </Typography>
        {slug && form && (
          <IconButton
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={moreMenu !== null}
            onClick={(e) => setMoreMenu(e.currentTarget)}
            disabled={busy}
            sx={{ width: 44, height: 44 }}
          >
            <MoreVertRounded />
          </IconButton>
        )}
        {onForm && !fullScreen && (
          <Button color="inherit" onClick={requestClose} disabled={busy}>
            Cancel
          </Button>
        )}
        {onForm && (
          <Button variant="contained" onClick={save} disabled={busy || photoBusy || !form || !oneLine(name) || conflict}>
            {busy ? "Saving…" : "Save"}
          </Button>
        )}
        {!onForm && !fullScreen && closeButton}
      </Box>
      {onForm && filledBy && (
        <ReadBar
          models={models}
          readBy={filledBy.by}
          kind={filledBy.kind}
          switched={filledBy.switched}
          error={readError}
          onReadAgain={readAgain}
          onOther={otherSource}
        />
      )}
      <Menu anchorEl={moreMenu} open={moreMenu !== null} onClose={() => setMoreMenu(null)}>
        <MenuItem
          onClick={() => {
            setMoreMenu(null);
            setConfirmDelete(true);
          }}
          // MUI makes a menu item 36 px high from the sm width. A tap target is 44 px at least.
          sx={{ color: "error.main", minHeight: { xs: 48, sm: 48 } }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <DeleteOutlineRounded />
          </ListItemIcon>
          Delete recipe…
        </MenuItem>
      </Menu>
      <DialogContent>
        {(step === "start" || step === "link" || step === "text") && model && (
          <StartStep
            screen={step}
            models={models}
            model={model}
            onModel={setModel}
            link={link}
            onLink={setLink}
            text={pasted}
            onText={setPasted}
            error={stepError}
            onOpen={(next) => {
              setStepError(null);
              go(next);
            }}
            onBack={() => history.back()}
            onType={() => go("form")}
            onPhoto={readPhoto}
            onReadLink={readLink}
            onReadText={readText}
          />
        )}
        {step === "reading" && <ReadingStep preview={readingPreview} line={readingLine} onCancel={cancelRead} />}
        {onForm && loadError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={load}>
                Try again
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}
        {onForm && !form && !loadError && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress color="inherit" aria-label="Loading the recipe" />
          </Box>
        )}
        {onForm && form && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box ref={alerts} sx={{ scrollMarginTop: 16, display: error || conflict ? "block" : "none" }} />
            {conflict && (
              <Alert
                severity="warning"
                action={
                  <Button color="inherit" onClick={load} disabled={busy}>
                    Reload
                  </Button>
                }
              >
                This recipe changed on GitHub after you opened it. Reload it to see the new version. Your changes here
                are lost when you reload.
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {!slug && !filledBy && models.length > 0 && (
              <Box>
                <Button startIcon={<PhotoCameraOutlined />} onClick={() => go("start")} sx={{ ml: -1 }}>
                  Fill from a photo or link
                </Button>
              </Box>
            )}
            {!slug && models.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Auto-fill is not set up.
              </Typography>
            )}
            <Box sx={{ display: "grid", gap: 2, ...(wide ? WIDE_LAYOUT : {}) }}>
              <Box sx={{ gridArea: wide ? "photo" : undefined }}>
                <PhotoField
                  currentUrl={slug && hasImage ? `/api/recipes/${slug}/image` : null}
                  change={image}
                  onChange={setImage}
                  onBusy={setPhotoBusy}
                />
              </Box>
              {ONE_LINE_FIELDS.map((f) => (
                <TextField
                  key={f.key}
                  sx={{ gridArea: wide ? f.area : undefined }}
                  label={f.label}
                  required={"required" in f}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                  value={form.fields[f.key]}
                  onChange={(e) => setField(f.key, noLineBreak(e.target.value))}
                  multiline={f.key === "description"}
                  helperText={!slug && f.key === "name" ? "The name also makes the address of the recipe." : undefined}
                  slotProps={f.key === "name" ? { htmlInput: { maxLength: MAX_NAME } } : undefined}
                />
              ))}
              <TextField
                select
                sx={{ gridArea: wide ? "diff" : undefined }}
                label="Difficulty"
                value={form.fields.difficulty}
                onChange={(e) => setField("difficulty", e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {["Easy", "Medium", "Hard"].map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete
                multiple
                freeSolo
                sx={{ gridArea: wide ? "tags" : undefined }}
                options={tagOptions}
                value={form.fields.tags}
                onChange={(_, tags) =>
                  setField("tags", [...new Set(tags.flatMap((t) => t.split(",")).map(oneLine).filter(Boolean))])
                }
                renderInput={(params) => (
                  <TextField {...params} label="Tags" helperText="Choose a tag, or type a new one and press Enter." />
                )}
              />
              {LIST_FIELDS.map((f) => (
                <TextField
                  key={f.key}
                  sx={{ gridArea: wide ? f.area : undefined }}
                  label={f.label}
                  multiline
                  minRows={f.key === "notes" ? 2 : wide ? 8 : 4}
                  value={form.lists[f.key]}
                  onChange={(e) => setForm((s) => s && { ...s, lists: { ...s.lists, [f.key]: e.target.value } })}
                  helperText={f.help}
                />
              ))}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this recipe?</DialogTitle>
        <DialogContentText sx={{ px: 3 }}>
          “{name}”{hasImage ? " and its photo" : ""} leave{hasImage ? "" : "s"} both sites after the next build. The git
          history keeps a copy.
        </DialogContentText>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={remove}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* After "Discard your changes?", so the two never cover each other. */}
      <Dialog open={pending !== null && !confirmDiscard} onClose={() => setPending(null)}>
        <DialogTitle>Replace what is in the form?</DialogTitle>
        <DialogContentText sx={{ px: 3 }}>
          The form fills with the recipe that {pending?.by.name} read. Your changes are lost.
        </DialogContentText>
        <DialogActions>
          <Button color="inherit" onClick={() => setPending(null)}>
            Keep my text
          </Button>
          <Button variant="contained" onClick={() => pending && fill(pending.fields, pending)}>
            Replace
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)}>
        <DialogTitle>Discard your changes?</DialogTitle>
        <DialogContentText sx={{ px: 3 }}>The changes in this form are not saved.</DialogContentText>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmDiscard(false)}>
            Keep editing
          </Button>
          <Button color="error" variant="contained" onClick={() => leave(onClose)} disabled={busy}>
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
