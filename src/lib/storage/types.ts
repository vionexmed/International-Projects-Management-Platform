export type StoredObject = {
  body: Buffer;
  contentType: string;
};

/**
 * Minimal contract every storage provider must satisfy. Files are addressed
 * by an opaque key that is only ever resolved server-side, so switching
 * provider never changes anything above this interface.
 */
export interface StorageDriver {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}
