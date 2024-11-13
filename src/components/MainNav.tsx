"use client";

import { signOut } from "@/auth";
import Link from "next/link";

export function MainNav() {
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold">
              Budget Tracker
            </Link>
            <Link
              href="/budget"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Budget
            </Link>
            <Link
              href="/reports"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Reports
            </Link>
          </div>

          <button
            onClick={() => signOut()}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
