import { useState } from "react";
import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import Fingerprint from "@mui/icons-material/Fingerprint";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { api, deviceName, passkeyErrorMessage } from "./api";

interface SignInProps {
  setupOpen: boolean;
  onSignedIn: () => void;
}

export function SignIn({ setupOpen, onSignedIn }: SignInProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSignedIn();
    } catch (e) {
      setError(passkeyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const signIn = () =>
    run(async () => {
      const optionsJSON = await api.loginOptions();
      await api.loginVerify(await startAuthentication({ optionsJSON }));
    });

  const register = () =>
    run(async () => {
      const optionsJSON = await api.setupOptions(code.trim());
      await api.setupVerify(await startRegistration({ optionsJSON }), deviceName());
    });

  return (
    <Box sx={{ display: "flex", justifyContent: "center", px: 2, py: { xs: 4, sm: 8 } }}>
      <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, width: "100%", maxWidth: 420, border: 1, borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Sign in
          </Typography>
          <Typography color="text.secondary">
            Only the owner can add, change or delete recipes. Use the fingerprint, face or PIN of this
            device.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {!setupOpen && (
            <Button variant="contained" size="large" startIcon={<Fingerprint />} onClick={signIn} disabled={busy}>
              Sign in with a passkey
            </Button>
          )}
          {setupOpen && (
            <>
              <Divider />
              <Typography variant="subtitle1" component="h2">
                First setup
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No passkey exists yet. Enter the setup code to register this device.
              </Typography>
              <TextField
                label="Setup code"
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && code.trim() && !busy && register()}
              />
              <Button
                variant="contained"
                size="large"
                startIcon={<Fingerprint />}
                onClick={register}
                disabled={busy || !code.trim()}
              >
                Register this device
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
