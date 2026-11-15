import { Box, Button, ButtonBase, Checkbox, Dialog, Drawer, IconButton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Recipe } from "../types/Recipe";
import { headingFont } from "../theme/herb";
import { parseSimpleMarkdown } from "../utils/simpleMarkdown";
import { clock, stepIngredients, stepTimes, timeLabel, timeLeft } from "./cook";
import { CheckIcon, CloseIcon, ListIcon, SunIcon, TimerIcon } from "./icons";
import { toLines } from "./lines";
import { ScaledText } from "./parts";
import { scaleLine } from "./scale";
import { useWakeLock } from "./useWakeLock";

interface CookModeProps {
  recipe: Recipe;
  factor: number;
  desktop: boolean;
  // Called when the cook mode history entry is gone; the page then unmounts cook mode.
  onClosed: () => void;
}

interface Step {
  text: string;
  heading: string | null;
}

// One timer of a step. `endsAt` is set while it runs; `left` holds the seconds while it waits.
interface Timer {
  step: number;
  seconds: number;
  endsAt: number | null;
  left: number;
  rang: boolean;
}

const timerKey = (step: number, seconds: number) => `${step}:${seconds}`;

function cookSteps(instructions: string[]): Step[] {
  let heading: string | null = null;
  const steps: Step[] = [];
  for (const line of toLines(instructions)) {
    if (line.heading) heading = line.text;
    else steps.push({ text: line.text, heading });
  }
  return steps;
}

// Three short tones. iOS plays Web Audio only from a context that a tap created.
function ring(audio: AudioContext | null) {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  if (!audio) return;
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + i * 0.4);
    osc.stop(audio.currentTime + i * 0.4 + 0.25);
  }
}

// The timers of cook mode. They keep the end time, so a hidden page shows the right time when it
// comes back; the tone plays then if the time ended meanwhile.
function useTimers() {
  const [timers, setTimers] = useState<Record<string, Timer>>({});
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const running = Object.values(timers).some((t) => t.endsAt !== null);

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  useEffect(() => {
    if (document.visibilityState === "hidden") return;
    const ended = Object.entries(timers).filter(([, t]) => t.endsAt !== null && timeLeft(t.endsAt, now) === 0);
    if (ended.length === 0) return;
    ring(audio.current);
    setTimers((all) => {
      const next = { ...all };
      for (const [key, t] of ended) next[key] = { ...t, endsAt: null, left: 0, rang: true };
      return next;
    });
  }, [now, timers]);

  useEffect(() => () => void audio.current?.close(), []);

  const left = (t: Timer) => (t.endsAt === null ? t.left : timeLeft(t.endsAt, now));

  const start = (step: number, seconds: number) => {
    if (!audio.current && typeof AudioContext !== "undefined") audio.current = new AudioContext();
    void audio.current?.resume();
    const key = timerKey(step, seconds);
    const current = Date.now();
    setNow(current);
    setTimers((all) => {
      const t = all[key];
      const from = t && t.left > 0 ? t.left : seconds;
      return { ...all, [key]: { step, seconds, endsAt: current + from * 1000, left: from, rang: false } };
    });
  };

  const pause = (key: string) =>
    setTimers((all) => {
      const t = all[key];
      return t?.endsAt ? { ...all, [key]: { ...t, endsAt: null, left: timeLeft(t.endsAt, Date.now()) } } : all;
    });

  const stopAll = () => setTimers({});

  return { timers, running, left, start, pause, stopAll };
}

export function CookMode({ recipe, factor, desktop, onClosed }: CookModeProps) {
  const t = useTheme().herb;
  const steps = cookSteps(recipe.instructions);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [ticks, setTicks] = useState<Record<number, boolean>>({});
  const [asking, setAsking] = useState(false);
  const timers = useTimers();
  const screenOn = useWakeLock(true);
  const done = step >= steps.length;
  const current = steps[step];

  // The history entries of cook mode and of the sheet make the phone's Back close them. Only this
  // handler changes the state, so a button, Escape and Back all take the same path.
  const runningRef = useRef(timers.running);
  runningRef.current = timers.running;
  useEffect(() => {
    const onPop = () => {
      const state = window.history.state as { cook?: boolean; sheet?: boolean } | null;
      if (state?.cook) {
        setSheet(Boolean(state.sheet));
        return;
      }
      if (runningRef.current) {
        window.history.pushState({ ...state, cook: true }, "");
        setSheet(false);
        setAsking(true);
        return;
      }
      onClosed();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClosed]);

  const requestClose = useCallback(() => {
    if (runningRef.current) setAsking(true);
    else window.history.back();
  }, []);

  const openSheet = () => {
    window.history.pushState({ ...window.history.state, sheet: true }, "");
    setSheet(true);
  };

  const stopAndClose = () => {
    timers.stopAll();
    runningRef.current = false;
    setAsking(false);
    window.history.back();
  };

  const go = (next: number) => setStep(Math.max(0, Math.min(steps.length, next)));

  const onKeyDown = (e: KeyboardEvent) => {
    if (sheet || asking) return;
    if (e.key === "ArrowRight" && !done) go(step + 1);
    if (e.key === "ArrowLeft" && step > 0) go(step - 1);
  };

  const ingredientLines = recipe.ingredients;
  const chips = current ? stepIngredients(current.text, ingredientLines) : [];
  const times = current ? stepTimes(current.text) : [];
  const elsewhere = Object.entries(timers.timers).filter(([, tm]) => tm.step !== step && (tm.endsAt !== null || tm.rang));

  return (
    <Dialog
      open
      fullScreen
      onClose={requestClose}
      onKeyDown={onKeyDown}
      slotProps={{ paper: { "aria-label": `Cook mode: ${recipe.name}`, sx: { bgcolor: t.ground, color: t.ink } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%", width: "100%", maxWidth: 680, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: "12px 12px 0" }}>
          <IconButton aria-label="Close cook mode" onClick={requestClose} sx={{ border: `1px solid ${t.line}`, bgcolor: t.surface, flexShrink: 0, "&:hover": { bgcolor: t.surface } }}>
            <CloseIcon color={t.ink} />
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0, lineHeight: 1.3 }}>
            <Box sx={{ fontSize: 13, color: t.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {recipe.name}
              {factor !== 1 && ` · ${factor}×`}
            </Box>
            <Box sx={{ fontWeight: 700, fontSize: 15 }}>{done ? "All done" : `Step ${step + 1} of ${steps.length}`}</Box>
          </Box>
          <Button
            onClick={openSheet}
            startIcon={<ListIcon size={18} />}
            sx={{ flexShrink: 0, bgcolor: t.herbTint, color: t.herb, px: 2, "&:hover": { bgcolor: t.herbTint } }}
          >
            Ingredients
          </Button>
        </Box>

        {elsewhere.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, px: 2.5, pt: 1.5 }}>
            {elsewhere.map(([key, tm]) => (
              <ButtonBase
                key={key}
                onClick={() => go(tm.step)}
                sx={{ height: 44, px: 1.75, gap: 1, borderRadius: 999, fontWeight: 700, fontSize: 15, fontVariantNumeric: "tabular-nums", bgcolor: tm.rang ? t.saffron : t.surface, color: tm.rang ? t.onSaffron : t.ink, border: `1px solid ${tm.rang ? t.saffron : t.line}` }}
              >
                <TimerIcon size={18} />
                {tm.rang ? `Step ${tm.step + 1}: time is up` : `Step ${tm.step + 1} · ${clock(timers.left(tm))}`}
              </ButtonBase>
            ))}
          </Box>
        )}

        <Box aria-hidden="true" sx={{ display: "flex", gap: "4px", px: 2.5, pt: 1.75 }}>
          {steps.map((_, i) => (
            <Box key={i} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i <= step ? t.herb : t.line }} />
          ))}
        </Box>

        {done ? (
          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2.25, p: 4, textAlign: "center" }}>
            <Box sx={{ width: 96, height: 96, borderRadius: "50%", bgcolor: t.herbTint, color: t.herb, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckIcon size={46} strokeWidth={2.4} />
            </Box>
            <Box component="h2" sx={{ m: 0, fontFamily: headingFont, fontWeight: 800, fontSize: 36, letterSpacing: "-0.02em" }}>
              Bon appétit !
            </Box>
            <Box component="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.5, color: t.ink2 }}>
              All {steps.length} steps of {recipe.name} are done.
            </Box>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 3, p: { xs: "32px 24px 16px", md: "40px 24px 16px" } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: t.herb, color: t.onHerb, fontFamily: headingFont, fontWeight: 800, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {step + 1}
              </Box>
              {current.heading && (
                <Box sx={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: t.herb }}>{current.heading}</Box>
              )}
            </Box>
            <Box component="p" aria-live="polite" sx={{ m: 0, fontSize: { xs: 27, md: 30 }, lineHeight: 1.4, fontWeight: 500, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>
              {parseSimpleMarkdown(current.text)}
            </Box>

            {chips.length > 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: t.ink2 }}>In this step</Box>
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {chips.map((line) => (
                    <Box component="li" key={line} sx={{ px: 1.5, py: 1, borderRadius: "12px", bgcolor: t.saffronTint, color: t.saffronInk, fontSize: 15, lineHeight: 1.35, "& b": { color: "inherit" } }}>
                      <ScaledText parts={scaleLine(line, factor)} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {times.map((seconds) => {
              const key = timerKey(step, seconds);
              const tm = timers.timers[key];
              const left = tm ? timers.left(tm) : seconds;
              return (
                <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 1.75, p: "14px 14px 14px 18px", borderRadius: "20px", bgcolor: t.surface, border: `1px solid ${tm?.rang ? t.saffron : t.line}` }}>
                  <TimerIcon size={26} color={t.herb} />
                  <Box role="timer" aria-label={`Timer ${timeLabel(seconds)}`} sx={{ flexGrow: 1, fontFamily: headingFont, fontWeight: 800, fontSize: 30, fontVariantNumeric: "tabular-nums" }}>
                    {tm?.rang ? "Time is up" : tm ? clock(left) : timeLabel(seconds)}
                  </Box>
                  {tm?.endsAt ? (
                    <Button variant="outlined" color="inherit" onClick={() => timers.pause(key)} sx={{ borderColor: t.line }}>
                      Pause
                    </Button>
                  ) : (
                    <Button variant="contained" onClick={() => timers.start(step, seconds)}>
                      {tm && !tm.rang && left > 0 && left < seconds ? "Go on" : tm?.rang ? "Again" : "Start timer"}
                    </Button>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {screenOn && !done && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, fontSize: 13, color: t.ink2, pb: 1.25 }}>
            <SunIcon size={15} color={t.herb} />
            The screen stays on.
          </Box>
        )}
        {done ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, p: "0 20px 28px" }}>
            <Button variant="contained" onClick={requestClose} sx={{ height: 56, fontSize: 17 }}>
              Back to the recipe
            </Button>
            <Button onClick={() => go(0)} sx={{ height: 48, fontSize: 16 }}>
              Start again from step 1
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 1.5, p: "0 20px 28px" }}>
            <Button variant="outlined" color="inherit" disabled={step === 0} onClick={() => go(step - 1)} sx={{ flex: 1, height: 60, fontSize: 17, borderColor: t.line, bgcolor: t.surface }}>
              Back
            </Button>
            <Button variant="contained" onClick={() => go(step + 1)} sx={{ flex: 2, height: 60, fontSize: 17, fontWeight: 700 }}>
              {step === steps.length - 1 ? "Finish" : "Next step"}
            </Button>
          </Box>
        )}
      </Box>

      <IngredientSheet
        open={sheet}
        lines={ingredientLines}
        factor={factor}
        ticks={ticks}
        desktop={desktop}
        onTick={(i) => setTicks((all) => ({ ...all, [i]: !all[i] }))}
        onClose={() => window.history.back()}
      />

      <Dialog open={asking} onClose={() => setAsking(false)} aria-labelledby="cook-timer-question">
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2, maxWidth: 360 }}>
          <Box component="h2" id="cook-timer-question" sx={{ m: 0, fontFamily: headingFont, fontWeight: 700, fontSize: 22 }}>
            A timer is running
          </Box>
          <Box component="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.5, color: t.ink2 }}>
            Stop it and close cook mode?
          </Box>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button variant="outlined" color="inherit" onClick={() => setAsking(false)} sx={{ borderColor: t.line }}>
              Keep cooking
            </Button>
            <Button variant="contained" onClick={stopAndClose}>
              Stop and close
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Dialog>
  );
}

interface SheetProps {
  open: boolean;
  lines: string[];
  factor: number;
  ticks: Record<number, boolean>;
  desktop: boolean;
  onTick: (index: number) => void;
  onClose: () => void;
}

function IngredientSheet({ open, lines, factor, ticks, desktop, onTick, onClose }: SheetProps) {
  const t = useTheme().herb;
  const list = toLines(lines);
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // A drawer sits under a dialog by default, and cook mode is a dialog.
      sx={(theme) => ({ zIndex: theme.zIndex.modal + 1 })}
      slotProps={{ paper: { "aria-label": "Ingredients", sx: { maxHeight: "85vh", width: "100%", maxWidth: desktop ? 680 : undefined, mx: "auto", bgcolor: t.surface } } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: "20px 12px 8px 24px" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Box component="h2" sx={{ m: 0, fontFamily: headingFont, fontWeight: 700, fontSize: 22 }}>
            Ingredients
          </Box>
          <Box sx={{ fontSize: 14, color: t.ink2 }}>
            {factor !== 1 ? `Amounts ${factor}× · ` : ""}Tick what is ready.
          </Box>
        </Box>
        <IconButton aria-label="Close the ingredients" onClick={onClose} sx={{ bgcolor: t.ground, "&:hover": { bgcolor: t.ground } }}>
          <CloseIcon color={t.ink} />
        </IconButton>
      </Box>
      <Box component="ul" sx={{ m: 0, p: "0 16px 28px 12px", listStyle: "none", overflowY: "auto" }}>
        {list.map((line, i) =>
          line.heading ? (
            <Box component="li" key={i} sx={{ pt: 1.75, pb: 0.5, pl: 1.5, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: t.herb }}>
              {line.text}
            </Box>
          ) : (
            <Box component="li" key={i} sx={{ borderTop: i === 0 || list[i - 1].heading ? "none" : `1px solid ${t.line}` }}>
              <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 48, fontSize: 16, lineHeight: 1.4, cursor: "pointer", color: ticks[i] ? t.ink2 : t.ink, textDecoration: ticks[i] ? "line-through" : "none" }}>
                <Checkbox checked={Boolean(ticks[i])} onChange={() => onTick(i)} />
                <span>
                  <ScaledText parts={scaleLine(line.text, factor)} />
                </span>
              </Box>
            </Box>
          ),
        )}
      </Box>
    </Drawer>
  );
}
