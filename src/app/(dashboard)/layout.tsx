import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MainNav } from "@/components/MainNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
