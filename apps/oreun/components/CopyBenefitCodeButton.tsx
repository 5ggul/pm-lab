"use client";

import { useState } from "react";

export default function CopyBenefitCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="benefit-copy-button" onClick={copy}>
      {copied ? "복사됨 ✓" : "복사하기"}
    </button>
  );
}
