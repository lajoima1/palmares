import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import { startRegistration } from "@simplewebauthn/browser";
import { api, deviceName, passkeyErrorMessage, type PasskeyInfo } from "./api";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function Passkeys() {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[] | null>(null);
  const [name, setName] = useState(deviceName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPasskeys(await api.passkeys());
    } catch (e) {
      setError(passkeyErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
    } catch (e) {
      setError(passkeyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    run(async () => {
      const optionsJSON = await api.addPasskeyOptions();
      await api.addPasskeyVerify(await startRegistration({ optionsJSON }), name);
      return "Passkey added. Another device can take up to a minute to see it.";
    });

  const remove = (passkey: PasskeyInfo) =>
    run(async () => {
      await api.removePasskey(passkey.id);
      return `"${passkey.name}" is removed. Its sessions are ended.`;
    });

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        Passkeys
      </Typography>
      <Typography color="text.secondary">
        Each device that can sign in. Remove a lost device: its sessions end at once.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        {passkeys === null && !error && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress color="inherit" aria-label="Loading passkeys" />
          </Box>
        )}
        {passkeys && (
          <List disablePadding>
            {passkeys.map((p, i) => (
              <ListItem
                key={p.id}
                divider={i < passkeys.length - 1}
                secondaryAction={
                  <Button color="error" onClick={() => remove(p)} disabled={busy || passkeys.length === 1}>
                    Remove
                  </Button>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <span>{p.name}</span>
                      {p.current && <Chip size="small" label="This session" />}
                    </Stack>
                  }
                  secondary={`Added ${dateFormat.format(new Date(p.createdAt))}`}
                  sx={{ pr: 10 }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
      {passkeys?.length === 1 && (
        <Typography variant="body2" color="text.secondary">
          You cannot remove your last passkey. Add another device first.
        </Typography>
      )}
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <TextField
            label="Device name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
          />
          <Button variant="contained" startIcon={<Add />} onClick={add} disabled={busy || !name.trim()}>
            Add this device
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
