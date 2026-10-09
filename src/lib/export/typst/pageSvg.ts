// The renderer stacks every page in one tall SVG and draws only those inside the
// window it is given. Pointing the root's viewBox at that window leaves one page.

const ROOT_SIZE = /(<svg\b[^>]*?)\sviewBox="[^"]*"\s+width="[^"]*"\s+height="[^"]*"/;

// Next to the glyphs the renderer puts each line again as HTML text, for selecting
// with the mouse. Only the full render ships the CSS that hides it — in a window
// it shows as a second copy of the text. The preview needs no selection.
const SELECTION_LAYER = /<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/g;

/** One page of the renderer's SVG: the page at `top`, `width` × `height` points. */
export function pageSvg(svg: string, top: number, width: number, height: number): string {
  if (!ROOT_SIZE.test(svg)) throw new Error("unexpected SVG from the renderer");
  const n = (value: number) => Number(value.toFixed(3));
  return svg
    .replace(SELECTION_LAYER, "")
    .replace(ROOT_SIZE, `$1 viewBox="0 ${n(top)} ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}"`);
}

