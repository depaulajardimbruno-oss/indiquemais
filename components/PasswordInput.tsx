"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const input =
  "w-full rounded-brand border border-line bg-white px-3 py-3 pr-11 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-line";

export function PasswordInput({ label, value, onChange, autoComplete, hint }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: "current-password" | "new-password"; hint?: string;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="relative mt-1">
        <input id={id} required type={show ? "text" : "password"} autoComplete={autoComplete} className={input} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink">
          {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
