import { NextResponse } from "next/server";

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

function findKeyIndex(store: KeyStore, id: string) {
  return store.keys.findIndex((key) => key.id === id);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = apiKeySchema.parse(body);

    const store = await readJsonFile<KeyStore>("keys.json", DEFAULT_KEY_STORE);
    const idx = findKeyIndex(store, id);
    if (idx === -1) {
      return NextResponse.json({ message: "密钥不存在" }, { status: 404 });
    }

    const existing = store.keys[idx];
    const updated: ApiKeyEntry = {
      ...existing,
      name: parsed.name,
      platform: parsed.platform,
      apiKey: parsed.apiKey,
      lastUsed: parsed.lastUsed ?? existing.lastUsed,
    };

    store.keys[idx] = updated;
    await writeJsonFile("keys.json", store);

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新密钥失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = await readJsonFile<KeyStore>("keys.json", DEFAULT_KEY_STORE);
  const idx = store.keys.findIndex((key) => key.id === id);
  if (idx === -1) {
    return NextResponse.json({ message: "密钥不存在" }, { status: 404 });
  }

  const [removed] = store.keys.splice(idx, 1);
  await writeJsonFile("keys.json", store);

  const config = await readJsonFile<AppConfig>("config.json", DEFAULT_CONFIG);
  if (config.selectedKeyId === removed.id) {
    config.selectedKeyId = store.keys[0]?.id ?? "";
    await writeJsonFile("config.json", config);
  }

  return NextResponse.json({ success: true });
}
