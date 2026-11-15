import { Box, Button, ButtonBase, IconButton, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Recipe } from "../types/Recipe";
import { headingFont } from "../theme/herb";
import { parseSimpleMarkdown } from "../utils/simpleMarkdown";
import { tagLabel } from "./filters";
import { CookMode } from "./CookMode";
import { BackIcon, PlayIcon, SunIcon } from "./icons";
import { toLines } from "./lines";
import { PhotoTile } from "./PhotoTile";
import { DifficultyDot, ScaledText } from "./parts";
import { hasAmounts, noteText, scaleLine, servingsLabel } from "./scale";
import { shortTime } from "./time";
import { useWakeLock } from "./useWakeLock";
import { tapArea } from "./tapArea";

interface RecipePageProps {
  recipe: Recipe;
  desktop: boolean;
  onBack: () => void;
  onTag: (tag: string) => void;
  header?: ReactNode;
}

function Chips({ recipe, onTag }: { recipe: Recipe; onTag: (tag: string) => void }) {
  const t = useTheme().herb;
  const difficulty = recipe.difficulty.trim();
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
      {difficulty && (
        <Box
          component="span"
          sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 32, px: 1.5, borderRadius: 999, bgcolor: t.surface, border: `1px solid ${t.line}`, fontSize: 13, fontWeight: 600 }}
        >
          <DifficultyDot difficulty={difficulty} size={8} />
          {difficulty}
        </Box>
      )}
      {recipe.tags.map((tag) => (
        <ButtonBase
          key={tag}
          onClick={() => onTag(tag)}
          sx={{ ...tapArea(32), height: 32, px: 1.5, borderRadius: 999, fontSize: 13, fontWeight: 600, color: t.herb, bgcolor: t.herbTint }}
        >
          {tagLabel(tag)}
        </ButtonBase>
      ))}
    </Box>
  );
}

function Stats({ recipe, columns, factor }: { recipe: Recipe; columns: number; factor: number }) {
  const t = useTheme().herb;
  const stats = [
    { label: "Prep", value: shortTime(recipe.prep_time) },
    { label: "Cook", value: shortTime(recipe.cook_time) },
    { label: "Total", value: shortTime(recipe.total_time) },
    { label: "Serves", value: servingsLabel(recipe.servings, factor), scaled: factor !== 1 },
  ].filter((s) => s.value);
  if (stats.length === 0) return null;
  return (
    <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1 }}>
      {stats.map((s) => (
        <Box key={s.label} sx={{ bgcolor: t.surface, border: `1px solid ${t.line}`, borderRadius: "16px", p: "12px 14px", display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box component="dt" sx={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: t.ink2 }}>
            {s.label}
          </Box>
          <Box component="dd" sx={{ m: 0, fontWeight: 700, fontSize: 15, lineHeight: 1.3, overflowWrap: "anywhere", color: s.scaled ? t.herb : undefined }}>
            {s.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function SectionTitle({ children, size = 22 }: { children: string; size?: number }) {
  return (
    <Box component="h2" sx={{ m: 0, mb: 1.5, fontFamily: headingFont, fontWeight: 700, fontSize: size }}>
      {children}
    </Box>
  );
}

const FACTORS = [1, 2, 3, 4];

// ×1 to ×4. Four buttons and the title need a card row of 321 px: a phone of 403 px or more. On a
// narrower card ×3 hides, unless it is the chosen factor (after a turn of the phone); then ×4 hides.
const FOUR_FIT = "@container (min-width: 321px)";
function Scaler({ factor, onChange }: { factor: number; onChange: (factor: number) => void }) {
  const t = useTheme().herb;
  return (
    <ToggleButtonGroup
      exclusive
      value={factor}
      onChange={(_, value: number | null) => value !== null && onChange(value)}
      aria-label="Amounts"
      sx={{
        flexShrink: 0,
        p: "3px",
        gap: "2px",
        borderRadius: 999,
        bgcolor: t.ground,
        border: `1px solid ${t.line}`,
        "& .MuiToggleButtonGroup-grouped": {
          ...tapArea(38),
          minWidth: 44,
          height: 38,
          px: 1,
          m: 0,
          border: 0,
          borderRadius: "999px !important",
          fontSize: 14,
          fontWeight: 700,
          color: t.ink,
          "&.Mui-selected, &.Mui-selected:hover": { bgcolor: t.herb, color: t.onHerb },
        },
      }}
    >
      {FACTORS.map((f) => (
        <ToggleButton key={f} value={f} sx={f === (factor === 3 ? 4 : 3) ? { display: "none", [FOUR_FIT]: { display: "inline-flex" } } : undefined}>
          {f}×
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function ScaleNote({ servings, factor, onReset }: { servings: string; factor: number; onReset: () => void }) {
  const t = useTheme().herb;
  return (
    <Box
      role="status"
      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, py: 0.5, pl: 1.75, pr: 0.5, borderRadius: "14px", bgcolor: t.saffronTint, color: t.saffronInk, fontSize: 14, lineHeight: 1.4 }}
    >
      <Box component="span" sx={{ flexGrow: 1 }}>
        {noteText(servings, factor)}
      </Box>
      <Button onClick={onReset} sx={{ flexShrink: 0, color: t.saffronInk, fontWeight: 700, textDecoration: "underline", "&:hover": { textDecoration: "underline" } }}>
        Reset
      </Button>
    </Box>
  );
}

function Ingredients({ recipe, factor, onFactor }: { recipe: Recipe; factor: number; onFactor: (factor: number) => void }) {
  const t = useTheme().herb;
  const lines = toLines(recipe.ingredients);
  return (
    <Box component="section" sx={{ bgcolor: t.surface, border: `1px solid ${t.line}`, borderRadius: "24px", p: 2.5 }}>
      <Box sx={{ containerType: "inline-size", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5, "& h2": { mb: 0 } }}>
        <SectionTitle>Ingredients</SectionTitle>
        {hasAmounts(recipe.ingredients) && <Scaler factor={factor} onChange={onFactor} />}
      </Box>
      {factor !== 1 && <ScaleNote servings={recipe.servings} factor={factor} onReset={() => onFactor(1)} />}
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
        {lines.map((line, i) =>
          line.heading ? (
            <Box component="li" key={i} sx={{ pt: 2, pb: 0.75, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: t.herb }}>
              {parseSimpleMarkdown(line.text)}
            </Box>
          ) : (
            <Box
              component="li"
              key={i}
              sx={{
                display: "flex",
                gap: 1.5,
                alignItems: "flex-start",
                py: 1.25,
                borderTop: i === 0 || lines[i - 1].heading ? "none" : `1px solid ${t.line}`,
                fontSize: 16,
                lineHeight: 1.45,
              }}
            >
              <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: t.saffron, mt: "8px", flexShrink: 0 }} />
              <span>
                <ScaledText parts={scaleLine(line.text, factor)} />
              </span>
            </Box>
          ),
        )}
      </Box>
    </Box>
  );
}

function Steps({ items, desktop }: { items: string[]; desktop: boolean }) {
  const t = useTheme().herb;
  const size = desktop ? 36 : 32;
  return (
    <Box component="section">
      <SectionTitle size={desktop ? 24 : 22}>Steps</SectionTitle>
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: desktop ? 2.5 : 2.25 }}>
        {toLines(items).map((line, i) =>
          line.heading ? (
            <Box component="li" key={i} sx={{ pt: 1, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: t.herb }}>
              {parseSimpleMarkdown(line.text)}
            </Box>
          ) : (
            <Box component="li" key={i} sx={{ display: "flex", gap: 1.75, alignItems: "flex-start" }}>
              <Box
                component="span"
                sx={{ width: size, height: size, borderRadius: "50%", bgcolor: t.herb, color: t.onHerb, fontFamily: headingFont, fontWeight: 700, fontSize: desktop ? 16 : 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                {line.number}
              </Box>
              <Box component="span" sx={{ fontSize: desktop ? 17 : 16, lineHeight: 1.55, pt: "4px", overflowWrap: "anywhere" }}>
                {parseSimpleMarkdown(line.text)}
              </Box>
            </Box>
          ),
        )}
      </Box>
    </Box>
  );
}

function Notes({ notes }: { notes: string[] }) {
  const t = useTheme().herb;
  if (notes.length === 0) return null;
  return (
    <Box component="section" sx={{ bgcolor: t.saffronTint, color: t.saffronInk, borderRadius: "24px", p: 2.5 }}>
      <Box component="h2" sx={{ m: 0, mb: 1.25, fontFamily: headingFont, fontWeight: 700, fontSize: 18 }}>
        Notes
      </Box>
      <Box component="ul" sx={{ m: 0, pl: 2.25, display: "flex", flexDirection: "column", gap: 0.75, fontSize: 15, lineHeight: 1.5, overflowWrap: "anywhere" }}>
        {notes.map((note, i) => (
          <li key={i}>{parseSimpleMarkdown(note)}</li>
        ))}
      </Box>
    </Box>
  );
}

function StartCooking({ desktop, onStart }: { desktop: boolean; onStart: () => void }) {
  return (
    <Button
      variant="contained"
      onClick={onStart}
      startIcon={<PlayIcon size={18} />}
      sx={{ height: 52, fontSize: 16, alignSelf: desktop ? "flex-start" : "stretch", px: desktop ? 3 : undefined }}
    >
      Start cooking
    </Button>
  );
}

function ScreenOn() {
  const t = useTheme().herb;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 13, color: t.ink2 }}>
      <SunIcon size={16} color={t.herb} />
      <span>The screen stays on while this recipe is open.</span>
    </Box>
  );
}

export function RecipePage({ recipe, desktop, onBack, onTag, header }: RecipePageProps) {
  const t = useTheme().herb;
  const screenOn = useWakeLock(!desktop);
  const notes = (recipe.notes ?? []).filter((n) => n.trim());
  // Kept with its recipe, so another recipe opens at ×1.
  const [scale, setScale] = useState({ id: recipe.id, factor: 1 });
  const factor = scale.id === recipe.id ? scale.factor : 1;
  const setFactor = (f: number) => setScale({ id: recipe.id, factor: f });
  // A reload or Forward onto a cook mode entry opens cook mode again.
  const [cooking, setCooking] = useState(() => Boolean(window.history.state?.cook));
  const canCook = toLines(recipe.instructions).some((l) => !l.heading);
  const startCooking = () => {
    window.history.pushState({ ...window.history.state, cook: true }, "");
    setCooking(true);
  };
  const stopCooking = useCallback(() => setCooking(false), []);
  useEffect(() => {
    const onPop = () => {
      if ((window.history.state as { cook?: boolean } | null)?.cook) setCooking(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const cookMode = cooking && <CookMode recipe={recipe} factor={factor} desktop={desktop} onClosed={stopCooking} />;

  if (desktop) {
    return (
      <Box sx={{ pb: 9 }}>
        {header}
        <Box sx={{ maxWidth: 1240, mx: "auto", px: 4, pt: 3, display: "flex", flexDirection: "column", gap: 4 }}>
          <AllRecipesButton onBack={onBack} />
          <Box component="section" sx={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
            <Box sx={{ flex: "1 1 460px", minWidth: 0, maxWidth: 620 }}>
              <PhotoTile src={recipe.image_url} name={recipe.name} alt={recipe.name} aspectRatio="4 / 3" radius="28px" letterSize={140} />
            </Box>
            <Box sx={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2.25 }}>
              <Chips recipe={recipe} onTag={onTag} />
              <Box component="h1" sx={{ m: 0, fontFamily: headingFont, fontWeight: 800, fontSize: 56, lineHeight: 1, letterSpacing: "-0.03em" }}>
                {recipe.name}
              </Box>
              {recipe.description && (
                <Box component="p" sx={{ m: 0, fontSize: 18, lineHeight: 1.55, color: t.ink2 }}>
                  {recipe.description}
                </Box>
              )}
              <Stats recipe={recipe} columns={4} factor={factor} />
              {canCook && <StartCooking desktop onStart={startCooking} />}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "flex-start" }}>
            <Box sx={{ flex: "1 1 340px", minWidth: 0, maxWidth: 420 }}>
              <Ingredients recipe={recipe} factor={factor} onFactor={setFactor} />
            </Box>
            <Box sx={{ flex: "2 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3.5 }}>
              <Steps items={recipe.instructions} desktop />
              <Notes notes={notes} />
            </Box>
          </Box>
        </Box>
        {cookMode}
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ position: "relative" }}>
        <PhotoTile src={recipe.image_url} name={recipe.name} alt={recipe.name} height={340} letterHeight={240} radius={0} letterSize={120} />
        <PhotoBackButton onBack={onBack} />
      </Box>
      <Box component="main" sx={{ position: "relative", mt: "-28px", borderRadius: "28px 28px 0 0", bgcolor: t.ground, p: "24px 20px 0", display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Chips recipe={recipe} onTag={onTag} />
          <Box component="h1" sx={{ m: 0, fontFamily: headingFont, fontWeight: 800, fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            {recipe.name}
          </Box>
          {recipe.description && (
            <Box component="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.55, color: t.ink2 }}>
              {recipe.description}
            </Box>
          )}
        </Box>
        <Stats recipe={recipe} columns={2} factor={factor} />
        {canCook && <StartCooking desktop={false} onStart={startCooking} />}
        {screenOn && <ScreenOn />}
        <Ingredients recipe={recipe} factor={factor} onFactor={setFactor} />
        <Steps items={recipe.instructions} desktop={false} />
        <Notes notes={notes} />
      </Box>
      {cookMode}
    </Box>
  );
}

// The way back to the list on a desktop recipe page.
function AllRecipesButton({ onBack }: { onBack: () => void }) {
  const t = useTheme().herb;
  return (
    <ButtonBase onClick={onBack} sx={{ alignSelf: "flex-start", height: 44, gap: 0.75, fontSize: 15, fontWeight: 600, color: t.herb }}>
      <BackIcon size={18} color={t.herb} strokeWidth={2.2} />
      All recipes
    </ButtonBase>
  );
}

// The way back to the list on a phone, over the photo at the top of the page.
function PhotoBackButton({ onBack }: { onBack: () => void }) {
  return (
    <IconButton
      aria-label="Back to recipes"
      onClick={onBack}
      sx={{ position: "absolute", zIndex: 1, top: 20, left: 20, width: 44, height: 44, bgcolor: "rgba(255,255,255,0.92)", "&:hover": { bgcolor: "#FFFFFF" } }}
    >
      <BackIcon color="#16201B" strokeWidth={2.2} />
    </IconButton>
  );
}

// The way back to the list on a recipe page that has no recipe to show (loading, load error).
export function RecipeBackBar({ desktop, onBack }: { desktop: boolean; onBack: () => void }) {
  const t = useTheme().herb;
  if (desktop) {
    return (
      <Box sx={{ maxWidth: 1240, mx: "auto", px: 4, pt: 3 }}>
        <AllRecipesButton onBack={onBack} />
      </Box>
    );
  }
  return (
    <Box sx={{ p: "20px 20px 0" }}>
      <IconButton aria-label="Back to recipes" onClick={onBack} sx={{ width: 44, height: 44, border: `1px solid ${t.line}`, bgcolor: t.surface, "&:hover": { bgcolor: t.surface } }}>
        <BackIcon color={t.ink} strokeWidth={2.2} />
      </IconButton>
    </Box>
  );
}

// The recipe page while recipes.db loads: the photo area and grey lines in the page layout.
export function RecipeSkeleton({ desktop, onBack }: { desktop: boolean; onBack: () => void }) {
  const t = useTheme().herb;
  const bar = (width: string, height: number) => <Box sx={{ width, height, borderRadius: 1, bgcolor: t.skeleton }} />;
  return (
    <Box sx={{ position: "relative" }}>
      {desktop ? (
        <RecipeBackBar desktop onBack={onBack} />
      ) : (
        <PhotoBackButton onBack={onBack} />
      )}
      <Box role="status" aria-label="Loading the recipe" sx={desktop ? { maxWidth: 1240, mx: "auto", px: 4, pt: 3, display: "flex", gap: 5 } : {}}>
        <Box sx={desktop ? { flex: "1 1 460px", maxWidth: 620, aspectRatio: "4 / 3", borderRadius: "28px", bgcolor: t.herbTint } : { height: 340, bgcolor: t.herbTint }} />
        <Box sx={{ flex: "1 1 420px", p: desktop ? 0 : "24px 20px", display: "flex", flexDirection: "column", gap: 1.75 }}>
          {bar("40%", 28)}
          {bar("85%", 34)}
          {bar("100%", 14)}
          {bar("90%", 14)}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 1 }}>
            {[0, 1, 2, 3].map((i) => (
              <Box key={i} sx={{ height: 62, borderRadius: "16px", bgcolor: t.skeleton }} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
