// A one-time message carried from one screen to the next, such as "Saved." after the editor
// returns to the plan (#67: a line that stays until the next action, not a toast).

let message: string | null = null;

export function setFlash(text: string) {
  message = text;
}

/** The message, once: reading it clears it. */
export function takeFlash(): string | null {
  const text = message;
  message = null;
  return text;
}
