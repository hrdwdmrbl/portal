import { Storage, StorageListOptions, StorageListResult, StoragePutOptions } from "./types";

interface MemoryItem {
  value: string | ReadableStream | ArrayBuffer;
  metadata?: any;
  expiration?: number;
}

export class MemoryStorage implements Storage {
  private store = new Map<string, MemoryItem>();

  constructor() {
    // Optional: Periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiration && item.expiration < now) {
        this.store.delete(key);
      }
    }
  }

  private isExpired(item: MemoryItem): boolean {
    if (item.expiration && item.expiration < Date.now()) {
      return true;
    }
    return false;
  }

  async get<T = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  async get(key: string): Promise<string | null>;
  async get(key: string, type: "text" | "json" | "arrayBuffer" | "stream" = "text"): Promise<any> {
    const item = this.store.get(key);

    if (!item) return null;
    if (this.isExpired(item)) {
      this.store.delete(key);
      return null;
    }

    const val = item.value;

    if (type === "json") {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return null; // Should not happen if put correctly
    }

    // Default text/string return
    return val;
  }

  async put<Meta = unknown>(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: StoragePutOptions<Meta>
  ): Promise<void> {
    let expiration: number | undefined;

    if (options?.expiration) {
      expiration = options.expiration * 1000; // Convert sec to ms if it is timestamp?
      // KV expiration is absolute seconds since epoch. JS Date.now() is ms.
      // Wait, KV expiration is unix timestamp in seconds.
      // So * 1000 is correct for comparison with Date.now()
    } else if (options?.expirationTtl) {
      expiration = Date.now() + options.expirationTtl * 1000;
    }

    this.store.set(key, {
      value,
      metadata: options?.metadata,
      expiration,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list<Meta = unknown>(options?: StorageListOptions): Promise<StorageListResult<Meta>> {
    const prefix = options?.prefix || "";
    const limit = options?.limit || 1000;
    const keys: { name: string; metadata?: Meta }[] = [];

    const now = Date.now();

    for (const [key, item] of this.store.entries()) {
      if (this.isExpired(item)) {
        this.store.delete(key);
        continue;
      }

      if (key.startsWith(prefix)) {
        keys.push({
          name: key,
          metadata: item.metadata as Meta,
        });
      }
    }

    // Sort to be deterministic (optional but good for consistency)
    keys.sort((a, b) => a.name.localeCompare(b.name));

    // Handle limit
    const resultKeys = keys.slice(0, limit);
    const list_complete = keys.length <= limit;

    // Cursor support is minimal here (not implementing full pagination for memory store unless needed)

    return {
      keys: resultKeys,
      list_complete,
      cursor: list_complete ? undefined : "dummy-cursor",
    };
  }
}
