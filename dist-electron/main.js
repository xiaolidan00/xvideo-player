import { protocol, app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "child_process";
const __dirname$2 = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL$1 = process.env["VITE_DEV_SERVER_URL"];
const videoPath = VITE_DEV_SERVER_URL$1 ? path.join(__dirname$2, "../ffmpeg/") : path.join(process.env.APP_ROOT, "ffmpeg/");
const ffmpegPath = path.join(videoPath, "ffmpeg.exe");
const ffprobePath = path.join(videoPath, "ffprobe.exe");
path.join(videoPath, "index.m3u8");
path.join(videoPath, "temp.mp4");
const getRange = async (filePath, rangeHeader) => {
  const { size } = await fs.promises.stat(filePath);
  let start = 0, end = size - 1;
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      start = match[1] ? parseInt(match[1], 10) : start;
      end = match[2] ? parseInt(match[2], 10) : end;
    }
  }
  const chunkSize = (end || size - 1) - start + 1;
  return { start, end, chunkSize, size };
};
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    // 自定义协议名
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);
const runCMDBuffer = (cmd, args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    proc.stdout.on("data", (d) => {
      chunks.push(d);
    });
    proc.stdout.on("end", () => {
      const buf = Buffer.concat(chunks);
      resolve(buf);
    });
    proc.on("error", reject);
  });
};
const runCMDStr = (cmd, args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let chunks = "";
    proc.stdout.on("data", (d) => {
      chunks += d;
    });
    proc.stdout.on("end", () => {
      resolve(chunks);
    });
    proc.on("error", reject);
  });
};
let videoStream;
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
const getVideoInfo = async (filePath) => {
  const args = [
    "-v",
    "quiet",
    // 设置日志级别为静默，只输出 -show_... 请求的数据
    "-print_format",
    "json",
    // 输出格式为 JSON
    "-show_format",
    // 显示格式信息 (如总时长、文件大小、格式名称等)
    "-show_streams",
    // 显示所有流的信息 (视频流、音频流、字幕流等)
    filePath
    // 输入文件路径
  ];
  try {
    const data = await runCMDStr(ffprobePath, args);
    return JSON.parse(data);
  } catch (error) {
  }
  return "";
};
const registerMedia = () => {
  protocol.handle("media", async (req) => {
    const urlObj = new URL(req.url);
    const filePath = decodeURIComponent(urlObj.searchParams.get("file") || "");
    const type = decodeURIComponent(urlObj.searchParams.get("type") || "");
    if (urlObj.hostname === "video" && filePath) {
      if (type !== "h264") {
        const start = Number(decodeURIComponent(urlObj.searchParams.get("start") || "0"));
        const duration = Number(decodeURIComponent(urlObj.searchParams.get("duration") || "0"));
        console.log("h265", start);
        try {
          const time = start * 10;
          const args = [
            "-y",
            "-ss",
            time.toString(),
            "-i",
            filePath,
            "-t",
            time + 10 <= duration ? "10" : (duration - time).toString(),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-movflags",
            "frag_keyframe+empty_moov",
            "-avoid_negative_ts",
            "make_zero",
            "-c:a",
            "aac",
            "-f",
            "mp4",
            "pipe:1"
          ];
          const buf = await runCMDBuffer(ffmpegPath, args);
          return new Response(buf, {
            headers: { "Content-Type": "video/mp4", "Content-Range": "none", ...corsHeaders }
          });
        } catch (e) {
          console.log(e);
          return new Response(
            JSON.stringify({
              data: null,
              code: 500,
              msg: "fail to load" + e.message
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        const rangeHeader = req.headers.get("Range");
        const { start, end, chunkSize, size } = await getRange(filePath, rangeHeader);
        closeStream();
        videoStream = fs.createReadStream(filePath, { start, end });
        videoStream.on("error", (error) => {
          closeStream();
          console.log("error", error);
        });
        return new Response(videoStream, {
          status: rangeHeader ? 206 : 200,
          headers: {
            "Content-Range": `bytes ${start}-${end || size - 1}/${size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Content-Type": "video/mp4",
            ...corsHeaders
          }
        });
      }
    }
    return new Response(JSON.stringify({ code: 400, data: "", msg: "not found" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  });
};
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = process.env.APP_ROOT = path.join(__dirname$1, "..");
console.log(ROOT_PATH);
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1e3,
    height: 600,
    autoHideMenuBar: true,
    resizable: true,
    backgroundColor: "#505050",
    icon: path.join(process.env.VITE_PUBLIC, "logo.ico"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  ipcMain.on("video-info", async (ev, op) => {
    if (op.data.path) {
      try {
        const info = await getVideoInfo(op.data.path);
        win == null ? void 0 : win.webContents.send(op.cb, info);
      } catch (error) {
        console.log(error);
      }
    }
  });
  ipcMain.on("top-win", async (ev, tag) => {
    win == null ? void 0 : win.setAlwaysOnTop(tag);
  });
  ipcMain.on("save-video", async (ev, op) => {
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  createWindow();
  registerMedia();
});
function mainConsole(data) {
  console.log("mainConsole", data);
  win == null ? void 0 : win.webContents.send("main-process-console", data);
}
export {
  MAIN_DIST,
  RENDERER_DIST,
  ROOT_PATH,
  VITE_DEV_SERVER_URL,
  mainConsole
};
