"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createBattle, updateBattle, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import type { BattleRow } from "@/lib/battle/types";

/** `2026-09-03T18:30:00Z` → `2026-09-03T15:30` no fuso de quem edita. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

export function BattleForm({ battle }: { battle?: BattleRow }) {
  const action = battle ? updateBattle : createBattle;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {battle && <input type="hidden" name="id" value={battle.id} />}

      <Field label="Nome da batalha" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          defaultValue={battle?.name}
          placeholder="Escolha a próxima música"
        />
      </Field>

      <Field
        label="Endereço na URL"
        htmlFor="slug"
        hint={`Deixe em branco para gerar a partir do nome. A página fica em /b/${battle?.slug ?? "endereco"}.`}
      >
        <Input id="slug" name="slug" defaultValue={battle?.slug} placeholder="proxima-musica" />
      </Field>

      <Field label="Descrição (opcional)" htmlFor="description">
        <Textarea id="description" name="description" rows={3} defaultValue={battle?.description} />
      </Field>

      <Field
        label="Quando mostrar o resultado"
        htmlFor="show_results_mode"
        hint="Depois do voto é o padrão: ninguém vê o placar antes de escolher, o que evita influenciar a votação."
      >
        <Select
          id="show_results_mode"
          name="show_results_mode"
          defaultValue={battle?.show_results_mode ?? "AFTER_VOTE"}
        >
          <option value="AFTER_VOTE">Depois do voto</option>
          <option value="AFTER_ROUND">Só quando a rodada encerrar</option>
          <option value="ALWAYS">Sempre</option>
          <option value="HIDDEN">Escondido até o fim da batalha</option>
        </Select>
      </Field>

      <fieldset className="space-y-5 border-t border-line pt-6">
        <legend className="eyebrow">Prazos (opcionais)</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Semifinais abrem" htmlFor="semifinal_starts_at">
            <Input
              id="semifinal_starts_at"
              name="semifinal_starts_at"
              type="datetime-local"
              defaultValue={toLocalInput(battle?.semifinal_starts_at ?? null)}
            />
          </Field>
          <Field label="Semifinais encerram" htmlFor="semifinal_ends_at">
            <Input
              id="semifinal_ends_at"
              name="semifinal_ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(battle?.semifinal_ends_at ?? null)}
            />
          </Field>
          <Field label="Final abre" htmlFor="final_starts_at">
            <Input
              id="final_starts_at"
              name="final_starts_at"
              type="datetime-local"
              defaultValue={toLocalInput(battle?.final_starts_at ?? null)}
            />
          </Field>
          <Field label="Final encerra" htmlFor="final_ends_at">
            <Input
              id="final_ends_at"
              name="final_ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(battle?.final_ends_at ?? null)}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-dim">
          O prazo aparece como contagem regressiva na página e é conferido no servidor a
          cada voto. O encerramento em si continua sendo feito pelo painel.
        </p>
      </fieldset>

      {state && "error" in state && <FormError>{state.error}</FormError>}

      <Submit label={battle ? "Salvar alterações" : "Criar batalha"} />
    </form>
  );
}
