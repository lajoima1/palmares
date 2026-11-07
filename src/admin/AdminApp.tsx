import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  ThemeProvider,
} from "@mui/material";
import Menu2 from "@mui/icons-material/Menu";
import { headingFont } from "../theme/herb";
import { Mark } from "../herb/icons";
import { api, whenSignedOut, type RecipeList as RecipeListData, type SaveResult, type SessionInfo } from "./api";
import { Passkeys } from "./Passkeys";
import { RecipeForm, type SaveKind } from "./RecipeForm";
import { RecipeList } from "./RecipeList";
import { SignIn } from "./SignIn";
import { useAdminTheme } from "./useAdminTheme";
import { useLiveStatus, type LiveStatus } from "./useLiveStatus";

type View = "recipes" | "passkeys";

const LIVE_TEXT: Record<Exclude<LiveStatus, "idle">, string> = {
  building: "Live in about 2 minutes",
  live: "Live on the site",
  slow: "The site is still building. Check again later",
  saved: "Live after the next build",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The GitHub token ends on this date. Without it, saves fail, so warn a month before.
function tokenWarning(tokenExpires: string | undefined): { severity: "warning" | "error"; text: string } | null {
  if (!tokenExpires) return null;
  const days = Math.ceil((new Date(`${tokenExpires}T00:00:00Z`).getTime() - Date.now()) / DAY_MS);
  if (days > 30) return null;
  if (days <= 0) {
    return { severity: "error", text: `The GitHub token ended on ${tokenExpires}. Saves fail until you add a new one.` };
  }
  return { severity: "warning", text: `The GitHub token ends in ${days} days (${tokenExpires}). Make a new one soon.` };
}

export default function AdminApp() {
  const theme = useAdminTheme();
  const t = theme.herb;
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("recipes");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [list, setList] = useState<RecipeListData | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // undefined: no form. null: a new recipe.
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [lastSave, setLastSave] = useState<{ kind: SaveKind; name: string } | null>(null);
  const [unchanged, setUnchanged] = useState(false);
  const live = useLiveStatus();
  const signedIn = session?.signedIn ?? false;

  const loadSession = useCallback(async () => {
    setLoadError(null);
    try {
      setSession(await api.session());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "The admin page could not load.");
    }
  }, []);

  const loadList = useCallback(async () => {
    setListError(null);
    try {
      setList(await api.recipes());
    } catch (e) {
      setListError(e instanceof Error ? e.message : "The recipes could not load.");
    }
  }, []);

  useEffect(() => {
    whenSignedOut(() => setSession((s) => (s ? { ...s, signedIn: false } : s)));
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (signedIn) loadList();
  }, [signedIn, loadList]);

  // The commits that this page saved before. If the site serves one of them, the last save is
  // not live yet.
  const savedCommits = useRef<string[]>([]);

  function done(result: SaveResult, kind: SaveKind, name: string, before: string | undefined) {
    setEditing(undefined);
    if (result.changed === false) {
      setLastSave(null);
      live.reset();
      setUnchanged(true);
      return;
    }
    setLastSave({ kind, name });
    live.follow(result.commit, before, savedCommits.current);
    savedCommits.current = [...savedCommits.current, result.commit];
    loadList();
  }

  async function signOut() {
    setMenuAnchor(null);
    await api.logout().catch(() => undefined);
    await loadSession();
  }

  function show(next: View) {
    setMenuAnchor(null);
    setView(next);
  }

  const warning = session?.signedIn ? tokenWarning(session.tokenExpires) : null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box component="header" sx={{ maxWidth: 900, mx: "auto", display: "flex", alignItems: "center", gap: 1.25, px: 2.5, pt: 2.5, pb: 1 }}>
        <Mark size={36} />
        <Box component="span" sx={{ fontFamily: headingFont, fontWeight: 800, fontSize: 22 }}>
          Palmarès
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: t.saffronInk, bgcolor: t.saffronTint, px: 1, py: 0.5, borderRadius: "6px" }}
        >
          Admin
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {!session?.signedIn && (
          <Button href={import.meta.env.BASE_URL} sx={{ fontWeight: 600, px: 1 }}>
            Back to recipes
          </Button>
        )}
        {session?.signedIn && (
          <>
            <IconButton
              aria-label="Menu"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ border: `1px solid ${t.line}`, bgcolor: t.surface, "&:hover": { bgcolor: t.surface } }}
            >
              <Menu2 />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={menuAnchor !== null}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem component="a" href={import.meta.env.BASE_URL}>
                Back to recipes
              </MenuItem>
              <MenuItem onClick={() => show("recipes")}>Recipes</MenuItem>
              <MenuItem onClick={() => show("passkeys")}>Passkeys</MenuItem>
              <MenuItem onClick={signOut} sx={{ color: t.error }}>
                Sign out
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      <Box component="main" sx={{ maxWidth: 900, mx: "auto", px: 2.5, py: 2 }}>
        {loadError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={loadSession}>
                Try again
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}
        {!session && !loadError && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress color="inherit" aria-label="Loading" />
          </Box>
        )}
        {session && !session.signedIn && <SignIn setupOpen={session.setupOpen} onSignedIn={loadSession} />}
        {session?.signedIn && (
          <>
            {warning && (
              <Alert severity={warning.severity} sx={{ mb: 2 }}>
                {warning.text}
              </Alert>
            )}
            {view === "recipes" && (
              <RecipeList data={list} error={listError} onRetry={loadList} onOpen={setEditing} onAdd={() => setEditing(null)} />
            )}
            {view === "passkeys" && <Passkeys />}
          </>
        )}
      </Box>
      {editing !== undefined && signedIn && (
        <RecipeForm slug={editing} tagOptions={list?.tags ?? []} onClose={() => setEditing(undefined)} onDone={done} />
      )}
      <Snackbar
        // A snackbar shows above a dialog. At 375 px it would cover the Save button of the form.
        open={lastSave !== null && live.status !== "idle" && editing === undefined}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        onClose={(_, reason) => reason !== "clickaway" && live.status !== "building" && setLastSave(null)}
        autoHideDuration={live.status === "building" ? null : 8000}
      >
        <Alert
          severity={live.status === "live" ? "success" : "info"}
          variant="filled"
          onClose={() => setLastSave(null)}
          sx={{ bgcolor: t.ink, color: t.ground, borderRadius: "18px", "& .MuiAlert-icon": { color: t.herbTint } }}
        >
          “{lastSave?.name}” {lastSave?.kind}. {live.status !== "idle" && LIVE_TEXT[live.status]}.
        </Alert>
      </Snackbar>
      <Snackbar
        open={unchanged && editing === undefined}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={5000}
        onClose={() => setUnchanged(false)}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={() => setUnchanged(false)}
          sx={{ bgcolor: t.ink, color: t.ground, borderRadius: "18px", "& .MuiAlert-icon": { color: t.herbTint } }}
        >
          Nothing changed, so nothing was saved.
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
