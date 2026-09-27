import { normalizeAuthNext } from "./oauth";

function errorPath(path: "/login" | "/me", message: string, next?: string | null) {
  const params = new URLSearchParams({ error: message.slice(0, 180), next: normalizeAuthNext(next) });
  return path + "?" + params.toString();
}

// Retain the original task when a user cancels OAuth or corrects a profile error.
export function loginErrorPath(message: string, next?: string | null) {
  return errorPath("/login", message, next);
}

export function profileErrorPath(message: string, next?: string | null) {
  return errorPath("/me", message, next);
}
