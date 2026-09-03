"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal sobre o `<dialog>` nativo: o navegador já entrega foco preso dentro do
 * diálogo, fechamento pelo Esc e semântica de modal para leitor de tela —
 * reimplementar isso à mão é onde a acessibilidade costuma se perder.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        // Clique no backdrop (o próprio <dialog>, fora do conteúdo) fecha.
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface p-0 text-text backdrop:bg-void/80 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">{children}</div>
    </dialog>
  );
}
