export type Post = {
  id: string;
  title: string | null;
  content?: string | null;
  body?: string | null;
  image_url?: string | null;
  created_at: string;
};

export type Cursor = {
  createdAt: string;
  id: string;
};

const toBase64 = (value: string) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf-8").toString("base64");
  }
  if (typeof btoa !== "undefined") {
    return btoa(value);
  }
  throw new Error("No base64 encoder available");
};

const fromBase64 = (value: string) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf-8");
  }
  if (typeof atob !== "undefined") {
    return atob(value);
  }
  throw new Error("No base64 decoder available");
};

export const encodeCursor = (cursor: Cursor) => toBase64(JSON.stringify(cursor));

export const decodeCursor = (value: string): Cursor => JSON.parse(fromBase64(value));

export const orForNext = (cursor: Cursor) => {
  const { createdAt, id } = cursor;
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
};
