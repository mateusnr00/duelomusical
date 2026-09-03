/**
 * Validação de arquivo antes do envio.
 *
 * O navegador declara o `type` a partir da extensão, e extensão se renomeia.
 * Por isso o formato é conferido lendo os primeiros bytes do arquivo. Esta é a
 * primeira barreira, não a única: o bucket do Storage também tem lista de MIME
 * e limite de tamanho, e é ele quem recusa um envio forjado fora da interface.
 */

export const AUDIO_MAX_BYTES = 20 * 1024 * 1024;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export const AUDIO_ACCEPT = ".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a";
export const COVER_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export const AUDIO_BUCKET = "music-battle-audio";
export const COVER_BUCKET = "music-battle-covers";

type Kind = "audio" | "cover";

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Formato reconhecido pela assinatura, ou null. */
export function sniff(bytes: Uint8Array, kind: Kind): string | null {
  if (kind === "audio") {
    // MP3 com tag ID3, ou quadro MPEG cru (sync 0xFF seguido de 0xEx/0xFx).
    if (ascii(bytes, 0, 3) === "ID3") return "mp3";
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
    if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "wav";
    // M4A é um contêiner MP4: o box `ftyp` começa no byte 4.
    if (ascii(bytes, 4, 4) === "ftyp") return "m4a";
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (ascii(bytes, 1, 3) === "PNG") return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (ascii(bytes, 4, 4) === "ftyp" && ascii(bytes, 8, 4).startsWith("avif")) return "avif";
  return null;
}

/** Devolve a extensão validada, ou uma mensagem de erro pronta para exibir. */
export async function validateFile(
  file: File,
  kind: Kind,
): Promise<{ extension: string } | { error: string }> {
  const limit = kind === "audio" ? AUDIO_MAX_BYTES : COVER_MAX_BYTES;

  if (file.size === 0) return { error: `"${file.name}" está vazio.` };
  if (file.size > limit) {
    return {
      error: `"${file.name}" passa de ${Math.round(limit / 1024 / 1024)} MB.`,
    };
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format = sniff(header, kind);

  if (!format) {
    return {
      error:
        kind === "audio"
          ? `"${file.name}" não é um MP3, WAV ou M4A válido.`
          : `"${file.name}" não é uma imagem JPEG, PNG, WebP ou AVIF válida.`,
    };
  }

  return { extension: format === "jpg" ? "jpg" : format };
}
