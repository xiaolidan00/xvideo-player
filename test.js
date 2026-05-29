import {exec, spawn} from "child_process";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = path.join(__dirname, "./ffmpeg/ffmpeg.exe");
const filePath = "D:/2026工作/软考/最新系分-文老师/01、2026教材精讲/3.1概述-三级模式-数据库设计-数据模型.mp4";
const outFile = path.join(__dirname, "./output.mp4");
const args = [
  "-y",
  "-ss",
  "0",
  "-i",
  filePath,
  "-c:v",
  "libx264",
  "-f",
  "mp4",
  "-t",
  "10",
  "-movflags",
  "frag_keyframe+empty_moov",
  "-preset",
  "veryfast",
  outFile
];

const ffmpeg = spawn(ffmpegPath, args);

ffmpeg.stderr.on("data", (data) => {
  console.error(`stderr: ${data}`);
});
ffmpeg.stdout.on("data", (data) => {
  console.log(`stdout: ${data}`);
});

ffmpeg.on("close", (code) => {
  if (code === 0) {
    console.log("转换完成！");
  } else {
    console.log(`转换进程退出码: ${code}`);
  }
});
