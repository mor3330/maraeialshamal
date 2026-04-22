import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { currentPin, newPin } = await request.json();
  const ADMIN_PIN = process.env.ADMIN_PIN ?? "123456";

  if (!currentPin || currentPin !== ADMIN_PIN) {
    return NextResponse.json({ error: "الرمز الحالي غير صحيح" }, { status: 401 });
  }
  if (!newPin || newPin.length < 4) {
    return NextResponse.json({ error: "الرمز الجديد يجب أن يكون 4 أرقام على الأقل" }, { status: 400 });
  }

  // Note: In production, update ADMIN_PIN in env. For now we return instructions.
  // The user must update ADMIN_PIN in .env.local manually, or integrate a DB-stored PIN.
  return NextResponse.json({ ok: true, newPin });
}
