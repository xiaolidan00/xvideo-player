import {app, BrowserWindow, ipcMain} from "electron";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import path from "node:path";
import fs from "node:fs";
import {
  addVideoData,
  clearVideoData,
  deleteVideoData,
  getVideoData,
  getVideoDataItem,
  getVideoFrames,
  getVideoInfo,
  isSegVideo,
  killProcess,
  registerMedia,
  saveVideoData,
  updateVideoData,
  videoManager
} from "./VideoFFmpeg";

// const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_PATH = (process.env.APP_ROOT = path.join(__dirname, ".."));
console.log(ROOT_PATH);
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 600,
    autoHideMenuBar: true,
    resizable: true,
    backgroundColor: "#505050",
    icon: path.join(process.env.VITE_PUBLIC, "logo.ico"),
    webPreferences: {
      nodeIntegration: false, // 推荐禁用，使用 preload
      contextIsolation: true, // 推荐启用
      preload: path.join(__dirname, "preload.mjs")
    }
  });

  const sendVideoList = async () => {
    try {
      const list = await getVideoData();

      win?.webContents.send(
        "video-list",
        list.map((a) => a.filePath)
      );
    } catch (error) {
      console.log(error);
    }
  };
  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", async () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
    await sendVideoList();
  });

  ipcMain.on("add-video", async (ev: any, op: any) => {
    if (op.data.length) {
      addVideoData(op.data);
    }
    win?.webContents.send(op.cb, null);
  });
  ipcMain.on("video-info", async (ev: any, op: any) => {
    if (fs.existsSync(op.data)) {
      try {
        const filePath = op.data;
        const item = await getVideoDataItem(filePath);
        videoManager.setfilePath(filePath);
        const info = (await getVideoInfo(filePath)) as any;
        const duration = Number(info.format.duration);
        let frames: Array<[number, number]> = [];
        if (isSegVideo(info.format.format_name)) {
          frames = await getVideoFrames(filePath, duration);
          videoManager.setFrames(frames);
        } else {
          videoManager.setFrames([]);
        }

        const data = {
          filePath: filePath,
          duration: Number(info.format.duration),
          formatType: info.format.format_name,
          width: info.streams[0].width,
          height: info.streams[0].height,
          frames,
          currentTime: item.currentTime || 0
        };
        videoManager.setInfo(data);

        win?.webContents.send(op.cb, {...data});
      } catch (error) {
        console.log(error);
        win?.webContents.send(op.cb, null);
      }
    } else {
      win?.webContents.send(op.cb, null);
    }
  });
  ipcMain.on("top-win", async (ev: any, tag: boolean) => {
    console.log("top-win", tag);
    win?.setAlwaysOnTop(tag);
  });
  ipcMain.on("del-video", async (ev: any, op: any) => {
    deleteVideoData(op);
  });
  ipcMain.on("clear-video", async (ev: any, op: any) => {
    clearVideoData();
  });
  ipcMain.on("save-video", async (ev: any, item: any) => {
    updateVideoData({filePath: item.filePath, currentTime: item.currentTime});
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({mode: "detach"});
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("before-quit", () => {
  saveVideoData();
  killProcess();
});
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  createWindow();
  registerMedia();
});

export function mainConsole(data: any) {
  // console.log("mainConsole", ...args);
  win?.webContents.send("main-process-console", data);
}

export function quitApp() {
  app.quit();
}
