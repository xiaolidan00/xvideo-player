export function convertBase64UrlToFile(base64: string, fileName: string) {
  let parts = base64.split(";base64,");
  let contentType = parts[0]!.split(":")[1];
  let raw = window.atob(parts[1]!);
  let rawLength = raw.length;
  let uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; i++) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new File([uInt8Array], fileName, {type: contentType});
}
export const downloadFile = (buffer: File, filename: string) => {
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.style = "display: none";
  a.download = filename;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const waitAction = (sendAction: {eventName: string; data?: any}, receive?: boolean) => {
  return new Promise<any>((resolve, reject) => {
    const cbId = "action" + new Date().getTime();

    if (receive) {
      const t = setTimeout(() => {
        reject("timeout");
      }, 10000);
      window.ipcRenderer.once(cbId, (_event: any, data: any) => {
        // console.log("🚀 ~ Controller.ts ~ waitAction", sendAction.eventName, sendAction.data, data);
        clearTimeout(t);
        resolve(data);
      });
    }
    // console.log("sendAction.eventName", sendAction.eventName, sendAction.data);
    window.ipcRenderer.send(sendAction.eventName, {
      cb: cbId,
      data: sendAction.data
    });
    if (!receive) resolve("");
  });
};

export class CanvasVideo {
  animate: any;
  canvas?: HTMLCanvasElement;
  video?: HTMLVideoElement;
  tempCanvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  tempCtx?: CanvasRenderingContext2D;
  constructor() {}
  init(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.tempCanvas = document.createElement("canvas");
    this.tempCanvas.width = video.videoWidth;
    this.tempCanvas.height = video.videoHeight;
    const ctx = this.tempCanvas.getContext("2d");
  }

  play() {}
  pause() {}
}
function fetchAB(url: string, cb: Function) {
  console.log(url);
  const xhr = new XMLHttpRequest();
  xhr.open("get", url);
  xhr.responseType = "arraybuffer";
  xhr.onload = function () {
    cb(xhr.response);
  };
  xhr.send();
}
export const playMedia = (video: HTMLVideoElement, assetURL: string) => {
  const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';

  if ("MediaSource" in window && MediaSource.isTypeSupported(mimeCodec)) {
    const mediaSource = new MediaSource();
    //console.log(mediaSource.readyState); // closed
    video.src = URL.createObjectURL(mediaSource);
    video.play();
    mediaSource.onsourceopen = () => {
      const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
      fetchAB(assetURL, (buf: ArrayBuffer) => {
        sourceBuffer.addEventListener("updateend", () => {
          //   mediaSource.endOfStream();
          video.play();
          //console.log(mediaSource.readyState); // ended
        });
        sourceBuffer.appendBuffer(buf);
      });
    };
  } else {
    console.error("Unsupported MIME type or codec: ", mimeCodec);
  }
};
export function getBlob(url: string) {
  return new Promise<Blob>((resolve, reject) => {
    fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache"
        // "Cache-Control": "public, max-age=31536000, immutable"
      }
    })
      .then((res) => {
        resolve(res.blob());
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export class VideoPlayer {
  video?: HTMLVideoElement;
  filePath: string = "";
  type: string = "h264";
  duration: number = 10;
  startTime: number = 0;
  cache: Record<string | number, Blob> = {};
  currentUrl: string = "";
  init(video: HTMLVideoElement, filePath: string, type: string, duration: number, startTime: number) {
    this.video = video;
    this.filePath = filePath;
    this.type = type;
    this.duration = duration;
    this.startTime = startTime;
    this.cache = {};
  }
  async getUrl(time: number) {
    if (time < this.duration) {
      const start = Math.floor(time / 10);
      if (!this.cache[start]) {
        const url = `media://video?type=${this.type}&duration=${this.duration}&start=${start}&file=${this.filePath}`;
        try {
          const buf = await getBlob(url);

          this.cache[start] = buf;
          return buf;
        } catch (error) {
          console.log("error", error);
        }
      } else {
        return this.cache[start];
      }
    }
    return null;
  }
  async play(time: number) {
    // const start = Math.floor(time / 10);
    // this.video!.src = `media://video?type=${this.type}&duration=${this.duration}&start=${start}&file=${this.filePath}`;
    const buf = await this.getUrl(time);
    if (buf) {
      const src = URL.createObjectURL(buf);
      this.video!.src = src;

      if (this.currentUrl) {
        URL.revokeObjectURL(this.currentUrl);
      }
      this.currentUrl = src;
    }
    await this.getUrl(time + 10);
  }
}
