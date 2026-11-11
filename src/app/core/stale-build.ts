import type { NavigationError } from '@angular/router';

const KEY = 'vortomi-stale-reload';
/** Two reloads closer than this would be a loop (the new build fails too): then the error shows. */
const MIN_GAP_MS = 30_000;

/** The browser could not load a piece of the panel: the server already has a newer build. */
function isStaleBuild(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported/i.test(message);
}

/**
 * A tab left open across a deploy asks for files of the previous build, which no longer exist:
 * the screen would not open. The page is loaded again instead, once, onto the new build.
 */
export function reloadOnStaleBuild(navigation: NavigationError): void {
  if (!isStaleBuild(navigation.error)) return;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload; at worst it happens again on the next stale screen.
  }
  location.assign(navigation.url);
}
