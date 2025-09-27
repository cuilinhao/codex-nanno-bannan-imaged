'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { PromptManager } from './prompt-manager';
import { VideoTaskBoard } from './video-task-board';
import { StyleLibrary } from './style-library';
import { ReferenceLibrary } from './reference-library';
import { KeyManager } from './key-manager';
import { SettingsCenter } from './settings-center';

export function MainDashboard() {
  const { data: prompts } = useQuery({ queryKey: ['prompts'], queryFn: api.getPrompts });
  const { data: videoTasks } = useQuery({ queryKey: ['video-tasks'], queryFn: api.getVideoTasks });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: keys } = useQuery({ queryKey: ['keys'], queryFn: api.getKeys });

  const totalImages = prompts?.prompts.length ?? 0;
  const successImages = prompts?.prompts.filter((item) => item.status === '成功').length ?? 0;
  const failedImages = prompts?.prompts.filter((item) => item.status === '失败').length ?? 0;

  const totalVideos = videoTasks?.videoTasks.length ?? 0;
  const successVideos = videoTasks?.videoTasks.filter((item) => item.status === '成功').length ?? 0;

  const quickCards = useMemo(
    () => [
      {
        label: '当前平台',
        value: settings?.apiSettings.apiPlatform ?? '云雾',
        helper: settings?.apiSettings.currentKeyName ? `密钥：${settings.apiSettings.currentKeyName}` : '尚未选择密钥',
      },
      {
        label: '批量出图',
        value: `${successImages}/${totalImages}`,
        helper: failedImages ? `${failedImages} 个失败待处理` : '全部正常',
      },
      {
        label: '图生视频',
        value: `${successVideos}/${totalVideos}`,
        helper: totalVideos ? '点击“图生视频”标签查看详情' : '暂无任务',
      },
      {
        label: '并发 / 重试',
        value: `${settings?.apiSettings.threadCount ?? 0} / ${settings?.apiSettings.retryCount ?? 0}`,
        helper: `图片保存: ${settings?.apiSettings.savePath ?? '未设置'}`,
      },
    ],
    [settings, successImages, totalImages, failedImages, successVideos, totalVideos],
  );

  return (
    <div className="space-y-6 pb-16">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nano banana 批量出图 · Web 控制台</h1>
          <p className="text-sm text-muted-foreground">
            管理提示词、参考图库、风格库与 API 密钥，一键触发批量出图与图生视频任务。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickCards.map((card) => (
            <Card key={card.label} className="border border-slate-200 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <div className="text-sm text-muted-foreground">{card.label}</div>
                <div className="text-2xl font-semibold text-slate-900">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.helper}</div>
              </CardContent>
            </Card>
          ))}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="text-sm text-muted-foreground">密钥数量</div>
              <div className="text-2xl font-semibold text-slate-900">{keys?.keys.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">
                {keys?.current ? `当前启用: ${keys.current}` : '尚未启用任何密钥'}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="flex flex-wrap gap-2 bg-slate-100 p-1">
          <TabsTrigger value="dashboard">批量出图 / 视频</TabsTrigger>
          <TabsTrigger value="styles">风格库</TabsTrigger>
          <TabsTrigger value="images">参考图库</TabsTrigger>
          <TabsTrigger value="keys">密钥库</TabsTrigger>
          <TabsTrigger value="settings">设置中心</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <PromptManager />
            <VideoTaskBoard />
          </div>
        </TabsContent>

        <TabsContent value="styles">
          <StyleLibrary />
        </TabsContent>

        <TabsContent value="images">
          <ReferenceLibrary />
        </TabsContent>

        <TabsContent value="keys">
          <KeyManager />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsCenter />
        </TabsContent>
      </Tabs>
    </div>
  );
}
