import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Search from "@mui/icons-material/Search";
import { photoUrl, type RecipeList as RecipeListData } from "./api";

interface RecipeListProps {
  data: RecipeListData | null;
  error: string | null;
  onRetry: () => void;
  onOpen: (slug: string) => void;
  onAdd: () => void;
}

// Accents do not count in the search, so "pate" finds "Pâté chinois" and "boeuf" finds "Bœuf".
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

export function RecipeList({ data, error, onRetry, onOpen, onAdd }: RecipeListProps) {
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    const words = plain(search).split(/\s+/).filter(Boolean);
    return (data?.recipes ?? []).filter((r) => {
      const text = plain(`${r.name} ${r.tags.join(" ")}`);
      return words.every((w) => text.includes(w));
    });
  }, [data, search]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
          Recipes
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={onAdd}>
          Add recipe
        </Button>
      </Stack>
      <TextField
        placeholder="Search by name or tag"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          },
          htmlInput: { "aria-label": "Search recipes" },
        }}
      />

      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {!data && !error && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress color="inherit" aria-label="Loading recipes" />
        </Box>
      )}
      {data && shown.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          {data.recipes.length === 0 ? "No recipes yet. Add the first one." : "No recipe matches this search."}
        </Typography>
      )}
      {data && shown.length > 0 && (
        <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
          <List disablePadding>
            {shown.map((r, i) => (
              <ListItemButton key={r.slug} divider={i < shown.length - 1} onClick={() => onOpen(r.slug)}>
                <ListItemAvatar>
                  <Avatar
                    variant="rounded"
                    src={r.hasImage ? photoUrl(r) : undefined}
                    alt=""
                    sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}
                    slotProps={{ img: { loading: "lazy" } }}
                  >
                    {r.name.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={r.name}
                  secondary={r.tags.join(", ") || undefined}
                  slotProps={{ secondary: { noWrap: true } }}
                  sx={{ minWidth: 0 }}
                />
                {r.notLive && <Chip size="small" color="secondary" label="Not live yet" sx={{ ml: 1, flexShrink: 0 }} />}
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );
}
