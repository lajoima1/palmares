import { useCallback, useEffect, useState } from "react";
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
import { PhotoField } from "./PhotoField";

export type SaveKind = "added" | "saved" | "deleted";

interface RecipeFormProps {
  // null: a new recipe.
  slug: string | null;
  tagOptions: string[];
  onClose: () => void;
  onDone: (result: SaveResult, kind: SaveKind, name: string) => void;
}

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

  const load = useCallback(async () => {
    if (!slug) return;
    setLoadError(null);
    setConflict(false);
    setError(null);
    try {
      const recipe = await api.recipe(slug);
      setForm(toForm(recipe.fields));
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
      const result = slug
        ? await api.updateRecipe(slug, fields, baseOid, image)
        : await api.createRecipe(fields, image);
      onDone(result, slug ? "saved" : "added", fields.name);
    });

  const remove = () =>
    act(async () => {
      setConfirmDelete(false);
      const result = await api.deleteRecipe(slug!, baseOid);
      onDone(result, "deleted", form?.fields.name ?? slug!);
    });

  const name = form?.fields.name ?? "";

  return (
    <Dialog open fullScreen={fullScreen} fullWidth maxWidth="md" onClose={busy ? undefined : onClose}>
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
            <CircularProgress aria-label="Loading the recipe" />
          </Box>
        )}
        {form && (
          <Stack spacing={2} sx={{ pt: 1 }}>
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
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={busy || photoBusy || !form || !oneLine(name) || conflict}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this recipe?</DialogTitle>
        <DialogContentText sx={{ px: 3 }}>
          “{name}” and its photo leave both sites after the next build. The git history keeps a copy.
        </DialogContentText>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={remove}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
