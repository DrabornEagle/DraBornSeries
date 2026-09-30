/** Only publish downloadable sidecars. Private storage keys need a signed URL. */
export function publicSubtitleTracks(rows: { language: string; label: string; asset_key: string }[]) {
  return rows.flatMap((row) => {
    try {
      const url = new URL(row.asset_key);
      if (url.protocol !== "https:" || url.username || url.password) return [];
      return [{ language: row.language, label: row.label, url: url.href }];
    } catch { return []; }
  });
}
