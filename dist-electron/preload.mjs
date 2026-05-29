"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, listener);
  },
  off(...args) {
    const [channel, listener] = args;
    electron.ipcRenderer.removeAllListeners(channel);
    return electron.ipcRenderer.off(channel, listener);
  },
  once(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.once(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
