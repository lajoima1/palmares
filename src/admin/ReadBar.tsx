import { useState } from "react";
import { Alert, Box, Button, Divider, Menu, MenuItem, Typography } from "@mui/material";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import type { ModelChoice } from "./api";

export type SourceKind = "photo" | "link" | "text";

const READ: Record<SourceKind, string> = { photo: "your photo", link: "the page", text: "your text" };

interface ReadBarProps {
  models: ModelChoice[];
  readBy: ModelChoice;
  kind: SourceKind;
  // "Mistral Small was busy." after a switch.
  switched: string | null;
  // The error of a failed "Read again".
  error: string | null;
  onReadAgain: (model: ModelChoice) => void;
  onOther: () => void;
}

// The bar at the top of a form that a model filled.
export function ReadBar({ models, readBy, kind, switched, error, onReadAgain, onOther }: ReadBarProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const others = models.filter((m) => m.id !== readBy.id);

  function choose(action: () => void) {
    setAnchor(null);
    action();
  }

  return (
    <Box sx={(t) => ({ bgcolor: t.herb.herbTint, color: t.herb.ink })}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1, pl: { xs: 2.5, sm: 3 }, pr: 1 }}>
        <CheckRounded sx={(t) => ({ color: t.herb.herb, flexShrink: 0 })} />
        <Box data-step-focus tabIndex={-1} role="status" sx={{ flexGrow: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4, outline: "none" }}>
          <Typography component="span" sx={{ fontSize: "inherit", fontWeight: 600, display: { xs: "block", md: "inline" } }}>
            {readBy.name} read {READ[kind]}.
          </Typography>{" "}
          <Typography component="span" sx={(t) => ({ fontSize: "inherit", color: t.herb.ink2 })}>
            Check each field.{switched ? ` ${switched}` : ""}
          </Typography>
        </Box>
        <Button
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          endIcon={<ExpandMoreRounded />}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ flexShrink: 0, whiteSpace: "nowrap", px: 1.5 }}
        >
          Read again
        </Button>
        <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
          {others.map((m) => (
            <MenuItem key={m.id} onClick={() => choose(() => onReadAgain(m))} sx={{ minHeight: { xs: 48, sm: 48 } }}>
              Read again with {m.name}
            </MenuItem>
          ))}
          {others.length > 0 && <Divider />}
          <MenuItem onClick={() => choose(onOther)} sx={{ minHeight: { xs: 48, sm: 48 } }}>
            Other photo, link or text
          </MenuItem>
        </Menu>
      </Box>
      {error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
