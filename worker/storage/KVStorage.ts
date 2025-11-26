import { Storage, StorageListOptions, StorageListResult, StoragePutOptions } from "./types";

export class KVStorage implements Storage {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async get<T = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  async get(key: string): Promise<string | null>;
  async get(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<any> {
    if (type) {
      return this.kv.get(key, type as any);
    }
    return this.kv.get(key);
  }

  async put<Meta = unknown>(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: StoragePutOptions<Meta>
  ): Promise<void> {
    await this.kv.put(key, value, options);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async list<Meta = unknown>(options?: StorageListOptions): Promise<StorageListResult<Meta>> {
    return this.kv.list<Meta>(options);
  }
}
