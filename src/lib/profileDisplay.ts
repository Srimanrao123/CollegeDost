export type ProfileHandleSource = {
  id?: string | null;
  username?: string | null;
  full_name?: string | null;
};

const DEFAULT_HANDLE_FALLBACK = "user";
const DEFAULT_DISPLAY_FALLBACK = "User";
const DEFAULT_INITIAL_FALLBACK = "U";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function deriveProfileHandle(
  source?: ProfileHandleSource | null,
  fallback: string = DEFAULT_HANDLE_FALLBACK
): string {
  if (!source) {
    return fallback;
  }

  const existing = source.username?.trim();
  if (existing) {
    return existing;
  }

  const name = source.full_name?.trim();
  if (name) {
    const slug = slugify(name);
    if (slug) {
      return slug;
    }
  }

  if (source.id) {
    return `${fallback}-${source.id.replace(/[^a-z0-9]/gi, "").slice(0, 6) || "anon"}`.toLowerCase();
  }

  return fallback;
}

export function deriveProfileDisplayName(
  source?: ProfileHandleSource | null,
  fallback: string = DEFAULT_DISPLAY_FALLBACK
): string {
  const name = source?.full_name?.trim();
  if (name) {
    return name;
  }

  const handle = deriveProfileHandle(source, fallback.toLowerCase());
  return handle || fallback;
}

export function deriveProfileInitial(
  source?: ProfileHandleSource | null,
  fallback: string = DEFAULT_INITIAL_FALLBACK
): string {
  const name = source?.full_name?.trim();
  if (name) {
    return name.charAt(0).toUpperCase();
  }

  const handle = deriveProfileHandle(source, fallback).trim();
  if (handle) {
    return handle.charAt(0).toUpperCase();
  }

  return fallback;
}

