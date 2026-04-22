import PinLoginClient from "@/components/cashier/PinLoginClient";

export const dynamic = "force-dynamic";

// Slug → display name fallback (used when Supabase is not configured)
const BRANCH_NAMES: Record<string, string> = {
  olaya: "فرع العليا",
  nakheel: "فرع النخيل",
  malaz: "فرع الملز",
  rawdah: "فرع الروضة",
  suwaydi: "فرع السويدي",
};

interface PageProps {
  params: { slug: string };
}

type BranchRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

async function getBranch(slug: string): Promise<BranchRow | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // If Supabase is not configured, return a local fallback
    if (!url || url.includes("placeholder") || url.includes("your_") || !key || key.includes("placeholder") || key.includes("your_")) {
      const name = BRANCH_NAMES[slug];
      if (!name) return null;
      return { id: slug, name, slug, is_active: true };
    }

    const { createServiceClient } = await import("@/lib/supabase");
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("branches")
      .select("id, name, slug, is_active")
      .eq("slug", slug)
      .single();

    return (data as unknown as BranchRow) ?? null;
  } catch {
    // Network error or Supabase down → use fallback
    const name = BRANCH_NAMES[slug];
    if (!name) return null;
    return { id: slug, name, slug, is_active: true };
  }
}

export default async function BranchLoginPage({ params }: PageProps) {
  const branch = await getBranch(params.slug);

  if (!branch || !branch.is_active) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl p-8 text-center border border-line max-w-sm w-full">
          <p className="text-red text-lg font-bold mb-2">فرع غير موجود</p>
          <p className="text-muted text-sm">تحقق من الرابط أو تواصل مع الإدارة</p>
        </div>
      </div>
    );
  }

  return <PinLoginClient branch={branch} />;
}
