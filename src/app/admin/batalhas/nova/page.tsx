import Link from "next/link";
import { BattleForm } from "@/components/admin/battle-form";

export default function NovaBatalhaPage() {
  return (
    <>
      <Link href="/admin/batalhas" className="eyebrow transition-colors hover:text-text">
        ← Batalhas
      </Link>
      <h1 className="mt-6 text-3xl leading-tight font-medium">Nova batalha</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Depois de criar, você cadastra as quatro músicas e publica as semifinais.
      </p>
      <div className="mt-10">
        <BattleForm />
      </div>
    </>
  );
}
