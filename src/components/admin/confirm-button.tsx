"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de envio que pede confirmação antes de agir. Fica em componente
 * próprio porque `useFormStatus` só funciona dentro de um form no cliente.
 */
export function ConfirmButton({
  children,
  pendingLabel,
  question,
  variant = "danger",
}: {
  children: string;
  pendingLabel: string;
  question: string;
  variant?: "danger" | "primary";
}) {
  const { pending } = useFormStatus();

  const tone =
    variant === "danger"
      ? "text-muted hover:text-danger"
      : "bg-accent text-void hover:bg-text px-5 py-3 rounded-sm";

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
      className={`text-[0.68rem] font-medium uppercase tracking-[0.16em] transition-colors disabled:opacity-40 ${tone}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
