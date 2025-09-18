"use client";

import { useState } from "react";

import { ConfigPanel } from "@/components/config-panel";
import { KeyVault } from "@/components/key-vault";
import { ReferenceLibrary } from "@/components/reference-library";
import { StyleLibrary } from "@/components/style-library";
import { PromptWorkspace } from "@/components/prompt-workspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const [tab, setTab] = useState("config");

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <section className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Nano Banana 批量出图控制台</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            在浏览器中集中管理 API 密钥、提示词风格库、参考图资源与批量任务。支持多平台密钥切换、风格库模板管理、参考图上传与链接引用，让团队协作更加高效。
          </p>
        </section>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="config">基础配置</TabsTrigger>
            <TabsTrigger value="styles">风格库</TabsTrigger>
            <TabsTrigger value="references">参考图</TabsTrigger>
            <TabsTrigger value="prompts">批量任务</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            <ConfigPanel />
            <KeyVault />
          </TabsContent>

          <TabsContent value="styles">
            <StyleLibrary />
          </TabsContent>

          <TabsContent value="references">
            <ReferenceLibrary />
          </TabsContent>

          <TabsContent value="prompts">
            <PromptWorkspace />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
