import path from "node:path";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import {createRequire} from "module";
// import sqlite from "sqlite3";
const require = createRequire(import.meta.url);

//https://geek-docs.com/sql/sql-ask-answer/8_hk_1708988696.html
//https://github.com/TryGhost/node-sqlite3/wiki/API
const sqlite3 = require("sqlite3").verbose();
let db: any;

const TABLE = "xvideoplayer";

export const registerDb = () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
  const dbFolder = VITE_DEV_SERVER_URL ? path.join(__dirname, "../db/") : path.join(process.env.APP_ROOT, "db/");
  if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder);
  }
  const dbPath = VITE_DEV_SERVER_URL
    ? path.join(__dirname, "../db/xvideoplayer.db")
    : path.join(process.env.APP_ROOT, "db/xvideoplayer.db");
  db = new sqlite3.Database(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE} (
    filePath TEXT NOT NULL,
    idx INT NOT NULL,  
    currentTime REAL 
  )`);
};

export type VideoDataType = {
  filePath: string;
  currentTime: number;
  idx: number;
};
const isEmpty = (v: any) => {
  return v === undefined || v === null || v === "";
};
export const insertVideo = (data: VideoDataType) => {
  return new Promise((resolve, reject) => {
    const keys: string[] = [];
    const values: any[] = [];
    for (const k in data) {
      const v = data[k as keyof typeof data];
      if (!isEmpty(v)) {
        keys.push(k);
        values.push(v);
      }
    }
    const insert = `INSERT INTO ${TABLE} (${keys.join(",")}) VALUES (${keys.map((a) => "?").join(",")})`;

    db.run(insert, values, (err: any) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};

export const updateVideo = (data: Partial<VideoDataType>) => {
  return new Promise((resolve, reject) => {
    const keys: string[] = [];
    const values: any[] = [];
    for (const k in data) {
      if (k === "filePath") continue;
      const v = data[k as keyof typeof data];
      if (!isEmpty(v)) {
        keys.push(k);
        values.push(v);
      }
    }
    values.push(data.filePath);
    const update = `UPDATE ${TABLE} SET ${keys.map((a) => `${a} = ?`)} WHERE filePath = ?`;
    db.run(update, values, (err: any) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};

export const deleteVideo = (filePath: string) => {
  return new Promise((resolve, reject) => {
    const del = `DELETE FROM ${TABLE} WHERE filePath = ?`;
    db.run(del, [filePath], (err: any) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};
export const clearVideo = () => {
  return new Promise((resolve, reject) => {
    const del = `DELETE FROM ${TABLE}`;
    db.run(del, [], (err: any) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};
export const getVideoList = () => {
  return new Promise<VideoDataType[]>((resolve, reject) => {
    const query = `SELECT filePath,idx FROM ${TABLE} ORDER BY idx ASC`;
    db.all(query, [], (err: any, rows: any[]) => {
      if (err) {
        reject(err);
      }
      resolve(rows as VideoDataType[]);
    });
  });
};
export const getVideoItem = (filePath: string) => {
  return new Promise<VideoDataType>((resolve, reject) => {
    const query = `SELECT * FROM ${TABLE} WHERE filePath=?`;
    db.get(query, [filePath], (err: any, row: any) => {
      if (err) {
        reject(err);
      }
      resolve(row as VideoDataType);
    });
  });
};
export const closeDB = () => {
  db.close((err: any) => {
    if (err) console.error(err.message);
    console.log("数据库连接已关闭");
  });
};
