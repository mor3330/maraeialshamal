import AdminPinGuard from "@/components/admin/AdminPinGuard";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPinGuard>
      <div className="flex min-h-screen bg-bg">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AdminPinGuard>
  );
}
