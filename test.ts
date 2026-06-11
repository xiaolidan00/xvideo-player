import fs from "node:fs";
import path from "node:path";
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const videoPath = VITE_DEV_SERVER_URL ? path.join(__dirname, "../ffmpeg/") : path.join(process.env.APP_ROOT, "ffmpeg/");
let dataPath = path.join(videoPath, "data.json");
let videoList: any[] = [];
export const saveVideoData = (list: any) => {
  fs.writeFileSync(dataPath, JSON.stringify(list));
};
export const getVideoData = () => {
  if (fs.existsSync(dataPath)) {
    const data = fs.readFileSync(dataPath);
    if (data) {
      videoList = JSON.parse(data.toString()).sort((a: any, b: any) => a.index - b.index);
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
    saveVideoData(videoList);
  }
};
export const updateVideoData = (data: any) => {
  const item = videoList.find((a) => a.filePath === data.filePath);
  if (item) {
    item.currentTime = data.currentTime;
    saveVideoData(videoList);
  }
};
export const addVideoData = (filePath: string[]) => {
  const addList = filePath.map((a, i) => ({
    filePath: a,
    currentTime: 0,
    index: videoList.length + i
  }));
};
export const clearVideoData = () => {
  videoList = [];
  saveVideoData(videoList);
};
