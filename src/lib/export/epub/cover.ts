import type { Layout } from "../typst/templates/print.typ";

// The e-book cover (P8): the typographic title page from P5, laid out on a page in
// the 1.6 : 1 shape stores recommend, then drawn as a 1600 × 2560 PNG.

export const EBOOK_COVER_LAYOUT: Layout = {
  page: "width: 5in, height: 8in",
  // Not bound: the same margin on both sides.
  margin: ["0.6in", "0.6in", "0.7in", "0.7in"],
  size: "11pt",
};

export const EBOOK_COVER_SIZE = { width: 1600, height: 2560 } as const;

/**
 * One page of SVG (from the preview) → PNG, in the browser. The SVG carries its
 * glyphs as paths and no foreignObject (pageSvg drops it), so the canvas stays clean.
 */
export async function svgToPng(svg: string, { width, height } = EBOOK_COVER_SIZE): Promise<Uint8Array> {
  // Full size before drawing: a browser may rasterize an SVG image at its own size.
  const sized = svg.replace(/(<svg\b[^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, `$1 width="${width}" height="${height}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("cover SVG did not load"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("cover PNG failed");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
