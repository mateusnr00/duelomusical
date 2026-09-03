"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveEntries, type ActionResult } from "@/app/admin/actions";
import { UploadField } from "./upload-field";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import type { Entry } from "@/lib/battle/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Salvar músicas"}
    </Button>
  );
}

/**
 * As quatro músicas num formulário só. A posição (seed) define o chaveamento:
 * 1 contra 2 na semifinal 01, 3 contra 4 na semifinal 02.
 */
export function EntriesForm({
  battleId,
  entries,
  locked,
}: {
  battleId: string;
  entries: Entry[];
  locked: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    saveEntries,
    null,
  );

  const bySeed = new Map(entries.map((entry) => [entry.seed, entry]));

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="battle_id" value={battleId} />

      {locked && (
        <p className="border-l-2 border-accent bg-accent/5 px-4 py-3 text-sm">
          A batalha já foi publicada. Alterar as músicas agora muda o que aparece nos
          confrontos em andamento.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((seed) => {
          const entry = bySeed.get(seed);
          const semifinal = seed <= 2 ? 1 : 2;

          return (
            <fieldset
              key={seed}
              className="space-y-4 rounded-sm border border-line bg-surface p-5"
            >
              <legend className="eyebrow px-1">
                Música {String(seed).padStart(2, "0")} · Semifinal {String(semifinal).padStart(2, "0")}
              </legend>

              <Field label="Nome" htmlFor={`name_${seed}`}>
                <Input
                  id={`name_${seed}`}
                  name={`name_${seed}`}
                  defaultValue={entry?.name}
                  placeholder={`Faixa ${String(seed).padStart(2, "0")}`}
                />
              </Field>

              <Field label="Artista (opcional)" htmlFor={`artist_${seed}`}>
                <Input
                  id={`artist_${seed}`}
                  name={`artist_${seed}`}
                  defaultValue={entry?.artist ?? ""}
                />
              </Field>

              <UploadField
                name={`audio_url_${seed}`}
                kind="audio"
                label="Áudio (MP3, WAV ou M4A · até 20 MB)"
                initial={entry?.audio_url}
              />

              <UploadField
                name={`cover_url_${seed}`}
                kind="cover"
                label="Capa (opcional · até 5 MB)"
                initial={entry?.cover_url}
              />
            </fieldset>
          );
        })}
      </div>

      {state && "error" in state && <FormError>{state.error}</FormError>}

      <Submit />
    </form>
  );
}
