// /src/utils/verifyCsrf.ts
import Tokens from "csrf";
import { cookies } from "next/headers";
import { debugLog } from "./debug";

const tokens = new Tokens();

export async function verifyCsrf(request: Request) {
  const cookieStore = cookies();
  const csrfSecret = cookieStore.get("csrfSecret")?.value;
  const clientToken =
    request.headers.get("x-csrf-token") ||
    (await request.json())?.csrfToken;

  if (!csrfSecret || !clientToken) {
    return false;
  }

  return tokens.verify(csrfSecret, clientToken);
}
