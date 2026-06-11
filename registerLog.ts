import log from "electron-log";
import {app} from "electron";
export const registerLog = () => {
  log.initialize();
  log.errorHandler.startCatching();
  log.transports.file.level = "info";
  log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
  log.errorHandler.startCatching();
  // 渲染进程结束
  app.on("render-process-gone", async (event, webContents, details) => {
    log.error(
      `APP-ERROR:render-process-gone; event: ${JSON.stringify(event)}; webContents:${JSON.stringify(
        webContents
      )}; details:${JSON.stringify(details)}`
    );
  });

  // 子进程结束
  app.on("child-process-gone", async (event, details) => {
    log.error(`APP-ERROR:child-process-gone; event: ${JSON.stringify(event)}; details:${JSON.stringify(details)}`);
  });
};
