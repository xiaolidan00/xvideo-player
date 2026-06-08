import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "module";
const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const dbPath = VITE_DEV_SERVER_URL
  ? path.join(__dirname, "../db/xvideoplayer.db")
  : path.join(process.env.APP_ROOT, "db/xvideoplayer.db");
//https://geek-docs.com/sql/sql-ask-answer/8_hk_1708988696.html
//https://github.com/TryGhost/node-sqlite3/wiki/API
const sqlite3 = require("sqlite3").verbose();
console.log(dbPath);
const db = new sqlite3.Database(dbPath);
const TABLE = "xvideoplayer";
db.exec(`
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    filePath TEXT NOT NULL,
    importTime INT NOT NULL,
    duration REAL,
    formatType TEXT,
    width INT,
    height INT,    
    currentTime REAL,
    frames TEXT
  )`);

export type VideoDataType = {
  filePath: string;
  duration: number;
  formatType: string;
  width: number;
  height: number;
  currentTime: number;
  importTime: number;
  frames: string;
};
export const insertVideo = (data: Partial<VideoDataType>) => {
  return new Promise((resolve, reject) => {
    const keys: string[] = [];
    const values: any[] = [];
    for (const k in data) {
      const v = data[k as keyof typeof data];
      if (v !== undefined && v !== null && v !== "") {
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
      if (v !== undefined && v !== null && v !== "") {
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
    const query = `SELECT filePath FROM ${TABLE} ORDER BY importTime DESC`;
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
