import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import MoreVert from "@mui/icons-material/MoreVert";
import { api, whenSignedOut, type SessionInfo } from "./api";
import { Passkeys } from "./Passkeys";
import { SignIn } from "./SignIn";
import { useAdminTheme } from "./useAdminTheme";

type View = "passkeys";

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
  const { theme, isDarkMode } = useAdminTheme();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("passkeys");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const loadSession = useCallback(async () => {
    setLoadError(null);
    try {
      setSession(await api.session());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "The admin page could not load.");
    }
  }, []);

  useEffect(() => {
    whenSignedOut(() => setSession((s) => (s ? { ...s, signedIn: false } : s)));
    loadSession();
  }, [loadSession]);

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
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: "primary.main",
          backgroundImage: "none",
          borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
          color: "white",
          "& .MuiTypography-root, & .MuiSvgIcon-root": { color: "white" },
        }}
      >
        <Toolbar>
          <Box component="img" src={`${import.meta.env.BASE_URL}squared-garlic-64x64.webp`} alt="" sx={{ width: 32, height: 32, mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }} noWrap>
            Palmarès admin
          </Typography>
          <Button href={import.meta.env.BASE_URL} color="inherit" startIcon={<ArrowBack />} sx={{ display: { xs: "none", sm: "inline-flex" } }}>
            Back to recipes
          </Button>
          <IconButton href={import.meta.env.BASE_URL} aria-label="Back to recipes" sx={{ display: { xs: "inline-flex", sm: "none" } }}>
            <ArrowBack />
          </IconButton>
          {session?.signedIn && (
            <>
              <IconButton aria-label="Menu" onClick={(e) => setMenuAnchor(e.currentTarget)} edge="end">
                <MoreVert />
              </IconButton>
              <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
                <MenuItem onClick={() => show("passkeys")}>Passkeys</MenuItem>
                <MenuItem onClick={signOut}>Sign out</MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ maxWidth: 900, mx: "auto", px: 2, py: 3 }}>
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
            <CircularProgress aria-label="Loading" />
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
            {view === "passkeys" && <Passkeys />}
          </>
        )}
      </Box>
    </ThemeProvider>
  );
}
