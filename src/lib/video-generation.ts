import path from 'path';
import { promises as fs } from 'fs';
import pLimit from 'p-limit';
import axios, { type AxiosRequestConfig } from 'axios';
import { readAppData, updateAppData } from './data-store';
import type { AppData, VideoTask } from './types';

const GENERATE_URL = 'https://api.kie.ai/api/v1/veo/generate';
const RECORD_URL = 'https://api.kie.ai/api/v1/veo/record-info';

interface GenerateVideosPayload {
  numbers?: string[];
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function resolveSaveDir(savePath: string): string {
  if (!savePath) return path.join(process.cwd(), 'public', 'generated_videos');
  return path.isAbsolute(savePath) ? savePath : path.join(process.cwd(), savePath);
}

function pickVideoApiKey(data: AppData): { apiKey: string; source: string } {
  const envKey = process.env.KIE_API_KEY;
  if (envKey?.trim()) {
    return { apiKey: envKey.trim(), source: 'environment' };
  }

  if (data.videoSettings.apiKey?.trim()) {
    return { apiKey: data.videoSettings.apiKey.trim(), source: 'videoSettings' };
  }

  const candidate = Object.values(data.keyLibrary).find((item) => {
    const normalized = item.platform?.toLowerCase() ?? '';
    return ['kie.ai', 'kie', 'kei', 'kieai'].includes(normalized);
  });

  if (candidate) {
    return { apiKey: candidate.apiKey, source: candidate.name };
  }

  throw new Error('未配置 KIE.AI 的 API 密钥');
}

async function updateVideoTask(number: string, patch: Partial<VideoTask>) {
  await updateAppData((data) => {
    const task = data.videoTasks.find((item) => item.number === number);
    if (task) {
      Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    }
    return data;
  });
}

async function fetchJson<T = Record<string, unknown>>(
  url: string,
  config: AxiosRequestConfig,
  timeoutMs = 900_000,
  retries = 3,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await axios({
        url,
        ...config,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          ...config.headers,
        },
        validateStatus: (status) => status < 500,
      });

      if (response.status >= 400) {
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`HTTP ${response.status}: ${data}`);
      }

      return response.data as T;
    } catch (error) {
      lastError = error as Error;

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(`请求超时 (${timeoutMs}ms)`);
        }

        if (error.code === 'ECONNRESET') {
          if (attempt < retries) {
            console.log(`[重试 ${attempt}/${retries}] 连接重置，等待 ${attempt * 2}秒后重试...`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
            continue;
          }
          throw new Error(
            `连接被服务器重置，已重试${retries}次。可能原因：图片URL域名被阻止（建议使用postimg.cc等图床）`,
          );
        }

        if (error.response && error.response.status >= 500) {
          if (attempt < retries) {
            console.log(`[重试 ${attempt}/${retries}] 服务器错误，等待后重试...`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
            continue;
          }
        }

        if (error.response) {
          const status = error.response.status;
          const data = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
          throw new Error(`HTTP ${status}: ${data}`);
        }

        throw new Error(`网络请求失败 (${error.code || 'unknown'}): ${error.message}`);
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('请求失败');
}

async function downloadVideo(url: string, number: string, saveDir: string): Promise<{ localPath: string; actualFilename: string }> {
  await ensureDir(saveDir);
  const parsedUrl = new URL(url);
  const baseName = path.basename(parsedUrl.pathname || `${number}-${Date.now()}`) || `${number}-${Date.now()}.mp4`;
  const ext = baseName.toLowerCase().endsWith('.mp4') ? '' : '.mp4';
  const timestamp = Date.now();
  const filename = `${number}_${timestamp}_${baseName}${ext}`;
  const finalPath = path.join(saveDir, filename);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载视频失败: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(finalPath, buffer);
  const relative = path.relative(path.join(process.cwd(), 'public'), finalPath);
  return { localPath: path.posix.join(relative), actualFilename: filename };
}

async function processVideoTask(task: VideoTask, apiKey: string, saveDir: string) {
  await updateVideoTask(task.number, { status: '生成中', errorMsg: '', progress: 5 });

  const payload: Record<string, unknown> = {
    prompt: task.prompt,
    imageUrls: task.imageUrls ?? [],
    model: 'veo3',
    aspectRatio: task.aspectRatio ?? '16:9',
    enableFallback: Boolean(task.enableFallback),
    enableTranslation: task.enableTranslation !== false,
  };

  if (task.watermark) payload.watermark = task.watermark;
  if (task.callbackUrl) payload.callBackUrl = task.callbackUrl;
  if (task.seeds) {
    const seedsNumber = Number.parseInt(String(task.seeds), 10);
    if (Number.isFinite(seedsNumber)) {
      payload.seeds = seedsNumber;
    }
  }

  try {
    console.log(`[视频任务 ${task.number}] 开始生成，提示词: ${task.prompt.slice(0, 50)}...`);
    console.log(`[视频任务 ${task.number}] 图片URL: ${task.imageUrls?.[0] || '无'}`);

    const generateResponse = await fetchJson(
      GENERATE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        data: payload,
      },
      900_000,
    );

    console.log(`[视频任务 ${task.number}] API 响应:`, JSON.stringify(generateResponse).slice(0, 200));

    const taskId = generateResponse?.data?.taskId;
    if (!taskId) {
      console.error(`[视频任务 ${task.number}] 完整 API 响应:`, JSON.stringify(generateResponse, null, 2));
      throw new Error(`生成接口未返回 taskId。响应结构: ${JSON.stringify(generateResponse).slice(0, 500)}`);
    }

    await updateVideoTask(task.number, { status: '任务已提交，等待处理...', progress: 15 });

    const pollUrl = `${RECORD_URL}?taskId=${encodeURIComponent(taskId)}`;
    let pollCount = 0;
    const maxPollTimes = 120;
    const pollInterval = 5000;

    while (pollCount < maxPollTimes) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      pollCount += 1;
      const pollData = await fetchJson(
        pollUrl,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        900_000,
      );

      if (pollData?.code !== 200) {
        await updateVideoTask(task.number, {
          status: `生成中... (轮询 ${pollCount})`,
        });
        continue;
      }

      const payloadData = pollData.data ?? {};
      if (payloadData.successFlag === 1) {
        await updateVideoTask(task.number, { status: '生成完成，开始下载...', progress: 95 });
        const resultUrls: string[] = payloadData.response?.resultUrls ?? [];
        if (!resultUrls.length) {
          throw new Error('查询接口未返回视频链接');
        }
    const { localPath, actualFilename } = await downloadVideo(resultUrls[0], task.number, saveDir);
    await updateVideoTask(task.number, {
      status: '成功',
      progress: 100,
      localPath,
      remoteUrl: resultUrls[0],
      actualFilename,
      errorMsg: '',
    });
        return;
      }

      if (payloadData.errorMessage) {
        throw new Error(payloadData.errorMessage);
      }

      await updateVideoTask(task.number, {
        status: `生成中... (轮询 ${pollCount})`,
        progress: Math.min(90, 15 + pollCount * 2),
      });
    }

    throw new Error('轮询超时，未在预期时间内完成视频生成');
  } catch (error) {
    const errorMessage = (error as Error).message || String(error);
    console.error(`[视频任务 ${task.number}] 失败:`, errorMessage);
    console.error(`[视频任务 ${task.number}] 错误堆栈:`, (error as Error).stack);
    await updateVideoTask(task.number, {
      status: '失败',
      errorMsg: errorMessage,
    });
  }
}

export async function generateVideos({ numbers }: GenerateVideosPayload) {
  const data = await readAppData();
  const { apiSettings, videoTasks: tasks } = data;
  const targets = (() => {
    const filtered = numbers?.length ? tasks.filter((item) => numbers.includes(item.number)) : tasks;
    return filtered.filter((item) => ['等待中', '失败'].includes(item.status));
  })();

  if (!targets.length) {
    return { success: false, message: '没有需要生成的视频任务' };
  }

  const { apiKey } = pickVideoApiKey(data);
  const saveDir = resolveSaveDir(data.videoSettings.savePath);
  const limit = pLimit(Math.max(1, apiSettings.threadCount ?? 1));

  await Promise.all(targets.map((task) => limit(() => processVideoTask(task, apiKey, saveDir))));

  return { success: true };
}
