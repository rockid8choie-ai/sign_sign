"use client";

import { useState } from "react";

export function CopyButton({ text, label = "링크 복사" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="btn-ghost px-3 py-1.5 text-xs"
    >
      {done ? "복사됨 ✓" : label}
    </button>
  );
}
