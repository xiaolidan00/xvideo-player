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
export function getBlob(url: string) {
  return new Promise<Blob>((resolve, reject) => {
    fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache"
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

export const waitAction = (sendAction: {eventName: string; data?: any}, receive?: boolean) => {
  return new Promise<any>((resolve) => {
    if (receive) {
      const cbId = "action" + new Date().getTime();

      // const t = setTimeout(() => {
      //   reject("timeout");
      // }, 20000);
      window.ipcRenderer.once(cbId, (_event: any, data: any) => {
        // console.log("🚀 ~ Controller.ts ~ waitAction", sendAction.eventName, sendAction.data, data);
        // clearTimeout(t);
        resolve(data);
      });
      window.ipcRenderer.send(sendAction.eventName, {
        cb: cbId,
        data: sendAction.data
      });
    } else {
      window.ipcRenderer.send(sendAction.eventName, sendAction.data);
    }
    // console.log("sendAction.eventName", sendAction.eventName, sendAction.data);

    if (!receive) resolve("");
  });
};

export const isSegVideo = (type: string) => {
  return type === "mpegts";
};
export const sleep = (time: number) => {
  return new Promise<number>((resolve) => {
    setTimeout(() => {
      resolve(time);
    }, time);
  });
};
