import { z } from "zod";

export const apiPlatformValues = ["云雾", "API易", "apicore"] as const;

export const apiKeySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "名称不能为空"),
  platform: z.enum(apiPlatformValues),
  apiKey: z.string().min(1, "API密钥不能为空"),
  createdAt: z.string().optional(),
  lastUsed: z.string().optional(),
});

export const configSchema = z.object({
  selectedKeyId: z.string().optional().default(""),
  maxConcurrency: z.number().int().min(1).max(2000),
  retryCount: z.number().int().min(0).max(10),
  saveDirectory: z.string().min(1),
  autoSaveBase64: z.boolean().default(true),
});

export const styleCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "分类名称不能为空"),
  description: z.string().optional(),
});

export const styleEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "风格名称不能为空"),
  categoryId: z.string().min(1),
  content: z.string().min(1, "风格内容不能为空"),
  usageCount: z.number().int().min(0).default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const referenceCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "分类名称不能为空"),
});

export const referenceImageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "参考图名称不能为空"),
  description: z.string().optional(),
  sourceType: z.enum(["upload", "url"]),
  path: z.string().min(1),
  url: z.string().url().optional(),
  createdAt: z.string().optional(),
});

export const promptSchema = z.object({
  id: z.string().optional(),
  number: z.string().optional(),
  prompt: z.string().min(1, "提示词不能为空"),
  status: z.enum(["等待中", "生成中", "成功", "失败"]).optional(),
  imageUrl: z.string().optional(),
  errorMsg: z.string().optional(),
  apiPlatform: z.enum(apiPlatformValues).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const generateRequestSchema = z.object({
  promptId: z.string().min(1),
  prompt: z.string().min(1),
  finalPrompt: z.string().min(1),
  number: z.string().optional(),
  styleId: z.string().optional(),
  referenceIds: z.array(z.string()).optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
  keyId: z.string().optional(),
});
