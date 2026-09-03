"use client";

import { useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AUDIO_ACCEPT,
  AUDIO_BUCKET,
  COVER_ACCEPT,
  COVER_BUCKET,
  validateFile,
} from "@/lib/upload";

/**
 * Envia o arquivo do navegador direto para o Storage e guarda a URL pública
 * num campo escondido, que é o que a server action grava. Passar o binário por
 * server action faria o arquivo trafegar pelo servidor do Next sem ganho.
 */
export function UploadField({
  name,
  kind,
  label,
  initial,
}: {
  name: string;
  kind: "audio" | "cover";
  label: string;
  initial?: string | null;
}) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const bucket = kind === "audio" ? AUDIO_BUCKET : COVER_BUCKET;

  async function handle(file: File | undefined) {
    if (!file) return;

    setBusy(true);
    setError(null);

    const checked = await validateFile(file, kind);
    if ("error" in checked) {
      setError(checked.error);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // Nome único: manter o original causaria colisão entre batalhas.
    const path = `${crypto.randomUUID()}.${checked.extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: "31536000", upsert: false });

    if (uploadError) {
      setError(`Falha ao enviar: ${uploadError.message}`);
      setBusy(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    setUrl(publicUrl);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <span className="eyebrow block">{label}</span>
      <input type="hidden" name={name} value={url} />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={kind === "audio" ? AUDIO_ACCEPT : COVER_ACCEPT}
          disabled={busy}
          aria-label={label}
          onChange={(event) => handle(event.target.files?.[0])}
          className="w-full text-xs text-muted file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-line-strong file:bg-surface-2 file:px-3 file:py-2 file:text-[0.65rem] file:uppercase file:tracking-[0.14em] file:text-text hover:file:border-accent"
        />
      </div>

      <p role="status" className="mt-2 text-xs text-muted-dim">
        {busy
          ? "Enviando…"
          : url
            ? kind === "audio"
              ? "Áudio enviado."
              : "Capa enviada."
            : "Nenhum arquivo enviado."}
      </p>

      {url && kind === "audio" && (
        <audio src={url} controls preload="none" className="mt-2 h-8 w-full" />
      )}

      {url && kind === "cover" && (
        // Prévia no painel: `img` simples porque a URL vem do Storage e o
        // componente de imagem do Next não acrescenta nada aqui.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Prévia da capa" className="mt-2 h-20 w-20 rounded-sm object-cover" />
      )}

      {url && (
        <button
          type="button"
          onClick={() => setUrl("")}
          className="mt-2 text-[0.62rem] uppercase tracking-[0.16em] text-muted transition-colors hover:text-danger"
        >
          Remover
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
