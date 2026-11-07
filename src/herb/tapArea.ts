// Grows the tap area of a control to 44 px high without changing how it looks: a chip 32 px high
// gets 6 px of invisible area above and below. The control needs no `overflow: hidden`.
export function tapArea(height: number) {
  const extra = Math.max(0, (44 - height) / 2);
  return {
    position: "relative",
    "&::after": { content: '""', position: "absolute", left: 0, right: 0, top: -extra, bottom: -extra },
  } as const;
}
