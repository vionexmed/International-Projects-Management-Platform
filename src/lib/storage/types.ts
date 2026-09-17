export type StoredObject = {
  body: Buffer;
  contentType: string;
};

/**
 * Minimal contract every storage provider must satisfy. Files are addressed
 * by an opaque key that is only ever resolved server-side, so switching
 * provider never changes anything above this interface.
 */
export type StoredMetadata = {
  size: number;
  contentType: string;
};

export interface StorageDriver {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;

  /**
   * A short-lived URL the browser may PUT one object to, or `null` when the
   * driver cannot issue one.
   *
   * This exists because the file never fits through the application. Every
   * deployment platform caps the body of a request to a serverless function —
   * Vercel rejects anything over about 4.5 MB at the edge, before our code
   * runs — while the product accepts documents up to 25 MB. No configuration
   * bridges that: the bytes have to go somewhere else.
   *
   * It is not a hole in the download rule. This grants **write** access to one
   * key that the server chose, for a few minutes, and reveals nothing: the key
   * is not guessable, the URL cannot list or read the bucket, and every
   * *download* still goes through `/api/files/[versionId]` with the session
   * revalidated and the supplier scope reapplied.
   */
  presignPut(key: string, contentType: string, expiresInSeconds: number): Promise<string | null>;

  /** Size and type of a stored object, or `null` when it is not there. */
  head(key: string): Promise<StoredMetadata | null>;

  /**
   * The object as a stream, for sending to a browser without holding it in
   * memory first.
   *
   * `get` buffers, which is right for the few places that need the bytes
   * themselves and wrong for a download: a 50 MB document would be allocated
   * whole inside the function, and the person waits for the last byte to
   * arrive at the server before the first one reaches them.
   */
  getStream(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string }>;
}
