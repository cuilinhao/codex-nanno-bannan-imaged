import type {
  ApiKeyEntry,
  AppConfig,
  KeyStore,
  ReferenceCategory,
  ReferenceImage,
  ReferenceStore,
  StyleCategory,
  StyleEntry,
  StyleStore,
  PromptRecord,
  PromptStore,
} from "@/types";

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function getConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>("/api/config");
}

export async function updateConfig(payload: Partial<AppConfig>): Promise<AppConfig> {
  return apiFetch<AppConfig>("/api/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getKeys(): Promise<KeyStore> {
  return apiFetch<KeyStore>("/api/keys");
}

export async function createKey(payload: {
  name: string;
  platform: ApiKeyEntry["platform"];
  apiKey: string;
}): Promise<ApiKeyEntry> {
  return apiFetch<ApiKeyEntry>("/api/keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateKey(
  id: string,
  payload: {
    name: string;
    platform: ApiKeyEntry["platform"];
    apiKey: string;
    lastUsed?: string;
  },
): Promise<ApiKeyEntry> {
  return apiFetch<ApiKeyEntry>(`/api/keys/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteKey(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/keys/${id}`, {
    method: "DELETE",
  });
}

export async function getStyleStore(): Promise<StyleStore> {
  return apiFetch<StyleStore>("/api/styles");
}

export async function createStyle(payload: {
  name: string;
  categoryId: string;
  content: string;
}): Promise<StyleEntry> {
  return apiFetch<StyleEntry>("/api/styles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStyle(
  id: string,
  payload: {
    name: string;
    categoryId: string;
    content: string;
    usageCount?: number;
  },
): Promise<StyleEntry> {
  return apiFetch<StyleEntry>(`/api/styles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteStyle(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/styles/${id}`, {
    method: "DELETE",
  });
}

export async function createStyleCategory(payload: {
  name: string;
  description?: string;
}): Promise<StyleCategory> {
  return apiFetch<StyleCategory>("/api/styles/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStyleCategory(
  id: string,
  payload: {
    name: string;
    description?: string;
  },
): Promise<StyleCategory> {
  return apiFetch<StyleCategory>(`/api/styles/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteStyleCategory(
  id: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/styles/categories/${id}`, {
    method: "DELETE",
  });
}

export async function getReferenceStore(): Promise<ReferenceStore> {
  return apiFetch<ReferenceStore>("/api/references");
}

export async function createReferenceCategory(payload: {
  name: string;
}): Promise<ReferenceCategory> {
  return apiFetch<ReferenceCategory>("/api/references/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReferenceCategory(
  id: string,
  payload: {
    name: string;
  },
): Promise<ReferenceCategory> {
  return apiFetch<ReferenceCategory>(`/api/references/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteReferenceCategory(
  id: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/references/categories/${id}`, {
    method: "DELETE",
  });
}

export async function deleteReferenceImage(
  categoryId: string,
  imageId: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/api/references/categories/${categoryId}/images/${imageId}`,
    {
      method: "DELETE",
    },
  );
}

export async function uploadReferenceImage(
  categoryId: string,
  payload: {
    name: string;
    sourceType: "upload" | "url";
    description?: string;
    file?: File;
    url?: string;
  },
): Promise<ReferenceImage> {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("sourceType", payload.sourceType);
  if (payload.description) {
    formData.append("description", payload.description);
  }
  if (payload.sourceType === "upload" && payload.file) {
    formData.append("file", payload.file);
  }
  if (payload.sourceType === "url" && payload.url) {
    formData.append("url", payload.url);
  }

  const response = await fetch(
    `/api/references/categories/${categoryId}/images`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await response.json()) as ReferenceImage;
}

export async function getPromptStore(): Promise<PromptStore> {
  return apiFetch<PromptStore>("/api/prompts");
}

export async function createPrompt(payload: {
  number?: string;
  prompt: string;
}): Promise<PromptRecord> {
  return apiFetch<PromptRecord>("/api/prompts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePrompt(
  id: string,
  payload: Partial<PromptRecord>,
): Promise<PromptRecord> {
  return apiFetch<PromptRecord>(`/api/prompts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletePrompt(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/prompts/${id}`, {
    method: "DELETE",
  });
}

export async function importPrompts(payload: {
  items: Array<{ number?: string; prompt: string }>;
}): Promise<PromptStore> {
  return apiFetch<PromptStore>("/api/prompts/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateImage(payload: {
  promptId: string;
  prompt: string;
  finalPrompt: string;
  number?: string;
  styleId?: string;
  referenceIds?: string[];
  retryCount?: number;
  keyId?: string;
}): Promise<{ success: boolean; imageUrl?: string; record?: PromptRecord; base64?: string }> {
  return apiFetch<{ success: boolean; imageUrl?: string; record?: PromptRecord; base64?: string }>(
    "/api/generate",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
