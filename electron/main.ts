import {app, BrowserWindow, ipcMain} from "electron";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {getVideoInfo, registerMedia} from "./VideoFFmpeg";

const require = createRequire(import.meta.url);
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
      preload: path.join(__dirname, "preload.mjs")
    }
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });
  ipcMain.on("video-info", async (ev: any, op: any) => {
    if (op.data.path) {
      try {
        const info = (await getVideoInfo(op.data.path)) as any;
        win?.webContents.send(op.cb, info);
      } catch (error) {
        console.log(error);
      }
    }
  });
  ipcMain.on("top-win", async (ev: any, tag: boolean) => {
    win?.setAlwaysOnTop(tag);
  });
  ipcMain.on("save-video", async (ev: any, op: any) => {});

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({mode: "detach"});
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

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
  console.log("mainConsole", data);
  win?.webContents.send("main-process-console", data);
}
