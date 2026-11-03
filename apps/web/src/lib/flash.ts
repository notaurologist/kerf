// A one-time message carried from one screen to the next, such as "Saved." after the editor
// returns to the plan (#67: a line that stays until the next action, not a toast).

export interface Flash {
  text: string;
  /** A project the last screen moved to the trash, which the next one offers to restore. */
  deleted?: { id: string; name: string };
}

let message: Flash | null = null;

export function setFlash(text: string, deleted?: Flash['deleted']) {
  message = deleted ? { text, deleted } : { text };
}

/** The message, once: reading it clears it. */
export function takeFlash(): Flash | null {
  const flash = message;
  message = null;
  return flash;
}

/** The message's words alone, once, for a screen that offers nothing with it. */
export function takeFlashText(): string | null {
  return takeFlash()?.text ?? null;
}
