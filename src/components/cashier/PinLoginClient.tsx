"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  branch: Branch;
}

export default function PinLoginClient({ branch }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  function handleDigit(digit: string) {
    if (pin.length >= 4 || loading) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError("");

    if (newPin.length === 4) {
      submitPin(newPin);
    }
  }

  function handleDelete() {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
    setError("");
  }

  async function submitPin(pinValue: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/branch/${branch.slug}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "الرمز غير صحيح");
        setPin("");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        // Store session in sessionStorage
        sessionStorage.setItem(
          "cashier_session",
          JSON.stringify({
            branchId: branch.id,
            branchName: branch.name,
            branchSlug: branch.slug,
            loginAt: new Date().toISOString(),
          })
        );
        router.push(`/branch/${branch.slug}/home`);
      }
    } catch {
      setError("حدث خطأ، حاول مجدداً");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-green animate-pulse" />
          <span className="text-muted text-sm">مراعي الشمال · الإقفال اليومي</span>
        </div>
        <h1 className="text-cream text-4xl font-bold mb-1">{branch.name}</h1>
        <p className="text-muted text-sm">{today}</p>
      </div>

      {/* PIN Card */}
      <div
        className={`w-full max-w-sm bg-card rounded-2xl p-8 border border-line transition-all ${
          shake ? "animate-shake" : ""
        }`}
      >
        <p className="text-center text-muted text-sm mb-6">أدخل رمز الكاشير (4 أرقام)</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-8 ltr-num" dir="ltr">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > i
                  ? "bg-green border-green scale-110"
                  : "bg-transparent border-line"
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-red text-sm mb-4 font-medium">{error}</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3" dir="ltr">
          {digits.map((digit, i) => {
            if (digit === "") return <div key={i} />;

            const isDelete = digit === "⌫";
            return (
              <button
                key={i}
                onClick={() => (isDelete ? handleDelete() : handleDigit(digit))}
                disabled={loading}
                className={`
                  h-16 rounded-xl text-2xl font-bold transition-all duration-150 active:scale-95
                  ${isDelete
                    ? "text-muted hover:text-cream hover:bg-card-hi"
                    : "bg-card-hi text-cream hover:bg-green/20 hover:text-green border border-line"
                  }
                  ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {loading && digit !== "⌫" ? (
                  <span className="flex items-center justify-center">
                    <span className="w-5 h-5 border-2 border-green border-t-transparent rounded-full animate-spin" />
                  </span>
                ) : (
                  digit
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
