import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { apiKeySchema } from "@/lib/validators";
import type { ApiKeyEntry, AppConfig, KeyStore } from "@/types";

const DEFAULT_KEY_STORE: KeyStore = { keys: [] };
const DEFAULT_CONFIG: AppConfig = {
  selectedKeyId: "",
  maxConcurrency: 5,
  retryCount: 2,
  saveDirectory: "public/generated",
  autoSaveBase64: true,
};

async function loadKeys(): Promise<KeyStore> {
  return readJsonFile<KeyStore>("keys.json", DEFAULT_KEY_STORE);
}

async function saveKeys(store: KeyStore) {
  await writeJsonFile("keys.json", store);
}

export async function GET() {
  const store = await loadKeys();
  return NextResponse.json(store);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = apiKeySchema.parse(body);
    const store = await loadKeys();
    const now = new Date().toISOString();

    const entry: ApiKeyEntry = {
      id: crypto.randomUUID(),
      name: parsed.name,
      platform: parsed.platform,
      apiKey: parsed.apiKey,
      createdAt: now,
      lastUsed: parsed.lastUsed,
    };

    store.keys.push(entry);
    await saveKeys(store);

    const config = await readJsonFile<AppConfig>("config.json", DEFAULT_CONFIG);
    if (!config.selectedKeyId) {
      config.selectedKeyId = entry.id;
      await writeJsonFile("config.json", config);
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "添加密钥失败" },
      { status: 400 },
    );
  }
}
