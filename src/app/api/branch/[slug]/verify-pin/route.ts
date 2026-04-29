import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

type BranchRow = {
  id: string;
  name: string;
  slug: string;
  pin_hash: string;
  is_active: boolean;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { pin } = await request.json();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) {
    return NextResponse.json({ error: "الخادم غير مُعدّ" }, { status: 500 });
  }

  const res = await fetch(
    `${url}/rest/v1/branches?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug,pin_hash,is_active&limit=1`,
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
    return NextResponse.json({ error: "الفرع غير موجود" }, { status: 404 });
  }

  const rows: BranchRow[] = await res.json();
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "الفرع غير موجود" }, { status: 404 });
  }

  const branch = rows[0];

  if (!branch.is_active) {
    return NextResponse.json({ error: "هذا الفرع غير نشط" }, { status: 403 });
  }

  if (!branch.pin_hash) {
    return NextResponse.json({ error: "لم يتم ضبط رمز الفرع" }, { status: 500 });
  }

  const valid = await bcrypt.compare(String(pin), branch.pin_hash);

  if (!valid) {
    return NextResponse.json({ error: "الرمز غير صحيح" }, { status: 401 });
  }

  return NextResponse.json({
    branch: { id: branch.id, name: branch.name, slug: branch.slug },
  });
}
