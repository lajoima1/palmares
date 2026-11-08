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
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { emptyRecipe, linesToItems, oneLine, type RecipeFields } from "../utils/recipeText";
import { api, ApiError, type PhotoChange, type SaveResult } from "./api";
import { ImportField } from "./ImportField";
import { PhotoField } from "./PhotoField";
import { servedCommit } from "./useLiveStatus";

export type SaveKind = "added" | "saved" | "deleted";

interface RecipeFormProps {
  // null: a new recipe.
  slug: string | null;
  tagOptions: string[];
  onClose: () => void;
  // `before`: the commit that the site served just before the save.
  onDone: (result: SaveResult, kind: SaveKind, name: string, before: string | undefined) => void;
}

// A longer name makes a folder name that some file systems refuse (255 bytes at most).
export const MAX_NAME = 100;

const ONE_LINE_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "description", label: "Description" },
  { key: "servings", label: "Servings", placeholder: "4 portions" },
  { key: "prep_time", label: "Prep time", placeholder: "15 minutes" },
  { key: "cook_time", label: "Cook time", placeholder: "1 heure" },
  { key: "total_time", label: "Total time", placeholder: "1 heure 15 minutes" },
] as const;

const LIST_FIELDS = [
  {
    key: "ingredients",
    label: "Ingredients — one per line",
    help: "A line like “## Pour la sauce:” shows as a heading.",
  },
  { key: "instructions", label: "Steps — one per line", help: "The page numbers the steps." },
  { key: "notes", label: "Notes — one per line", help: undefined },
] as const;

type ListKey = (typeof LIST_FIELDS)[number]["key"];

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

export function RecipeForm({ slug, tagOptions, onClose, onDone }: RecipeFormProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  // The source of the last fill that the form kept, like "photo". null after "Fill again".
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  // The form holds values that the model read. The check alert stays until the form closes.
  const [suggested, setSuggested] = useState(false);
  // A fill that waits for "Replace what you typed?".
  const [pending, setPending] = useState<{ fields: RecipeFields; source: string } | null>(null);
  // The form as it was loaded, to tell if the owner changed something.
  const [loaded, setLoaded] = useState<string | null>(slug ? null : EMPTY_FORM);
  const alerts = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const dirty = form !== null && (JSON.stringify(form) !== loaded || image !== undefined);
  const dirtyNow = useRef(dirty);
  const formNow = useRef(form);
  const busyNow = useRef(busy);
  const onCloseNow = useRef(onClose);
  useEffect(() => {
    dirtyNow.current = dirty;
    formNow.current = form;
    busyNow.current = busy;
    onCloseNow.current = onClose;
  });

  // On a phone, Back closes a full-screen dialog. A history entry makes Back close the form, not
  // leave the admin page. With typed changes, Back asks first.
  useEffect(() => {
    if (!history.state?.recipeForm) history.pushState({ recipeForm: true }, "");
    const onBack = () => {
      if (closing.current) return;
      // During a save or a delete the form stays, so its result or its error shows.
      if (busyNow.current) {
        history.pushState({ recipeForm: true }, "");
        return;
      }
      if (dirtyNow.current) {
        history.pushState({ recipeForm: true }, "");
        setConfirmDiscard(true);
      } else {
        closing.current = true;
        onCloseNow.current();
      }
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  function leave(then: () => void) {
    closing.current = true;
    if (history.state?.recipeForm) history.back();
    then();
  }

  function requestClose() {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else leave(onClose);
  }

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

  // The owner can type while the read runs, so the test reads the form of now.
  function filled(fields: RecipeFields, source: string) {
    if (JSON.stringify(formNow.current) !== EMPTY_FORM) setPending({ fields, source });
    else fill(fields, source);
  }

  function fill(fields: RecipeFields, source: string) {
    setPending(null);
    setForm(toForm({ ...fields, name: fields.name.slice(0, MAX_NAME) }));
    setFilledFrom(source);
    setSuggested(true);
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

  return (
    <Dialog open fullScreen={fullScreen} fullWidth maxWidth="md" onClose={requestClose}>
      <DialogTitle>{slug ? "Change recipe" : "Add recipe"}</DialogTitle>
      <DialogContent dividers>
        {loadError && (
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
        {!form && !loadError && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress color="inherit" aria-label="Loading the recipe" />
          </Box>
        )}
        {form && (
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
            {!slug && (
              <ImportField
                tags={tagOptions}
                filledFrom={filledFrom}
                onFilled={filled}
                onAgain={() => setFilledFrom(null)}
                onBusy={setImportBusy}
              />
            )}
            {suggested && (
              <Alert
                severity="info"
                sx={(t) => ({ bgcolor: t.herb.herbTint, color: t.herb.ink, "& .MuiAlert-icon": { color: t.herb.herb } })}
              >
                Check each field. Times, difficulty and tags can be suggestions.
              </Alert>
            )}
            <PhotoField
              currentUrl={slug && hasImage ? `/api/recipes/${slug}/image` : null}
              change={image}
              onChange={setImage}
              onBusy={setPhotoBusy}
            />
            {ONE_LINE_FIELDS.map((f) => (
              <TextField
                key={f.key}
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
                label={f.label}
                multiline
                minRows={f.key === "notes" ? 2 : 4}
                value={form.lists[f.key]}
                onChange={(e) => setForm((s) => s && { ...s, lists: { ...s.lists, [f.key]: e.target.value } })}
                helperText={f.help}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
        {slug && form && (
          <Button color="error" onClick={() => setConfirmDelete(true)} disabled={busy} sx={{ mr: "auto" }}>
            Delete
          </Button>
        )}
        <Button color="inherit" onClick={requestClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy || photoBusy || importBusy || !form || !oneLine(name) || conflict}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>

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
          The form fills with the recipe that was read. The text in the form now is lost.
        </DialogContentText>
        <DialogActions>
          <Button color="inherit" onClick={() => setPending(null)}>
            Keep my text
          </Button>
          <Button variant="contained" onClick={() => pending && fill(pending.fields, pending.source)}>
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
