// /src/app/_components/UserProfileForm.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonIcons } from "@/config/icons"; // ✅ Import standardized icons
import { debugLog } from "@/utils/debug";

export default function UserProfileForm({ user }: { user: { id: string; email: string; firstName: string; lastName: string } }) {
  const router = useRouter();

  // Profile form state
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [profileMessage, setProfileMessage] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage("");

    const res = await fetch("/api/user/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email }),
    });

    if (res.ok) {
      setProfileMessage("Profile updated successfully.");
      router.refresh();
    } else {
      setProfileMessage("Error updating profile.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }

    const res = await fetch("/api/user/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    debugLog("Password Change Result:", res); // ✅ Log the result
    const result = await res.json();

    if (res.ok) {
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else if (result.errors) {
      setPasswordMessage(result.errors.map((e: any) => e.message).join(" "));
    } else {
      setPasswordMessage(result.error || "Error changing password.");
    }
  };

  const EditIcon = buttonIcons.edit;
  const LockIcon = buttonIcons.lock; 

  return (
    <div className="space-y-8">
      <form onSubmit={handleProfileUpdate} className="space-y-4">
        <h2 className="text-xl font-semibold">Update Profile</h2>
        <div>
          <label className="block font-medium">First Name</label>
          <input
            className="w-full border p-2 rounded"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block font-medium">Last Name</label>
          <input
            className="w-full border p-2 rounded"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            className="w-full border p-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary">
          <EditIcon /> Save Changes
        </button>
        {profileMessage && <p className="text-sm mt-2">{profileMessage}</p>}
      </form>

      <form onSubmit={handlePasswordChange} className="space-y-4">
        <h2 className="text-xl font-semibold">Change Password</h2>
        <div>
          <label className="block font-medium">Current Password</label>
          <input
            type="password"
            className="w-full border p-2 rounded"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block font-medium">New Password</label>
          <input
            type="password"
            className="w-full border p-2 rounded"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block font-medium">Confirm New Password</label>
          <input
            type="password"
            className="w-full border p-2 rounded"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary">
          <LockIcon /> Change Password
        </button>
        {passwordMessage && <p className="text-sm mt-2">{passwordMessage}</p>}
      </form>
    </div>
  );
}
