// /src/app/_components/holograph/TransferOwnershipModal.tsx

"use client";

import React from "react";
import { debugLog } from "@/utils/debug";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface TransferOwnershipModalProps {
  principals: User[];
  ownerId: string;
  onClose: () => void;
  onTransfer: (newOwnerId: string) => void;
}

export default function TransferOwnershipModal({
  principals,
  ownerId,
  onClose,
  onTransfer,
}: TransferOwnershipModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Transfer Ownership</h2>
        <ul className="space-y-4 max-h-96 overflow-y-auto">
          {principals.map((user) => (
            <li
              key={user.id}
              className="flex justify-between items-center border-b pb-2"
            >
              <span className="text-gray-800">
                {user.firstName} {user.lastName} ({user.email})
                {user.id === ownerId && (
                  <span className="text-blue-600 ml-2 font-medium">
                    (Owner)
                  </span>
                )}
              </span>
              {user.id !== ownerId && (
                <button
                  className="text-purple-600 hover:text-purple-800"
                  onClick={() => onTransfer(user.id)}
                >
                  Set as Owner
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          className="mt-6 text-gray-600 hover:text-gray-800"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
