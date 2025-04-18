// /src/app/dashboard/user-profile/page.tsx

import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import UserProfileForm from "@/app/_components/UserProfileForm";
import { debugLog } from "@/utils/debug";


export default async function ProfilePage() {
  const session = await getServerSession(await getAuthOptions());

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Your Profile</h1>
      <UserProfileForm user={user} />
    </div>
  );
}
