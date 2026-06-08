var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { protocol, app, BrowserWindow, ipcMain } from "electron";
import { createRequire as createRequire$1 } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "child_process";
import { createRequire } from "module";
const __dirname$3 = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL$2 = process.env["VITE_DEV_SERVER_URL"];
const videoPath = VITE_DEV_SERVER_URL$2 ? path.join(__dirname$3, "../ffmpeg/") : path.join(process.env.APP_ROOT, "ffmpeg/");
const ffmpegPath = path.join(videoPath, "ffmpeg.exe");
const ffprobePath = path.join(videoPath, "ffprobe.exe");
path.join(videoPath, "index.m3u8");
path.join(videoPath, "temp.mp4");
path.join(videoPath, "hls");
const segmentCache = /* @__PURE__ */ new Map();
const inflight = /* @__PURE__ */ new Map();
const processMap = /* @__PURE__ */ new Map();
const killProcess = () => {
  processMap.forEach((item) => {
    if (!item.killed) {
      item.kill();
    }
  });
};
const isSegVideo = (type) => {
  return type === "mpegts";
};
class VideoManager {
  constructor() {
    __publicField(this, "filePath", "");
    __publicField(this, "info");
    __publicField(this, "frames", []);
    __publicField(this, "m3u8Text", "");
    __publicField(this, "type", "mp4");
  }
  setfilePath(filePath) {
    this.filePath = filePath;
    segmentCache.clear();
    inflight.clear();
  }
  setM3u8Text(text) {
    this.m3u8Text = text;
    console.log("setM3u8Text", text.length);
  }
  setFrames(frames) {
    this.frames = frames;
  }
  setInfo(info) {
    this.info = info;
    this.type = info.formatType;
  }
  getDuration() {
    return Number(this.info.format.duration);
  }
  getFrame(index) {
    const item = this.frames[Number(index)];
    if (item) {
      return item;
    }
  }
}
const videoManager = new VideoManager();
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
const getVideoStream = async (req, resolve, reject) => {
  const filePath = videoManager.filePath;
  const rangeHeader = req.headers.get("Range");
  const { start, end, chunkSize, size } = await getRange(filePath, rangeHeader);
  closeStream();
  videoStream = fs.createReadStream(filePath, { start, end });
  videoStream.on("error", (error) => {
    closeStream();
    console.log("error", error);
  });
  resolve(
    new Response(videoStream, {
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
const runCMDStr = (cmd, args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
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
    console.log(`${ffprobePath} ${args.join(" ")}`);
    const data = await runCMDStr(ffprobePath, args);
    const info = JSON.parse(data);
    console.log(info);
    videoManager.setfilePath(filePath);
    return info;
  } catch (error) {
    console.log("getVideoInfo", error);
  }
  return "";
};
const getVideoFrames = (filePath, duration) => {
  return new Promise(async (resolve, reject) => {
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
    const result = [];
    let start = 0;
    keyFrames.forEach((item, i) => {
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
    result.push([start, last]);
    videoManager.setFrames(result);
    resolve(result);
  });
};
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    // 自定义协议名
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);
const getMpegtsVideo = (req, index, resolve, reject) => {
  let ffmpegProcess;
  const onKill = () => {
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
    const args = [
      "-y",
      "-i",
      filePath,
      "-threads",
      "2",
      "-max_muxing_queue_size",
      "1024",
      "-ss",
      start.toString(),
      "-t",
      time.toString(),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
      "-f",
      "mp4",
      "-movflags",
      "+frag_keyframe+empty_moov",
      "pipe:1"
    ];
    ffmpegProcess = spawn(ffmpegPath, args, {
      stdio: ["pipe", "pipe", "pipe"]
      // 确保 stdout 和 stderr 是管道
    });
    processMap.set(ffmpegProcess, ffmpegProcess);
    req.signal.addEventListener("abort", () => {
      console.log("Fetch request aborted, killing FFmpeg process...");
      onKill();
    });
    ffmpegProcess.stderr.on("data", (data) => {
    });
    ffmpegProcess.on("error", (err) => {
      console.error("Failed to start FFmpeg:", err);
      onKill();
    });
    ffmpegProcess.on("close", (code, signal) => {
      onKill();
      if (code !== 0) {
        reject(
          new Response(`FFmpeg process exited with code ${code}`, {
            status: 500
          })
        );
      } else {
      }
    });
    resolve(
      new Response(ffmpegProcess.stdout, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          ...corsHeaders
        }
      })
    );
  } catch (error) {
    onKill();
    reject(
      new Response("Error starting FFmpeg process", {
        status: 500
      })
    );
  }
};
const registerMedia = () => {
  protocol.handle("media", async (req) => {
    return new Promise(async (resolve, reject) => {
      const urlObj = new URL(req.url);
      if (urlObj.hostname === "video") {
        if (isSegVideo(videoManager.type)) {
          const index = decodeURIComponent(urlObj.searchParams.get("index") || "0");
          console.log("vide", index);
          getMpegtsVideo(req, index, resolve, reject);
        } else {
          await getVideoStream(req, resolve);
        }
      } else if (urlObj.hostname === "m3u8") {
        resolve(
          new Response(videoManager.m3u8Text, {
            status: 200,
            headers: { "Content-Type": "application/vnd.apple.mpegurl", ...corsHeaders }
          })
        );
      }
    });
  });
};
const require$1 = createRequire(import.meta.url);
const __dirname$2 = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL$1 = process.env["VITE_DEV_SERVER_URL"];
const dbPath = VITE_DEV_SERVER_URL$1 ? path.join(__dirname$2, "../db/xvideoplayer.db") : path.join(process.env.APP_ROOT, "db/xvideoplayer.db");
const sqlite3 = require$1("sqlite3").verbose();
console.log(dbPath);
const db = new sqlite3.Database(dbPath);
const TABLE = "xvideoplayer";
db.exec(`
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    filePath TEXT NOT NULL,
    duration REAL NOT NULL,
    formatType TEXT NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    importTime INT NOT NULL,
    currentTime REAL,
    frames TEXT
  )`);
const insertVideo = (data) => {
  return new Promise((resolve, reject) => {
    const keys = [];
    const values = [];
    for (const k in data) {
      const v = data[k];
      if (v !== void 0 && v !== null && v !== "") {
        keys.push(k);
        values.push(v);
      }
    }
    const insert = `INSERT INTO ${TABLE} (${keys.join(",")}) VALUES (${keys.map((a) => "?").join(",")})`;
    db.run(insert, values, (err) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};
const updateVideo = (data) => {
  return new Promise((resolve, reject) => {
    const keys = [];
    const values = [];
    for (const k in data) {
      if (k === "filePath") continue;
      const v = data[k];
      if (v !== void 0 && v !== null && v !== "") {
        keys.push(k);
        values.push(v);
      }
    }
    values.push(data.filePath);
    const update = `UPDATE ${TABLE} SET ${keys.map((a) => `${a} = ?`)} WHERE filePath = ?`;
    db.run(update, values, (err) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};
const deleteVideo = (filePath) => {
  return new Promise((resolve, reject) => {
    const del = `DELETE FROM ${TABLE} WHERE filePath = ?`;
    db.run(del, [filePath], (err) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};
const clearVideo = () => {
  return new Promise((resolve, reject) => {
    const del = `DELETE FROM ${TABLE}`;
    db.run(del, [], (err) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};
const getVideoList = () => {
  return new Promise((resolve, reject) => {
    const query = `SELECT filePath FROM ${TABLE} ORDER BY importTime DESC`;
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
      }
      resolve(rows);
    });
  });
};
const getVideoItem = (filePath) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM ${TABLE} WHERE filePath=?`;
    db.get(query, [filePath], (err, row) => {
      if (err) {
        reject(err);
      }
      resolve(row);
    });
  });
};
const closeDB = () => {
  db.close((err) => {
    if (err) console.error(err.message);
    console.log("数据库连接已关闭");
  });
};
createRequire$1(import.meta.url);
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
      nodeIntegration: false,
      // 推荐禁用，使用 preload
      contextIsolation: true,
      // 推荐启用
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  const sendVideoList = async () => {
    try {
      const list = await getVideoList();
      win == null ? void 0 : win.webContents.send(
        "video-list",
        list.map((a) => a.filePath)
      );
    } catch (error) {
      console.log(error);
    }
  };
  win.webContents.on("did-finish-load", async () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
    await sendVideoList();
  });
  ipcMain.on("video-info", async (ev, op) => {
    if (fs.existsSync(op.data)) {
      try {
        console.log(op.data);
        let item = await getVideoItem(op.data);
        if (item == null ? void 0 : item.filePath) {
          videoManager.setfilePath(op.data);
          const frames = JSON.parse(item.frames);
          videoManager.setFrames(frames);
          const data = { ...item, frames };
          videoManager.setInfo(data);
          win == null ? void 0 : win.webContents.send(op.cb, data);
        } else {
          const info = await getVideoInfo(op.data);
          const duration = Number(info.format.duration);
          let frames = [];
          if (isSegVideo(info.format.format_name)) {
            frames = await getVideoFrames(op.data, duration);
          } else {
            videoManager.setFrames([]);
          }
          const data = {
            filePath: op.data,
            duration: Number(info.format.duration),
            formatType: info.format.format_name,
            width: info.streams[0].width,
            height: info.streams[0].height,
            importTime: (/* @__PURE__ */ new Date()).getTime(),
            frames: JSON.stringify(frames),
            currentTime: 0
          };
          videoManager.setInfo(data);
          await insertVideo(data);
          win == null ? void 0 : win.webContents.send(op.cb, data);
        }
      } catch (error) {
        console.log(error);
        win == null ? void 0 : win.webContents.send(op.cb, null);
      }
    } else {
      win == null ? void 0 : win.webContents.send(op.cb, null);
    }
  });
  ipcMain.on("top-win", async (ev, tag) => {
    console.log("top-win", tag);
    win == null ? void 0 : win.setAlwaysOnTop(tag);
  });
  ipcMain.on("del-video", async (ev, op) => {
    await deleteVideo(op);
  });
  ipcMain.on("clear-video", async (ev, op) => {
    await clearVideo();
  });
  ipcMain.on("save-video", async (ev, item) => {
    await updateVideo({ filePath: item.filePath, currentTime: item.currentTime });
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("before-quit", () => {
  killProcess();
  closeDB();
});
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
  win == null ? void 0 : win.webContents.send("main-process-console", data);
}
function quitApp() {
  app.quit();
}
export {
  MAIN_DIST,
  RENDERER_DIST,
  ROOT_PATH,
  VITE_DEV_SERVER_URL,
  mainConsole,
  quitApp
};
