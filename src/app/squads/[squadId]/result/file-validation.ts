export const RESULT_BUCKET = "mission-result-certificates";
export const MAX_FILE_BYTES = 5_000_000;

type FileKind = { contentType: string; extension: string };

export async function validateEvidence(file: File): Promise<FileKind | null> {
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return null;

  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdf = bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
    bytes[3] === 0x46 && bytes[4] === 0x2d;
  const isPng = bytes.length === 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  const isJpeg = bytes.length >= 3 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (isPdf && file.type === "application/pdf") {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (isPng && file.type === "image/png") {
    return { contentType: "image/png", extension: "png" };
  }
  if (isJpeg && file.type === "image/jpeg") {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  return null;
}
