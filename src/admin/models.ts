import { ApiError, type ModelChoice } from "./api";

// The kind of a model error, from the Worker. Each other error has no kind and never switches.
function reason(kind: string | undefined): string {
  if (kind === "daily") return "reached its free limit of the day";
  if (kind === "busy") return "is busy";
  return "failed";
}

function pastReason(kind: string | undefined): string {
  return kind === "busy" ? "was busy" : reason(kind);
}

// The first model of another company. The Cloudflare models share one daily allowance, so a
// second Cloudflare model often fails for the same reason.
export function backupOf(models: ModelChoice[], id: string): ModelChoice | null {
  const model = models.find((m) => m.id === id);
  if (!model) return null;
  return models.find((m) => m.company !== model.company) ?? null;
}

// The reading screen, during a switch: "Mistral Small is busy, so Gemini Flash-Lite reads it."
export function switchText(model: ModelChoice, kind: string | undefined, backup: ModelChoice): string {
  return `${model.name} ${reason(kind)}, so ${backup.name} reads it.`;
}

// The read bar, after a switch: "Mistral Small was busy."
export function switchedText(model: ModelChoice, kind: string | undefined): string {
  return `${model.name} ${pastReason(kind)}.`;
}

function failedText(failures: [ModelChoice, string | undefined][]): string {
  return [...failures.map(([m, kind]) => switchedText(m, kind)), "Try again later, or type the recipe."].join(" ");
}

function isModelError(e: unknown): e is ApiError & { kind: string } {
  return e instanceof ApiError && e.kind !== undefined;
}

interface ReadOutcome<T> {
  result: T;
  model: ModelChoice;
  // The text of the read bar if the first model failed, like "Mistral Small was busy."
  switched: string | null;
}

// One switch at most. A cancel, or an error that another model cannot fix, ends the read as it is.
export async function readWithBackup<T>(
  models: ModelChoice[],
  first: ModelChoice,
  read: (model: ModelChoice) => Promise<T>,
  onSwitch: (text: string, backup: ModelChoice) => void,
): Promise<ReadOutcome<T>> {
  try {
    return { result: await read(first), model: first, switched: null };
  } catch (e) {
    if (!isModelError(e)) throw e;
    const firstKind = e.kind;
    const backup = backupOf(models, first.id);
    if (!backup) throw new ApiError(e.status, failedText([[first, firstKind]]));
    onSwitch(switchText(first, firstKind, backup), backup);
    try {
      return { result: await read(backup), model: backup, switched: switchedText(first, firstKind) };
    } catch (e2) {
      if (!isModelError(e2)) throw e2;
      throw new ApiError(e2.status, failedText([[first, firstKind], [backup, e2.kind]]));
    }
  }
}
