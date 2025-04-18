import { NextResponse } from "next/server";

export const POST = async () => {
  console.log("🧪 /api/holograph/test-post hit");
  return NextResponse.json({ message: "✅ POST working" });
};

