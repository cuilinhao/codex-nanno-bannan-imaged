"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Papa from "papaparse";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPrompt,
  deletePrompt,
  generateImage,
  getConfig,
  getPromptStore,
  getReferenceStore,
  getStyleStore,
  importPrompts,
  updatePrompt,
} from "@/lib/api";
import type {
  AppConfig,
  PromptRecord,
  PromptStore,
  ReferenceStore,
  StyleStore,
} from "@/types";
import { Delete, Download, FileUp, Play, RefreshCw, Upload } from "lucide-react";

const fetchPrompts = () => getPromptStore();
const fetchStyles = () => getStyleStore();
const fetchReferences = () => getReferenceStore();
const fetchConfig = () => getConfig();

const addPromptSchema = z.object({
  number: z.string().optional(),
  prompt: z.string().min(1, "请输入提示词"),
});

type AddPromptValues = z.infer<typeof addPromptSchema>;

function getDisplayStatus(status: PromptRecord["status"]) {
  switch (status) {
    case "成功":
      return { label: "成功", variant: "default" as const };
    case "生成中":
      return { label: "生成中", variant: "secondary" as const };
    case "失败":
      return { label: "失败", variant: "destructive" as const };
    default:
      return { label: "等待中", variant: "outline" as const };
  }
}

export function PromptWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    data: promptStore,
    mutate: mutatePrompts,
    isLoading: promptsLoading,
  } = useSWR<PromptStore>("/api/prompts", fetchPrompts);
  const { data: styleStore } = useSWR<StyleStore>("/api/styles", fetchStyles);
  const { data: referenceStore } = useSWR<ReferenceStore>("/api/references", fetchReferences);
  const { data: config } = useSWR<AppConfig>("/api/config", fetchConfig);

  const prompts = useMemo(() => promptStore?.prompts ?? [], [promptStore]);
  const styles = useMemo(() => styleStore?.styles ?? [], [styleStore]);
  const references = useMemo(() => referenceStore?.categories ?? [], [referenceStore]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedStyleId, setSelectedStyleId] = useState<string>("");
  const [appendStyle, setAppendStyle] = useState<boolean>(true);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ total: 0, completed: 0, success: 0, failed: 0 });
  const [activeTab, setActiveTab] = useState("manage");

  const addPromptForm = useForm<AddPromptValues>({
    resolver: zodResolver(addPromptSchema),
    defaultValues: {
      number: "",
      prompt: "",
    },
  });

  useEffect(() => {
    if (prompts.length > 0 && selectedIds.size === 0) {
      const defaults = prompts
        .filter((item) => item.status === "等待中" || item.status === "失败")
        .map((item) => item.id);
      setSelectedIds(new Set(defaults));
    }
  }, [prompts, selectedIds.size]);

  const selectedStyleContent = useMemo(() => {
    if (!selectedStyleId) return "";
    const style = styles.find((item) => item.id === selectedStyleId);
    return style?.content ?? "";
  }, [styles, selectedStyleId]);

  const stats = useMemo(() => {
    const total = prompts.length;
    const waiting = prompts.filter((item) => item.status === "等待中").length;
    const running = prompts.filter((item) => item.status === "生成中").length;
    const success = prompts.filter((item) => item.status === "成功").length;
    const failed = prompts.filter((item) => item.status === "失败").length;
    return { total, waiting, running, success, failed };
  }, [prompts]);

  const handleAddPrompt = async (values: AddPromptValues) => {
    try {
      const created = await createPrompt(values);
      await mutatePrompts(
        (current) =>
          current
            ? {
                prompts: [...current.prompts, created],
              }
            : { prompts: [created] },
        { revalidate: false },
      );
      addPromptForm.reset({ number: "", prompt: "" });
      setSelectedIds((prev) => new Set(prev).add(created.id));
      toast.success("提示词已添加");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "添加提示词失败");
    }
  };

  const handleDeletePrompt = async (prompt: PromptRecord) => {
    if (!confirm(`确定删除提示词「${prompt.number || prompt.id}」吗？`)) {
      return;
    }
    try {
      await deletePrompt(prompt.id);
      await mutatePrompts(
        (current) =>
          current
            ? {
                prompts: current.prompts.filter((item) => item.id !== prompt.id),
              }
            : { prompts: [] },
        { revalidate: false },
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(prompt.id);
        return next;
      });
      toast.success("提示词已删除");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleImportCsv = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        encoding: "utf-8",
        complete: async (results) => {
          try {
            const rows = results.data as Array<Record<string, string>>;
            const items = rows
              .map((row) => ({
                number: (row["分镜编号"] ?? "").toString().trim(),
                prompt: (row["分镜提示词"] ?? "").toString().trim(),
              }))
              .filter((item) => item.prompt.length > 0);

            if (items.length === 0) {
              toast.error("未在 CSV 中找到有效的提示词数据");
              reject(new Error("无有效数据"));
              return;
            }

            await importPrompts({ items });
            await mutatePrompts();
            setSelectedIds(new Set());
            toast.success(`成功导入 ${items.length} 条提示词`);
            resolve();
          } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "导入失败");
            reject(error);
          }
        },
        error: (error) => {
          toast.error(`解析 CSV 失败: ${error.message}`);
          reject(error);
        },
      });
    });
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleExportCsv = () => {
    if (prompts.length === 0) {
      toast.info("暂无提示词可导出");
      return;
    }

    const rows = prompts.map((prompt) => ({
      分镜编号: prompt.number,
      分镜提示词: prompt.prompt,
      状态: prompt.status,
      图片URL: prompt.imageUrl ?? "",
      错误信息: prompt.errorMsg ?? "",
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NanoBanana-prompts-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("已导出 CSV 文件");
  };

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = prompts.map((item) => item.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleReference = (id: string, checked: boolean) => {
    setSelectedReferenceIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleStartGeneration = async () => {
    if (!config?.selectedKeyId) {
      toast.error("请先在基础配置中选择默认 API 密钥");
      return;
    }

    const idsToProcess = prompts
      .filter((item) => selectedIds.has(item.id))
      .filter((item) => item.status === "等待中" || item.status === "失败");

    if (idsToProcess.length === 0) {
      toast.info("请选择需要生成的提示词");
      return;
    }

    setIsGenerating(true);
    setProgress({ total: idsToProcess.length, completed: 0, success: 0, failed: 0 });
    setActiveTab("progress");

    const concurrency = Math.max(1, Math.min(config.maxConcurrency ?? 3, idsToProcess.length));
    const queue = [...idsToProcess];

    const runWorker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        await mutatePrompts(
          (current) => {
            if (!current) return current;
            return {
              prompts: current.prompts.map((prompt) =>
                prompt.id === item.id
                  ? {
                      ...prompt,
                      status: "生成中",
                      errorMsg: "",
                    }
                  : prompt,
              ),
            };
          },
          { revalidate: false },
        );

        const finalPrompt = appendStyle && selectedStyleContent
          ? `${item.prompt}\n\n${selectedStyleContent}`
          : item.prompt;

        try {
          await generateImage({
            promptId: item.id,
            prompt: item.prompt,
            finalPrompt,
            number: item.number,
            styleId: selectedStyleId || undefined,
            referenceIds: Array.from(selectedReferenceIds),
            retryCount: config.retryCount,
            keyId: config.selectedKeyId,
          });

          await mutatePrompts(
            (current) => {
              if (!current) return current;
              return {
                prompts: current.prompts.map((prompt) =>
                  prompt.id === item.id
                    ? {
                        ...prompt,
                        status: "成功",
                      }
                    : prompt,
                ),
              };
            },
            { revalidate: false },
          );

          setProgress((prev) => ({
            ...prev,
            completed: prev.completed + 1,
            success: prev.success + 1,
          }));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "生成失败";
          await mutatePrompts(
            (current) => {
              if (!current) return current;
              return {
                prompts: current.prompts.map((prompt) =>
                  prompt.id === item.id
                    ? {
                        ...prompt,
                        status: "失败",
                        errorMsg: message,
                      }
                    : prompt,
                ),
              };
            },
            { revalidate: false },
          );

          setProgress((prev) => ({
            ...prev,
            completed: prev.completed + 1,
            failed: prev.failed + 1,
          }));

          toast.error(`提示词 ${item.number || item.id} 生成失败: ${message}`);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
    setIsGenerating(false);
    await mutatePrompts();
    toast.success("批量出图任务已完成");
  };

  const handleRetryFailed = () => {
    const failedIds = prompts.filter((item) => item.status === "失败").map((item) => item.id);
    if (failedIds.length === 0) {
      toast.info("当前没有需要重试的提示词");
      return;
    }
    setSelectedIds(new Set(failedIds));
    toast.success("已选中全部失败记录，可直接重新生成");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>生成概览</CardTitle>
            <CardDescription>
              统计当前提示词状态，便于掌握任务完成情况。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span>提示词总数</span>
              <span className="font-semibold">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>等待中</span>
              <span>{stats.waiting}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>生成中</span>
              <span>{stats.running}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span>成功</span>
              <span>{stats.success}</span>
            </div>
            <div className="flex items-center justify-between text-destructive">
              <span>失败</span>
              <span>{stats.failed}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>风格与参考图</CardTitle>
            <CardDescription>选择需要附加的风格模板或参考图资源。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">风格模板</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedStyleId}
                onChange={(event) => setSelectedStyleId(event.target.value)}
              >
                <option value="">不使用风格模板</option>
                {styles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
              {selectedStyleId ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-xs text-muted-foreground">附加风格内容</span>
                  <Switch checked={appendStyle} onCheckedChange={setAppendStyle} />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">参考图</Label>
              {references.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无参考图，请在「参考图」页中添加。</p>
              ) : (
                <ScrollArea className="h-40 rounded-md border">
                  <div className="space-y-1 p-3">
                    {references.map((category) => (
                      <div key={category.id} className="space-y-1">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">
                          {category.name}
                        </div>
                        {category.images.length === 0 ? (
                          <p className="text-xs text-muted-foreground">该分类暂无图片</p>
                        ) : (
                          category.images.map((image) => (
                            <label key={image.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
                              <Checkbox
                                checked={selectedReferenceIds.has(image.id)}
                                onCheckedChange={(checked) =>
                                  toggleReference(image.id, Boolean(checked))
                                }
                              />
                              <span className="text-xs">{image.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>批量操作</CardTitle>
            <CardDescription>导入/导出 CSV，或选择部分提示词执行操作。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={triggerImport} variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" /> 导入 CSV
              </Button>
              <Button onClick={handleExportCsv} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" /> 导出结果
              </Button>
              <Button onClick={() => toggleSelectAll(true)} variant="outline" size="sm">
                全选
              </Button>
              <Button onClick={() => toggleSelectAll(false)} variant="outline" size="sm">
                取消全选
              </Button>
              <Button onClick={handleRetryFailed} variant="outline" size="sm">
                选择失败记录
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void handleImportCsv(file).finally(() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                });
              }}
            />
            <div className="text-xs text-muted-foreground">
              CSV 文件需包含「分镜编号」「分镜提示词」两列，支持 UTF-8/GBK 等常见编码。
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>提示词管理</CardTitle>
            <CardDescription>
              支持快速新增、编辑、删除提示词，可批量选中后发起生成任务。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleStartGeneration} disabled={isGenerating}>
              <Play className="mr-2 h-4 w-4" /> 开始生成
            </Button>
            <Button size="sm" variant="outline" onClick={() => mutatePrompts()} disabled={isGenerating}>
              <RefreshCw className="mr-2 h-4 w-4" /> 刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="manage">提示词列表</TabsTrigger>
              <TabsTrigger value="progress">进度追踪</TabsTrigger>
            </TabsList>
            <TabsContent value="manage" className="space-y-4">
              <form
                className="grid gap-3 rounded-lg border bg-muted/30 p-4"
                onSubmit={addPromptForm.handleSubmit((values) => handleAddPrompt(values))}
              >
                <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                  <Input placeholder="分镜编号（可选）" {...addPromptForm.register("number")} />
                  <Textarea
                    placeholder="请输入提示词内容"
                    {...addPromptForm.register("prompt")}
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    新增的提示词默认状态为「等待中」，支持立即进入生成任务。
                  </div>
                  <Button size="sm" type="submit" disabled={addPromptForm.formState.isSubmitting}>
                    <FileUp className="mr-2 h-4 w-4" /> 添加提示词
                  </Button>
                </div>
              </form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={selectedIds.size === prompts.length && prompts.length > 0}
                          onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="w-[120px]">分镜编号</TableHead>
                      <TableHead>提示词</TableHead>
                      <TableHead className="w-[120px]">状态</TableHead>
                      <TableHead className="w-[160px]">图片/错误信息</TableHead>
                      <TableHead className="w-[80px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promptsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          正在加载提示词...
                        </TableCell>
                      </TableRow>
                    ) : prompts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          暂无提示词，先添加或导入一批吧。
                        </TableCell>
                      </TableRow>
                    ) : (
                      prompts.map((prompt) => {
                        const statusInfo = getDisplayStatus(prompt.status);
                        return (
                          <TableRow key={prompt.id}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedIds.has(prompt.id)}
                                onCheckedChange={(checked) =>
                                  toggleSelection(prompt.id, Boolean(checked))
                                }
                                aria-label={`选择 ${prompt.id}`}
                              />
                            </TableCell>
                            <TableCell className="align-top text-sm font-medium">
                              {prompt.number || "--"}
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={prompt.prompt}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  mutatePrompts(
                                    (current) => {
                                      if (!current) return current;
                                      return {
                                        prompts: current.prompts.map((item) =>
                                          item.id === prompt.id
                                            ? {
                                                ...item,
                                                prompt: nextValue,
                                              }
                                            : item,
                                        ),
                                      };
                                    },
                                    { revalidate: false },
                                  );
                                }}
                                onBlur={(event) => {
                                  const nextValue = event.target.value.trim();
                                  if (nextValue !== prompt.prompt) {
                                    void updatePrompt(prompt.id, { prompt: nextValue });
                                  }
                                }}
                                rows={3}
                                className="min-h-[88px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                              {prompt.apiPlatform ? (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {prompt.apiPlatform}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="align-top text-xs text-muted-foreground">
                              {prompt.imageUrl ? (
                                <a
                                  href={prompt.imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline-offset-4 hover:underline"
                                >
                                  查看图片
                                </a>
                              ) : prompt.errorMsg ? (
                                <span className="text-destructive">{prompt.errorMsg}</span>
                              ) : (
                                <span>--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleDeletePrompt(prompt)}
                              >
                                <Delete className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="progress">
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    总计 {progress.total} 条 | 已完成 {progress.completed} 条 | 成功 {progress.success} 条 |
                    失败 {progress.failed} 条
                  </span>
                  {isGenerating ? <span className="text-xs text-muted-foreground">生成中...</span> : null}
                </div>
                <Progress value={progress.total ? (progress.completed / progress.total) * 100 : 0} />
                <p className="text-xs text-muted-foreground">
                  生成过程将按照基础配置中的并发数执行，可随时切换回提示词列表继续编辑或新增。
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
