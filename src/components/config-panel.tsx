"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getConfig,
  getKeys,
  updateConfig,
} from "@/lib/api";
import type { AppConfig, KeyStore } from "@/types";

const fetchConfig = () => getConfig();
const fetchKeys = () => getKeys();

export function ConfigPanel() {
  const { data: config, mutate: mutateConfig, isLoading: configLoading } = useSWR<AppConfig>(
    "/api/config",
    fetchConfig,
  );
  const { data: keyStore, mutate: mutateKeys } = useSWR<KeyStore>(
    "/api/keys",
    fetchKeys,
  );

  const [maxConcurrency, setMaxConcurrency] = useState(5);
  const [retryCount, setRetryCount] = useState(2);
  const [saveDirectory, setSaveDirectory] = useState("public/generated");
  const [autoSaveBase64, setAutoSaveBase64] = useState(true);

  useEffect(() => {
    if (config) {
      setMaxConcurrency(config.maxConcurrency);
      setRetryCount(config.retryCount);
      setSaveDirectory(config.saveDirectory);
      setAutoSaveBase64(config.autoSaveBase64);
    }
  }, [config]);

  const selectedKey = useMemo(() => {
    if (!config || !keyStore) return undefined;
    return keyStore.keys.find((key) => key.id === config.selectedKeyId);
  }, [config, keyStore]);

  const handleSave = async () => {
    try {
      const payload: Partial<AppConfig> = {
        selectedKeyId: config?.selectedKeyId ?? "",
        maxConcurrency,
        retryCount,
        saveDirectory,
        autoSaveBase64,
      };
      const updated = await updateConfig(payload);
      await mutateConfig(updated, { revalidate: true });
      toast.success("基础配置已更新");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "更新配置失败，请稍后再试",
      );
    }
  };

  const handleKeySelect = async (keyId: string) => {
    if (!config) return;
    try {
      const updated = await updateConfig({
        ...config,
        selectedKeyId: keyId,
      });
      await mutateConfig(updated, { revalidate: false });
      toast.success("已切换当前API密钥");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "切换密钥失败，请稍后再试",
      );
    }
  };

  if (configLoading && !config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>基础配置</CardTitle>
          <CardDescription>加载配置中...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>基础配置</CardTitle>
          <CardDescription>
            设置批量出图的核心参数，确保并发控制与重试机制符合平台限速策略。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="maxConcurrency">并发任务数</Label>
            <Input
              id="maxConcurrency"
              type="number"
              min={1}
              max={2000}
              value={maxConcurrency}
              onChange={(event) => setMaxConcurrency(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              建议根据平台限流情况设置（通常 1 - 50）。过高的并发可能触发限流或封禁。
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="retryCount">失败重试次数</Label>
            <Input
              id="retryCount"
              type="number"
              min={0}
              max={10}
              value={retryCount}
              onChange={(event) => setRetryCount(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="saveDirectory">图片保存目录</Label>
            <Input
              id="saveDirectory"
              value={saveDirectory}
              onChange={(event) => setSaveDirectory(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              服务端保存生成图片的相对路径。默认保存在 public/generated 目录以便前端直接访问。
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">自动保留 Base64 数据</p>
              <p className="text-xs text-muted-foreground">
                服务端在成功生成后保留完整的 Base64 数据，方便二次下载。
              </p>
            </div>
            <Switch
              checked={autoSaveBase64}
              onCheckedChange={(checked) => setAutoSaveBase64(checked)}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            保存基础配置
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前密钥</CardTitle>
          <CardDescription>
            选择当前使用的 API 密钥，会在批量出图时默认使用该配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>选择密钥</Label>
            <Select
              value={config?.selectedKeyId ?? ""}
              onValueChange={(value) => handleKeySelect(value)}
              disabled={!keyStore || keyStore.keys.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="请先添加密钥" />
              </SelectTrigger>
              <SelectContent>
                {keyStore?.keys.map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    {key.name}（{key.platform}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!keyStore || keyStore.keys.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                当前没有可用的密钥，请前往密钥库添加。
              </p>
            ) : selectedKey ? (
              <div className="rounded-md border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">平台</span>
                  <span>{selectedKey.platform}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">最后使用时间</span>
                  <span>{selectedKey.lastUsed ?? "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">创建时间</span>
                  <span>{new Date(selectedKey.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ) : null}
          </div>
          <Button variant="outline" onClick={() => mutateKeys()}>
            刷新密钥列表
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
