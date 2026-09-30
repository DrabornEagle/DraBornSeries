/** Bounded-memory Stream uploads, including files over 200 MB. */
export async function uploadTus(url: string, size: number, read: (start: number, end: number) => Promise<ArrayBuffer>,
  onProgress?: (percent: number) => void, request: typeof fetch = fetch) {
  const headers = { "Tus-Resumable": "1.0.0" };
  const offsetAtServer = async () => {
    const response = await request(url, { method: "HEAD", headers });
    const raw = response.headers.get("Upload-Offset"), offset = Number(raw);
    if (!response.ok || raw === null || !Number.isSafeInteger(offset) || offset < 0 || offset > size) throw Error("STREAM_UPLOAD_OFFSET_INVALID");
    return offset;
  };
  let offset = await offsetAtServer(), failures = 0;
  onProgress?.(Math.round(offset / size * 100));
  while (offset < size) {
    const end = Math.min(size, offset + 8 * 1024 * 1024), bytes = await read(offset, end);
    if (bytes.byteLength !== end - offset) throw Error("STREAM_UPLOAD_READ_FAILED");
    try {
      const response = await request(url, { method: "PATCH", headers: { ...headers, "Content-Type": "application/offset+octet-stream", "Upload-Offset": String(offset) }, body: bytes });
      const acknowledged = Number(response.headers.get("Upload-Offset"));
      if (!response.ok || acknowledged !== end) throw Error("STREAM_UPLOAD_FAILED");
      offset = end; failures = 0;
      onProgress?.(Math.round(offset / size * 100));
    } catch (error) {
      if (++failures > 3) throw error;
      // A request may have arrived even if its response was lost. Ask the server
      // before retrying, otherwise a byte range could be appended twice.
      offset = await offsetAtServer();
      onProgress?.(Math.round(offset / size * 100));
    }
  }
}
