import PinLoginClient from "@/components/cashier/PinLoginClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type BranchRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

async function getBranch(slug: string): Promise<BranchRow | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (
      !url || url.includes("placeholder") || url.includes("your_") ||
      !key || key.includes("placeholder") || key.includes("your_")
    ) {
      return null;
    }

    const res = await fetch(
      `${url}/rest/v1/branches?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug,is_active&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error("[getBranch] Supabase error:", res.status);
      return null;
    }

    const data: BranchRow[] = await res.json();
    return data.length > 0 ? data[0] : null;

  } catch (err) {
    console.error("[getBranch] fetch failed:", err);
    return null;
  }
}

export default async function BranchLoginPage({ params }: PageProps) {
  // ✅ Next.js 15+ : params is async
  const { slug } = await params;
  const branch = await getBranch(slug);

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
