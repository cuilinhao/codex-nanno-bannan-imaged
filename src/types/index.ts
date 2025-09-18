export type ApiPlatform = "云雾" | "API易" | "apicore";

export interface ApiKeyEntry {
  id: string;
  name: string;
  platform: ApiPlatform;
  apiKey: string;
  createdAt: string;
  lastUsed?: string;
}

export interface KeyStore {
  keys: ApiKeyEntry[];
}

export interface AppConfig {
  selectedKeyId: string;
  maxConcurrency: number;
  retryCount: number;
  saveDirectory: string;
  autoSaveBase64: boolean;
}

export interface StyleCategory {
  id: string;
  name: string;
  description?: string;
}

export interface StyleEntry {
  id: string;
  name: string;
  categoryId: string;
  content: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleStore {
  styles: StyleEntry[];
  categories: StyleCategory[];
}

export interface ReferenceImage {
  id: string;
  name: string;
  description?: string;
  sourceType: "upload" | "url";
  path: string;
  url?: string;
  createdAt: string;
}

export interface ReferenceCategory {
  id: string;
  name: string;
  images: ReferenceImage[];
}

export interface ReferenceStore {
  categories: ReferenceCategory[];
}

export type PromptStatus = "等待中" | "生成中" | "成功" | "失败";

export interface PromptRecord {
  id: string;
  number: string;
  prompt: string;
  status: PromptStatus;
  imageUrl?: string;
  errorMsg?: string;
  createdAt: string;
  updatedAt: string;
  apiPlatform?: ApiPlatform;
}

export interface PromptStore {
  prompts: PromptRecord[];
}
