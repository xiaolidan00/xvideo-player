import {app, BrowserWindow, ipcMain} from "electron";
import {createRequire} from "node:module";

import {fileURLToPath} from "node:url";
import path from "node:path";
import fs from "node:fs";
import {
  getVideoFrames,
  getVideoInfo,
  isSegVideo,
  killProcess,
  registerMedia,
  syncVideo,
  videoManager
} from "./VideoFFmpeg";
import {
  clearVideo,
  closeDB,
  deleteVideo,
  getVideoItem,
  getVideoList,
  insertVideo,
  registerDb,
  updateVideo
} from "./DataBaseUtil";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

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
      const list = await getVideoList();
      win?.webContents.send("video-list", list);
    } catch (error) {
      console.log(error);
    }
  };
  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", async () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());

    sendVideoList();
  });

  ipcMain.on("add-video", async (ev: any, op: any) => {
    if (op.data.length) {
      for (let i = 0; i < op.data.length; i++) {
        await insertVideo(op.data[i]);
      }
    }
    win?.webContents.send(op.cb, null);
  });
  ipcMain.on("video-info", async (ev: any, op: any) => {
    if (fs.existsSync(op.data)) {
      try {
        const filePath = op.data;
        const item = await getVideoItem(filePath);
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
          duration: duration,
          formatType: info.format.format_name,
          width: info.streams[0].width,
          height: info.streams[0].height,
          frames,
          currentTime: item.currentTime || 0
        };
        await updateVideo({
          filePath,
          duration
        });
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
    deleteVideo(op);
  });
  ipcMain.on("clear-video", async (ev: any, op: any) => {
    clearVideo();
  });
  // ipcMain.on("sync-video", async (ev: any, op: any) => {
  //   syncVideo();
  // });
  ipcMain.on("save-video", async (ev: any, item: any) => {
    updateVideo({filePath: item.filePath, currentTime: item.currentTime});
  });
  ipcMain.on("save-all-video", async (ev: any, list: any[]) => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      updateVideo({filePath: item.filePath, idx: item.idx});
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({mode: "detach"});
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.on("before-quit", async () => {
  // const data = await waitAction(
  //   {
  //     eventName: "save-current"
  //   },
  //   true
  // );
  // if (data) {
  //   await updateVideo(data);
  // }

  closeDB();
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

app.whenReady().then(async () => {
  registerDb();
  registerMedia();
  createWindow();
});

export const waitAction = (sendAction: {eventName: string; data?: any}, receive?: boolean) => {
  return new Promise<any>((resolve) => {
    if (receive) {
      const cbId = "action" + new Date().getTime();

      ipcMain.once(cbId, (_event: any, data: any) => {
        resolve(data);
      });
      win?.webContents.send(sendAction.eventName, {
        cb: cbId,
        data: sendAction.data
      });
    } else {
      win?.webContents.send(sendAction.eventName, sendAction.data);
    }

    if (!receive) resolve("");
  });
};
export function mainConsole(data: any) {
  // console.log("mainConsole", ...args);
  win?.webContents.send("main-process-console", data);
}

export function quitApp() {
  app.quit();
}
export const sleep = (time: number) => {
  return new Promise<number>((resolve) => {
    setTimeout(() => {
      resolve(time);
    }, time);
  });
};
