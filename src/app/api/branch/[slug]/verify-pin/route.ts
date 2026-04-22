import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
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
  { params }: { params: { slug: string } }
) {
  const { pin } = await request.json();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("branches")
    .select("id, name, slug, pin_hash, is_active")
    .eq("slug", params.slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "الفرع غير موجود" }, { status: 404 });
  }

  const branch = data as unknown as BranchRow;

  if (!branch.is_active) {
    return NextResponse.json({ error: "هذا الفرع غير نشط" }, { status: 403 });
  }

  const valid = await bcrypt.compare(String(pin), branch.pin_hash);

  if (!valid) {
    return NextResponse.json({ error: "الرمز غير صحيح" }, { status: 401 });
  }

  return NextResponse.json({
    branch: { id: branch.id, name: branch.name, slug: branch.slug },
  });
}
