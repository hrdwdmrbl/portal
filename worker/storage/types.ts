export interface StorageListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface StorageListResult<Meta = unknown> {
  keys: { name: string; metadata?: Meta }[];
  list_complete: boolean;
  cursor?: string;
}

export interface StoragePutOptions<Meta = unknown> {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Meta;
}

export interface Storage {
  get<T = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  get(key: string): Promise<string | null>;

  put<Meta = unknown>(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: StoragePutOptions<Meta>
  ): Promise<void>;

  delete(key: string): Promise<void>;

  list<Meta = unknown>(options?: StorageListOptions): Promise<StorageListResult<Meta>>;
}
