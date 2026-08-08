/**
 * Row geometry for the gift guides. A plain module (no `server-only`) so the
 * admin's client editor and the server-rendered page agree on it — the rest of
 * the gifting config reads settings and has to stay server-side.
 */

/**
 * Products per row on a wide screen. Six divides evenly into the phone (2) and
 * tablet (3) layouts too, so a full row stays full at every width.
 */
export const GUIDE_ROW = 6;

/**
 * A guide always fills whole rows: a limit is rounded up to the next multiple
 * of `GUIDE_ROW`, so a guide saved when rows were four wide doesn't leave two
 * empty cells, and no setting can produce a ragged row.
 */
export const rowLimit = (limit: number) =>
  Math.max(1, Math.ceil(limit / GUIDE_ROW)) * GUIDE_ROW;
