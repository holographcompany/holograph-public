// /src/app/api/debug-session/route.ts
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(await getAuthOptions());
  console.log("🧠 DEBUG SERVER SESSION:", session);
  return Response.json(session);
}
