import { Box, ButtonBase, IconButton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";
import type { Recipe } from "../types/Recipe";
import { headingFont } from "../theme/herb";
import { parseSimpleMarkdown } from "../utils/simpleMarkdown";
import { tagLabel } from "./filters";
import { BackIcon, SunIcon } from "./icons";
import { toLines } from "./lines";
import { PhotoTile } from "./PhotoTile";
import { DifficultyDot } from "./parts";
import { shortTime } from "./time";
import { useWakeLock } from "./useWakeLock";

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
          sx={{ height: 32, px: 1.5, borderRadius: 999, fontSize: 13, fontWeight: 600, color: t.herb, bgcolor: t.herbTint }}
        >
          {tagLabel(tag)}
        </ButtonBase>
      ))}
    </Box>
  );
}

function Stats({ recipe, columns }: { recipe: Recipe; columns: number }) {
  const t = useTheme().herb;
  const stats = [
    { label: "Prep", value: shortTime(recipe.prep_time) },
    { label: "Cook", value: shortTime(recipe.cook_time) },
    { label: "Total", value: shortTime(recipe.total_time) },
    { label: "Serves", value: recipe.servings.trim() },
  ].filter((s) => s.value);
  if (stats.length === 0) return null;
  return (
    <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1 }}>
      {stats.map((s) => (
        <Box key={s.label} sx={{ bgcolor: t.surface, border: `1px solid ${t.line}`, borderRadius: "16px", p: "12px 14px", display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box component="dt" sx={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: t.ink2 }}>
            {s.label}
          </Box>
          <Box component="dd" sx={{ m: 0, fontWeight: 700, fontSize: 15, lineHeight: 1.3, overflowWrap: "anywhere" }}>
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

function Ingredients({ items }: { items: string[] }) {
  const t = useTheme().herb;
  const lines = toLines(items);
  return (
    <Box component="section" sx={{ bgcolor: t.surface, border: `1px solid ${t.line}`, borderRadius: "24px", p: 2.5 }}>
      <SectionTitle>Ingredients</SectionTitle>
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
              <span>{parseSimpleMarkdown(line.text)}</span>
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

  if (desktop) {
    return (
      <Box sx={{ pb: 9 }}>
        {header}
        <Box sx={{ maxWidth: 1240, mx: "auto", px: 4, pt: 3, display: "flex", flexDirection: "column", gap: 4 }}>
          <ButtonBase onClick={onBack} sx={{ alignSelf: "flex-start", height: 44, gap: 0.75, fontSize: 15, fontWeight: 600, color: t.herb }}>
            <BackIcon size={18} color={t.herb} strokeWidth={2.2} />
            All recipes
          </ButtonBase>
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
              <Stats recipe={recipe} columns={4} />
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "flex-start" }}>
            <Box sx={{ flex: "1 1 340px", minWidth: 0, maxWidth: 420 }}>
              <Ingredients items={recipe.ingredients} />
            </Box>
            <Box sx={{ flex: "2 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3.5 }}>
              <Steps items={recipe.instructions} desktop />
              <Notes notes={notes} />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ position: "relative" }}>
        <PhotoTile src={recipe.image_url} name={recipe.name} alt={recipe.name} height={340} letterHeight={240} radius={0} letterSize={120} />
        <IconButton
          aria-label="Back to recipes"
          onClick={onBack}
          sx={{ position: "absolute", top: 20, left: 20, width: 44, height: 44, bgcolor: "rgba(255,255,255,0.92)", "&:hover": { bgcolor: "#FFFFFF" } }}
        >
          <BackIcon color="#16201B" strokeWidth={2.2} />
        </IconButton>
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
        <Stats recipe={recipe} columns={2} />
        {screenOn && <ScreenOn />}
        <Ingredients items={recipe.ingredients} />
        <Steps items={recipe.instructions} desktop={false} />
        <Notes notes={notes} />
      </Box>
    </Box>
  );
}

// The recipe page while recipes.db loads: the photo area and grey lines in the page layout.
export function RecipeSkeleton({ desktop }: { desktop: boolean }) {
  const t = useTheme().herb;
  const bar = (width: string, height: number) => <Box sx={{ width, height, borderRadius: 1, bgcolor: t.skeleton }} />;
  return (
    <Box role="status" aria-label="Loading the recipe" sx={desktop ? { maxWidth: 1240, mx: "auto", px: 4, pt: 10, display: "flex", gap: 5 } : {}}>
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
  );
}
