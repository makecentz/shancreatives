import "server-only";
import { cookies } from "next/headers";
import { newAccessToken, sha256 } from "./checkout";

const COOKIE = "ss_guest";

/** httpOnly guest token used to prove ownership of guest uploads and carts. */
export async function guestTokenHash(create = false): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return sha256(existing);
  if (!create) return null;
  const { token, hash } = newAccessToken();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return hash;
}
