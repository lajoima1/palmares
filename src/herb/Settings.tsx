import { Box, ButtonBase, Drawer, Popover, Switch } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { setAppearance, setLook, type Appearance } from "../look";
import { headingFont } from "../theme/herb";
import { ChevronIcon, PencilIcon } from "./icons";

const MODES: { value: Appearance; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// The admin page sets this cookie at sign-in. Reading it makes no request.
function isEditor(): boolean {
  return document.cookie.split("; ").includes("palmares_editor=1");
}

function Content({ appearance }: { appearance: Appearance }) {
  const t = useTheme().herb;
  const editor = isEditor();
  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        <Box component="span" id="appearance-label" sx={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: t.ink2 }}>
          Appearance
        </Box>
        <Box role="radiogroup" aria-labelledby="appearance-label" sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.5, bgcolor: t.ground, p: 0.5, borderRadius: "16px" }}>
          {MODES.map(({ value, label }) => {
            const on = value === appearance;
            return (
              <ButtonBase
                key={value}
                role="radio"
                aria-checked={on}
                onClick={() => setAppearance(value)}
                sx={{
                  height: 44,
                  borderRadius: "12px",
                  fontSize: 15,
                  fontWeight: 600,
                  bgcolor: on ? t.surface : "transparent",
                  color: on ? t.ink : t.ink2,
                  boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {label}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", border: `1px solid ${t.line}`, borderRadius: "20px" }}>
        <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1.75, p: "12px 8px 12px 16px", cursor: "pointer" }}>
          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Box component="span" sx={{ fontWeight: 600, fontSize: 16 }}>
              Old look
            </Box>
            <Box component="span" sx={{ fontSize: 13, color: t.ink2, lineHeight: 1.4 }}>
              Show the previous design on this device.
            </Box>
          </Box>
          <Switch checked={false} onChange={() => setLook("old")} slotProps={{ input: { "aria-label": "Old look" } }} />
        </Box>
        {editor && (
          <>
            <Box sx={{ height: "1px", bgcolor: t.line, mx: 2 }} aria-hidden="true" />
            <Box
              component="a"
              href={`${import.meta.env.BASE_URL}admin/`}
              sx={{ display: "flex", alignItems: "center", gap: 1.75, p: "14px 16px", color: "inherit", textDecoration: "none", minHeight: 44 }}
            >
              <PencilIcon size={22} color={t.herb} />
              <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 0.25 }}>
                <Box component="span" sx={{ fontWeight: 600, fontSize: 16 }}>
                  Manage recipes
                </Box>
                <Box component="span" sx={{ fontSize: 13, color: t.ink2 }}>
                  Add, change and delete recipes.
                </Box>
              </Box>
              <ChevronIcon size={18} color={t.ink2} />
            </Box>
          </>
        )}
      </Box>
    </>
  );
}

interface SettingsProps {
  desktop: boolean;
  anchor: HTMLElement | null;
  appearance: Appearance;
  onClose: () => void;
}

// A sheet from the bottom on a phone, a panel under the settings button on a desktop. The panel is
// a Popover, not a Menu: a Menu closes on Tab, and its content is not menu items.
export function Settings({ desktop, anchor, appearance, onClose }: SettingsProps) {
  const t = useTheme().herb;
  if (desktop) {
    return (
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            component: "section",
            role: "dialog",
            "aria-label": "Settings",
            sx: { mt: 1, width: 340, p: 2.25, display: "flex", flexDirection: "column", gap: 2, bgcolor: t.surface, borderRadius: "18px", border: `1px solid ${t.line}` },
          },
        }}
      >
        <Content appearance={appearance} />
      </Popover>
    );
  }
  return (
    <Drawer anchor="bottom" open={Boolean(anchor)} onClose={onClose} slotProps={{ paper: { sx: { bgcolor: t.surface } } }}>
      <Box component="section" role="dialog" aria-label="Settings" sx={{ p: "12px 20px 28px", display: "flex", flexDirection: "column", gap: 2.25 }}>
        <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: t.line, alignSelf: "center" }} aria-hidden="true" />
        <Box component="h2" sx={{ m: 0, fontFamily: headingFont, fontWeight: 700, fontSize: 24 }}>
          Settings
        </Box>
        <Content appearance={appearance} />
      </Box>
    </Drawer>
  );
}
