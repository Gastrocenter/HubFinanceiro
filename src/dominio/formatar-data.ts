/** "2026-10-05" → "05/10/2026"; sem data, "—". */
export const formatarData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
