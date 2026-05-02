"use client";

import { useEffect, useState } from "react";
import { getAdminSession, saveAdminSession } from "@/lib/admin-store";

export default function AdminPinGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const session = getAdminSession();
    if (session?.loggedIn) setAuthed(true);
    setChecked(true);
  }, []);

  function handleKey(digit: string) {
    if (loading) return;
    if (digit === "del") {
      setPin((p) => p.slice(0, -1));
      setError("");
      return;
    }
    if (pin.length >= 6) return; // لا يقبل أكثر من 6 أرقام
    const next = pin + digit;
    setPin(next);
    if (next.length === 6) submit(next);
  }

  async function submit(code: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        saveAdminSession({
          role: json.role ?? "superadmin",
          name: json.name,
          userId: json.userId,
          permissions: json.permissions,
          allowed_branches: json.allowed_branches,
        });
        setAuthed(true);
      } else {
        setError("رمز الدخول غير صحيح");
        setShake(true);
        setTimeout(() => { setShake(false); setPin(""); }, 600);
      }
    } catch {
      setError("خطأ في الاتصال");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  if (!checked) return null;
  if (authed) return <>{children}</>;

  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="absolute inset-x-0 top-0 h-[300px] bg-[radial-gradient(circle_at_top,_rgba(63,166,106,0.12),_transparent_60%)] pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1 text-xs text-green mb-4">
            <span className="w-2 h-2 rounded-full bg-green" />
            مراعي الشمال
          </div>
          <h1 className="text-3xl font-black text-cream">لوحة الإدارة</h1>
          <p className="text-muted text-sm mt-2">أدخل رمز الدخول من 6 أرقام</p>
        </div>

        <div className="bg-card border border-line rounded-3xl p-6">
          {/* PIN dots */}
          <div className={`flex justify-center gap-3 mb-4 ${shake ? "animate-shake" : ""}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < pin.length ? "bg-green border-green" : "border-muted/40"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-red text-center text-sm mb-4">{error}</p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {keys.map((k, idx) => {
              if (k === "") return <div key={idx} />;
              return (
                <button
                  key={idx}
                  onClick={() => handleKey(k)}
                  disabled={loading}
                  className={`rounded-2xl py-4 font-bold text-xl transition-all active:scale-95 disabled:opacity-50 ${
                    k === "del"
                      ? "bg-card-hi border border-line text-muted text-lg"
                      : "bg-card-hi border border-line text-cream hover:border-green/40 hover:bg-green/5"
                  }`}
                >
                  {k === "del" ? "⌫" : k}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
