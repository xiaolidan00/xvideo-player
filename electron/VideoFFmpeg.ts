import {protocol, app} from "electron";

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "child_process";

import {ChildProcessWithoutNullStreams} from "node:child_process";
let ffmpegPath = "";
let ffprobePath = "";

let dataPath = "";

let videoList: any[] = [];
export const saveVideoData = () => {
  fs.writeFileSync(dataPath, JSON.stringify(videoList));
};
export const getVideoData = () => {
  if (fs.existsSync(dataPath)) {
    const data = fs.readFileSync(dataPath);
    if (data) {
      videoList = JSON.parse(data.toString());
      videoList.sort((a, b) => a.importTime - b.importTime);
      return videoList;
    }
  }

  return [];
};
export const getVideoDataItem = (filePath: string) => {
  const item = videoList.find((a) => a.filePath === filePath);

  return item;
};
export const deleteVideoData = (filePath: string) => {
  const idx = videoList.findIndex((a) => a.filePath === filePath);
  if (idx >= 0) {
    videoList.splice(idx, 1);
    saveVideoData();
  }
};
export const updateVideoData = (data: any) => {
  const item = videoList.find((a) => a.filePath === data.filePath);
  if (item) {
    item.currentTime = data.currentTime;
    saveVideoData();
  }
};
export const addVideoData = (filePath: string[]) => {
  const addList = filePath.map((a) => ({
    filePath: a,
    currentTime: 0,
    importTime: new Date().getTime()
  }));
  videoList.push(...addList);
  saveVideoData();
};
export const clearVideoData = () => {
  videoList = [];
  saveVideoData();
};

const processMap = new Map();
export const killProcess = () => {
  processMap.forEach((item) => {
    if (!item.killed) {
      item.kill();
    }
  });
};
export const isSegVideo = (type: string) => {
  return type === "mpegts";
};
class VideoManager {
  filePath: string = "";
  info: any;
  frames: Array<[number, number]> = [];
  type: string = "mp4";
  setfilePath(filePath: string) {
    this.filePath = filePath;
    killProcess();
  }
  setFrames(frames: Array<[number, number]>) {
    this.frames = frames;
  }
  setInfo(info: any) {
    this.info = info;
    this.type = info.formatType;
  }

  getDuration() {
    return Number(this.info.format.duration);
  }
  getFrame(index: number | string) {
    const item = this.frames[Number(index)];
    if (item) {
      return item;
    }
  }
}
export const videoManager = new VideoManager();

const getRange = async (filePath: string, rangeHeader: string | null) => {
  const {size} = await fs.promises.stat(filePath);
  let start = 0,
    end = size - 1;
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      start = match[1] ? parseInt(match[1], 10) : start;
      end = match[2] ? parseInt(match[2], 10) : end;
    }
  }
  const chunkSize = (end || size - 1) - start + 1;

  return {start, end, chunkSize, size};
};
const getVideoStream = async (req: Request, resolve: Function, reject: Function) => {
  const filePath = videoManager.filePath;
  const rangeHeader = req.headers.get("Range");

  const {start, end, chunkSize, size} = await getRange(filePath, rangeHeader);
  closeStream();
  videoStream = fs.createReadStream(filePath, {start, end});
  videoStream.on("error", (error) => {
    closeStream();
    console.log("error", error);
  });

  resolve(
    new Response(videoStream as any, {
      status: rangeHeader ? 206 : 200,
      headers: {
        "Content-Range": `bytes ${start}-${end || size - 1}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": "video/mp4",
        ...corsHeaders
      }
    })
  );
};

const runCMDStr = (cmd: string, args: string[]) => {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(cmd as string, args, {stdio: ["pipe", "pipe", "pipe"]});
    let chunks = "";
    proc.stdout.on("data", (d) => {
      chunks += d;
    });
    proc.stdout.on("end", () => {
      proc.kill();
      processMap.delete(proc);
      resolve(chunks);
    });

    proc.on("error", (err) => {
      proc.kill();
      processMap.delete(proc);
      reject(err);
    });
    processMap.set(proc, proc);
    // proc.stderr.on("data", () => {});
  });
};

let videoStream: fs.ReadStream;
const closeStream = () => {
  if (videoStream) {
    videoStream.close();
    videoStream.destroy();
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-cache"
  // "Cache-Control": "public, max-age=31536000, immutable"
};
export const getVideoInfo = async (filePath: string) => {
  const args = [
    "-v",
    "quiet", // 设置日志级别为静默，只输出 -show_... 请求的数据
    "-print_format",
    "json", // 输出格式为 JSON
    "-show_format", // 显示格式信息 (如总时长、文件大小、格式名称等)
    "-show_streams", // 显示所有流的信息 (视频流、音频流、字幕流等)
    filePath // 输入文件路径
  ];
  try {
    // console.log(`${ffprobePath} ${args.join(" ")}`);
    const data = await runCMDStr(ffprobePath, args);

    const info = JSON.parse(data);
    // console.log(info);
    // videoManager.setfilePath(filePath);

    return info;
  } catch (error) {
    console.log("getVideoInfo", error);
  }
  return "";
};

export const getVideoFrames = (filePath: string, duration: number) => {
  return new Promise<Array<[number, number]>>(async (resolve) => {
    const data = await runCMDStr(ffprobePath, [
      "-v",
      "error",
      "-skip_frame",
      "nokey",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=pts_time,key_frame",
      "-of",
      "csv=p=0",
      filePath
    ]);
    const keyFrames = data.trim().split("\n");
    const result: Array<[number, number]> = [];

    let start = 0;
    let max = 0;

    keyFrames.forEach((item: string) => {
      const s = item.split(",");
      const f = Number(s[1]);
      const time = f - start;
      if (Number.isNaN(time)) {
        console.log(item);
        return;
      }
      result.push([start, time]);

      start = f;
    });
    const last = duration - start;
    max = Math.max(max, last);
    result.push([start, last]);

    resolve(result);
  });
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "media", // 自定义协议名
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);
const getMpegtsVideo = (req: Request, index: string, resolve: Function, reject: Function) => {
  let ffmpegProcess: ChildProcessWithoutNullStreams;

  const onKill = () => {
    //@ts-ignore
    if (ffmpegProcess && !ffmpegProcess.killed) {
      ffmpegProcess.kill();
      processMap.delete(ffmpegProcess);
    }
  };
  try {
    const filePath = videoManager.filePath;
    const frame = videoManager.getFrame(index);
    if (!frame) {
      reject(
        new Response("Error starting FFmpeg process", {
          status: 500
        })
      );
      return;
    }
    const start = frame[0];
    const time = frame[1];
    const args: string[] = [
      "-y",
      "-i",
      filePath,
      "-threads",
      "3",
      "-max_muxing_queue_size",
      "9999",
      //开始时间
      "-ss",
      start.toString(),
      //持续时间
      "-t",
      time.toString(),
      //画质
      // "-crf",
      // "24",
      //关键帧间隔
      // "-g",
      // "60",
      //编码速度
      "-preset",
      "ultrafast",
      //视频编码
      "-c:v",
      "libx264",
      //音频编码
      "-c:a",
      "aac",
      //零延迟优化，关闭帧间预测缓存
      "-tune",
      "zerolatency",
      "-f",
      "mp4",
      "-movflags",
      "+frag_keyframe+empty_moov",
      "pipe:1"
    ];
    ffmpegProcess = spawn(ffmpegPath, args, {
      stdio: ["pipe", "pipe", "pipe"] // 确保 stdout 和 stderr 是管道
    });

    processMap.set(ffmpegProcess, ffmpegProcess);

    // 监听 fetch 请求的中断信号 (e.g., 浏览器取消请求)
    req.signal.addEventListener("abort", () => {
      console.log("Fetch request aborted, killing FFmpeg process...");
      onKill();
    });

    // 监听 ffmpeg 的 stderr，打印日志或错误信息
    // ffmpegProcess.stderr.on("data", (data: any) => {
    //     console.error(`FFmpeg stderr: ${data}`);
    // });
    ffmpegProcess.on("error", (err) => {
      console.error("Failed to start FFmpeg:", err);
      // 如果进程启动失败，但响应尚未发送，需要处理
      // 但由于我们立即返回了带有流的响应，这里较难处理
      // 更好的方式是在启动前验证文件是否存在
      onKill();
    });
    // 监听 ffmpeg 进程退出
    ffmpegProcess.on("close", (code: number, signal: string) => {
      onKill();
      // 如果进程因错误而退出，可以在这里处理
      if (code !== 0) {
        reject(
          new Response(`FFmpeg process exited with code ${code}`, {
            status: 500
          })
        );
      } else {
        console.log(`${index},FFmpeg process exited with code ${code} and signal ${signal}`);
      }
      // HTTP 响应流会在 ffmpegProcess.stdout.pipe(res) 完成后自动关闭
    });
    // 将 ffmpeg 的 stdout (即转码后的视频流) 管道到 HTTP 响应
    resolve(
      new Response(ffmpegProcess.stdout as any, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          ...corsHeaders
        }
      })
    );
  } catch (error) {
    // 如果进程已经启动但出错，也要确保清理
    onKill();
    reject(
      new Response("Error starting FFmpeg process", {
        status: 500
      })
    );
  }
};

export const registerMedia = () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
  const videoPath = VITE_DEV_SERVER_URL
    ? path.join(__dirname, "../ffmpeg/")
    : path.join(process.env.APP_ROOT, "ffmpeg/");

  ffmpegPath = path.join(videoPath, "ffmpeg.exe");
  ffprobePath = path.join(videoPath, "ffprobe.exe");

  dataPath = path.join(videoPath, "data.json");
  protocol.handle("media", (req) => {
    return new Promise<Response>(async (resolve, reject) => {
      const urlObj = new URL(req.url);

      if (urlObj.hostname === "video") {
        if (isSegVideo(videoManager.type)) {
          const index = decodeURIComponent(urlObj.searchParams.get("index") || "0");
          console.log("video", index);
          getMpegtsVideo(req, index, resolve, reject);
        } else {
          await getVideoStream(req, resolve, reject);
        }
      }
    });
  });
};
