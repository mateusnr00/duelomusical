import Image from "next/image";

/**
 * Capa da música. Sem capa cadastrada, desenha uma nota sobre a superfície do
 * tema — nunca um `<img>` apontando para lugar nenhum, que renderiza o ícone
 * de imagem quebrada do navegador.
 */
export function Cover({
  src,
  alt,
  className = "",
  sizes = "(min-width: 1024px) 20rem, 100vw",
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-surface-2 ${className}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-muted-dim" fill="currentColor">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}
