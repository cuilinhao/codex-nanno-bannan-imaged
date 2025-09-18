import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { readJsonFile, writeJsonFile } from "@/lib/storage";
import { generateRequestSchema } from "@/lib/validators";
import type {
  ApiKeyEntry,
  AppConfig,
  KeyStore,
  PromptRecord,
  PromptStore,
  ReferenceImage,
  ReferenceStore,
} from "@/types";

const DEFAULT_CONFIG: AppConfig = {
  selectedKeyId: "",
  maxConcurrency: 5,
  retryCount: 2,
  saveDirectory: "public/generated",
  autoSaveBase64: true,
};

const DEFAULT_KEY_STORE: KeyStore = {
  keys: [],
};

const DEFAULT_REFERENCE_STORE: ReferenceStore = {
  categories: [
    {
      id: "default",
      name: "默认参考图",
      images: [],
    },
  ],
};

const DEFAULT_PROMPT_STORE: PromptStore = {
  prompts: [],
};

function getApiUrl(platform: ApiKeyEntry["platform"]) {
  switch (platform) {
    case "apicore":
      return {
        endpoint: "https://api.apicore.ai/v1/chat/completions",
        model: "gemini-2.5-flash-image",
      };
    case "API易":
      return {
        endpoint: "https://vip.apiyi.com/v1/chat/completions",
        model: "gemini-2.5-flash-image-preview",
      };
    default:
      return {
        endpoint: "https://yunwu.ai/v1/chat/completions",
        model: "gemini-2.5-flash-image-preview",
      };
  }
}

async function toBase64DataUrl(image: ReferenceImage): Promise<string | null> {
  if (image.sourceType === "url") {
    return image.path;
  }

  const publicRoot = path.join(process.cwd(), "public");
  const filePath = path.join(publicRoot, image.path.replace(/^\//, ""));
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".gif"
          ? "image/gif"
          : ext === ".webp"
            ? "image/webp"
            : "image/png";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("读取参考图失败", filePath, error);
    return null;
  }
}

function extractContent(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    const parts: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (item && typeof item === "object") {
        const maybeText = (item as { text?: string; type?: string }).text;
        if (maybeText) {
          parts.push(maybeText);
        }
      }
    }
    return parts.join("\n");
  }
  if (typeof raw === "object") {
    const maybeText = (raw as { text?: string }).text;
    if (maybeText) {
      return maybeText;
    }
  }
  return "";
}

function parseImageFromMarkdown(markdown: string) {
  const base64Match = markdown.match(/!\[[^\]]*\]\((data:image\/[a-zA-Z+]+;base64,[^)]+)\)/);
  if (base64Match) {
    return { type: "base64" as const, value: base64Match[1] };
  }

  const downloadMatch = markdown.match(/\[[^\]]*下载[^\]]*\]\((https?:[^)]+)\)/);
  if (downloadMatch) {
    return { type: "url" as const, value: downloadMatch[1] };
  }

  const imageMatch = markdown.match(/!\[[^\]]*\]\((https?:[^)]+)\)/);
  if (imageMatch) {
    return { type: "url" as const, value: imageMatch[1] };
  }

  return null;
}

async function saveBase64Image(
  dataUrl: string,
  config: AppConfig,
  promptId: string,
  number?: string,
) {
  const [header, data] = dataUrl.split(",", 2);
  const buffer = Buffer.from(data, "base64");

  const extMatch = header.match(/data:image\/(\w+);base64/);
  const ext = extMatch ? extMatch[1] : "png";

  const directory = path.isAbsolute(config.saveDirectory)
    ? config.saveDirectory
    : path.join(process.cwd(), config.saveDirectory);
  await fs.mkdir(directory, { recursive: true });

  const safeNumber = number?.replace(/[^a-zA-Z0-9_-]+/g, "-") ?? "";
  const fileName = `${safeNumber ? `${safeNumber}-` : ""}${promptId}-${Date.now()}.${ext}`;
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, buffer);

  const publicRoot = path.join(process.cwd(), "public");
  let publicUrl: string | undefined;
  if (filePath.startsWith(publicRoot)) {
    publicUrl = filePath
      .slice(publicRoot.length)
      .replace(/\\/g, "/");
  }

  return {
    filePath,
    publicUrl,
  };
}

async function updatePromptRecord(
  promptId: string,
  updater: (record: PromptRecord) => PromptRecord,
) {
  const store = await readJsonFile<PromptStore>("prompts.json", DEFAULT_PROMPT_STORE);
  const idx = store.prompts.findIndex((item) => item.id === promptId);
  if (idx === -1) {
    return null;
  }
  const updated = updater(store.prompts[idx]);
  store.prompts[idx] = updated;
  await writeJsonFile("prompts.json", store);
  return updated;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = generateRequestSchema.parse(body);

    const config = await readJsonFile<AppConfig>("config.json", DEFAULT_CONFIG);
    const keyStore = await readJsonFile<KeyStore>("keys.json", DEFAULT_KEY_STORE);
    const referenceStore = await readJsonFile<ReferenceStore>(
      "references.json",
      DEFAULT_REFERENCE_STORE,
    );

    const keyId = parsed.keyId || config.selectedKeyId;
    const apiKeyEntry = keyStore.keys.find((key) => key.id === keyId);
    if (!apiKeyEntry) {
      return NextResponse.json({ message: "未找到有效的 API 密钥" }, { status: 400 });
    }

    const selectedReferences: ReferenceImage[] = [];
    if (parsed.referenceIds?.length) {
      for (const id of parsed.referenceIds) {
        for (const category of referenceStore.categories) {
          const found = category.images.find((img) => img.id === id);
          if (found) {
            selectedReferences.push(found);
            break;
          }
        }
      }
    }

    const { endpoint, model } = getApiUrl(apiKeyEntry.platform);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKeyEntry.apiKey}`,
    };

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: parsed.finalPrompt,
      },
    ];

    for (const reference of selectedReferences) {
      const dataUrl = await toBase64DataUrl(reference);
      if (dataUrl) {
        content.push({
          type: "image_url",
          image_url: {
            url: dataUrl,
          },
        });
      }
    }

    const payload = {
      model,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content,
        },
      ],
    };

    const maxAttempts = (parsed.retryCount ?? config.retryCount) + 1;
    let attempt = 0;
    let lastError: string | null = null;

    while (attempt < maxAttempts) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || `请求失败(${response.status})`);
        }

        const data = JSON.parse(text) as {
          choices?: Array<{ message?: { content?: unknown } }>;
        };
        const rawContent = extractContent(data.choices?.[0]?.message?.content);
        const parsedImage = parseImageFromMarkdown(rawContent);

        if (!parsedImage) {
          throw new Error("响应中未找到图片数据");
        }

        if (parsedImage.type === "url") {
          const updated = await updatePromptRecord(parsed.promptId, (record) => ({
            ...record,
            status: "成功",
            imageUrl: parsedImage.value,
            errorMsg: "",
            apiPlatform: apiKeyEntry.platform,
            updatedAt: new Date().toISOString(),
          }));

          return NextResponse.json({
            success: true,
            imageUrl: parsedImage.value,
            record: updated,
          });
        }

        const saved = await saveBase64Image(
          parsedImage.value,
          config,
          parsed.promptId,
          parsed.number,
        );

        const responsePayload = {
          success: true,
          imageUrl: saved.publicUrl ?? saved.filePath,
          filePath: saved.filePath,
          base64: config.autoSaveBase64 ? parsedImage.value : undefined,
        } as Record<string, unknown>;

        const updated = await updatePromptRecord(parsed.promptId, (record) => ({
          ...record,
          status: "成功",
          imageUrl: saved.publicUrl ?? saved.filePath,
          errorMsg: "",
          apiPlatform: apiKeyEntry.platform,
          updatedAt: new Date().toISOString(),
        }));

        responsePayload.record = updated;

        return NextResponse.json(responsePayload);
      } catch (error) {
        attempt += 1;
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt >= maxAttempts) {
          break;
        }
      }
    }

    const updated = await updatePromptRecord(parsed.promptId, (record) => ({
      ...record,
      status: "失败",
      errorMsg: lastError ?? "图片生成失败",
      updatedAt: new Date().toISOString(),
    }));

    return NextResponse.json(
      {
        success: false,
        message: lastError ?? "图片生成失败",
        record: updated,
      },
      { status: 500 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "生成失败" },
      { status: 400 },
    );
  }
}
