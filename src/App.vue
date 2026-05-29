<template>
  <div class="video-container">
    <div class="video-content">
      <div class="video-title">
        <span @click="openVideo" class="video-tool">打开文件</span>

        <span @click="preVideo" class="video-tool">上一个</span>
        <span @click="nextVideo" class="video-tool">下一个</span>
        <select v-model="currentSpeed" @change="onSpeed()">
          <option v-for="item in speedList" :value="item.value">{{ item.label }}</option>
        </select>

        <span @click="onAutoVideo" :class="['video-tool', autoVideo ? 'active' : '']">自动播放</span>
        <span style="flex: 1"></span>
        <span @click="onTopWin" :class="['video-tool', isTopWin ? 'active' : '']">置顶</span>
        <span @click="captureVideo" class="video-tool">截图</span>
        <span @click="onPicture" :class="['video-tool', videoPicture ? 'active' : '']">画中画</span>

        <span @click="clearAll('video')" class="video-tool">清空视频</span>
        <span @click="clearAll('history')" class="video-tool">清空历史</span>
      </div>
      <div class="video-player" @click.self="togglePlay">
        <video ref="videoRef" :autoplay="autoVideo" preload="none"></video>

        <div class="video-control" v-show="currentItem">
          <PlayBar
            v-model:time="startTime"
            @play="onPlay"
            @pause="onPause"
            @seek="onSeek"
            :total="Math.ceil(videoInfo.duration)"
            v-model:is-play="isPlay"
          ></PlayBar>
        </div>
      </div>
    </div>
    <div class="video-list" ref="listRef">
      <div
        v-for="(item, idx) in videoList"
        :key="idx"
        :class="['video-item', currentVideo === item.name ? 'active' : '', 'item-draggable']"
        :title="item.name"
      >
        <i class="iconfont icon-list1"></i>
        <span @click="onItem(item)"> {{ item.name }}</span>

        <i class="iconfont icon-delete" @click="onDel(idx, item.name)"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import Hls from "hls.js";
  import PlayBar from "./PlayBar.vue";

  import {convertBase64UrlToFile, downloadFile, playMedia, VideoPlayer, waitAction} from "./utils/utils";
  import {Sortable} from "@shopify/draggable";
  import {debounce} from "lodash-es";
  import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef} from "vue";

  const speedList = [
    {label: "x1", value: 1.0},
    {label: "x1.25", value: 1.25},
    {label: "x1.5", value: 1.5},
    {label: "x1.75", value: 1.75},
    {label: "x2", value: 2.0}
  ];

  const SPEED_KEY = "video-speed";
  const AUTO_KEY = "video-auto";

  const HISTORY_KEY = "video-hidtory";

  const currentSpeed = ref(1.5);
  const startTime = ref(0);
  const autoVideo = ref(true);
  const isTopWin = ref(false);
  const videoPicture = ref(false);
  const currentVideo = ref<string>("");
  const isPlay = ref(false);
  const videoInfo = ref({
    duration: 10,
    type: "h265"
  });
  const onPlay = () => {
    videoRef.value!.play();
  };
  const togglePlay = () => {
    isPlay.value = !isPlay.value;
    if (isPlay.value) {
      videoRef.value!.play();
    } else {
      onPause();
    }
  };
  const onTopWin = () => {
    isTopWin.value = !isTopWin.value;
    window.ipcRenderer.send("top-win", isTopWin.value);
  };
  const currentItem = ref<any>();
  const historyMap = ref<Record<string, number>>({});

  const videoRef = useTemplateRef<HTMLVideoElement>("videoRef");
  const listRef = useTemplateRef<HTMLDivElement>("listRef");

  const videoList = ref<File[]>([]);

  const onPicture = debounce(() => {
    videoPicture.value = !videoPicture.value;

    const videoDOM = videoRef.value!;
    if (videoPicture.value) {
      videoDOM.requestPictureInPicture();
    } else {
      document.exitPictureInPicture();
    }
  }, 100);
  const openVideo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp4";
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) {
        const list = Array.from(input.files) as File[];
        addVideo(list);
      }
    };
    input.click();
  };
  let dragSort: Sortable;
  const addVideo = async (list: File[]) => {
    const obj: Record<string, number> = {};
    videoList.value.forEach((a) => {
      obj[a.name] = 1;
    });

    const addlist: File[] = [];
    list.forEach((a) => {
      if (obj[a.name] === undefined) {
        console.log(a.name);
        addlist.push(a);
      }
    });
    console.log(obj);
    if (addlist.length) {
      videoList.value.push(...addlist);
    }
    if (!currentVideo.value) {
      onItem(videoList.value[0]!);
    }
    await nextTick();
    //拖拽排序
    if (dragSort) {
      dragSort.destroy();
    }
    dragSort = new Sortable(listRef.value!, {
      draggable: ".item-draggable",
      handle: ".icon-list1",
      mirror: {
        appendTo: ".video-list",
        constrainDimensions: true
      }
    });
    dragSort.on("sortable:sorted", sortEnd);
  };
  const sortEnd = debounce(() => {
    const children = Array.from(videoRef.value!.children) as HTMLElement[];
    const obj: Record<string, number> = {};
    children.forEach((a, i) => {
      obj[a.title] = i;
    });
    videoList.value.sort((a, b) => (obj[a.name] || 0) - (obj[b.name] || 0));
  }, 100);

   const isWeb=computed(()=>{
    
   })
  const player = new VideoPlayer();
  const videoUrl = () => {
    return `media://video?type=${videoInfo.value.type}&duration=${videoInfo.value.duration}&start=${Math.floor(startTime.value / 10)}&file=${currentItem.value.path}`;
  };
  const onItem = debounce(async (item: File) => {
    const videoDOM = videoRef.value!;
    currentVideo.value = item.name;
    document.title = item.path;

    try {
      const res = await waitAction(
        {
          eventName: "video-info",
          data: {
            path: item.path
          }
        },
        true
      );
      console.log("videoInfo", res);

      videoInfo.value = {
        duration: Number(res.format.duration),
        type: res.format.format_name
      };
      console.log(videoInfo.value.type, videoInfo.value.duration);
      currentItem.value = item;
      let progress = historyMap.value[currentVideo.value] || 0;
      if (progress >= videoInfo.value.duration - 3) {
        progress = 0;
      }

      if (progress) {
        startTime.value = progress;
      }
      if (videoInfo.value.type === "h265") {
        videoDOM.src = videoUrl();
        player.init(videoDOM, currentItem.value.path, videoInfo.value.type, videoInfo.value.duration, startTime.value);
      } else {
        videoDOM.src = `media://video?type=${videoInfo.value.type}&duration=${videoInfo.value.duration}&file=${currentItem.value.path}`;

        videoDOM.currentTime = startTime.value;
      }

      videoDOM.playbackRate = currentSpeed.value;

      isPlay.value = true;
      onPlay();
    } catch (error) {
      console.log(error);
    }
  }, 100);
  const onDel = debounce((idx: number, name: string) => {
    videoList.value.splice(idx, 1);
    delete historyMap.value[name];
    videoRef.value!.pause();
  }, 100);
  const clearAll = debounce((type: string) => {
    videoRef.value!.pause();
    videoList.value = [];
    if (type === "history") {
      historyMap.value = {};
      localStorage.setItem(HISTORY_KEY, "{}");
    }
  }, 100);
  const onSpeed = () => {
    const value = currentSpeed.value;
    localStorage.setItem(SPEED_KEY, value + "");
    videoRef.value!.playbackRate = value;
  };
  const onAutoVideo = () => {
    autoVideo.value = !autoVideo.value;
    localStorage.setItem(AUTO_KEY, autoVideo.value + "");
  };
  const nextVideo = debounce(() => {
    if (currentVideo.value) {
      const index = videoList.value.findIndex((a) => a.name === currentVideo.value);
      if (index >= 0 && index + 1 < videoList.value.length) {
        onItem(videoList.value[index + 1]!);
      }
    }
  }, 100);
  const preVideo = debounce(() => {
    if (currentVideo.value) {
      const index = videoList.value.findIndex((a) => a.name === currentVideo.value);
      if (index >= 0 && index - 1 >= 0) {
        onItem(videoList.value[index - 1]!);
      }
    }
  }, 100);
  const captureVideo = debounce(() => {
    const canvas = document.createElement("canvas");
    const videoDOM = videoRef.value!;
    canvas.height = videoDOM.videoHeight;
    canvas.width = videoDOM.videoWidth;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoDOM, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/png");
    const fileName = new Date().getTime() + ".png";
    const file = convertBase64UrlToFile(image, fileName);
    downloadFile(file, file.name);
  }, 100);

  //拖入添加文件
  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault();
  };
  const onDropFile = (ev: DragEvent) => {
    ev.preventDefault();
    let fileList: File[] = [];
    if (ev.dataTransfer?.items?.length) {
      const items = ev.dataTransfer.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        if (item.type === "file") {
          const f = item.getAsFile()!;
          if (f.name.endsWith(".mp4")) {
            fileList.push(f);
          }
        }
      }
    }
    if (fileList.length === 0 && ev.dataTransfer?.files?.length) {
      fileList = Array.from(ev.dataTransfer.files).filter((it) => it.name.endsWith(".mp4"));
    }
    if (fileList.length) {
      addVideo(fileList);
    }
  };
  const onTime = () => {
    const videoDOM = videoRef.value!;

    if (videoInfo.value.type === "h265") {
      startTime.value = Math.floor(startTime.value / 10) * 10 + videoDOM.currentTime;
    } else {
      startTime.value = videoDOM.currentTime;
    }
  };

  const onSeek = () => {
    if (videoInfo.value.type === "h265") {
      // videoRef.value!.src = videoUrl();
      player.play(startTime.value);
    } else {
      videoRef.value!.currentTime = startTime.value;
    }
  };
  const onPause = () => {
    if (currentVideo.value) {
      const videoDOM = videoRef.value!;

      onTime();

      historyMap.value[currentVideo.value] = startTime.value;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyMap.value));
      isPlay.value = false;
      videoDOM.pause();
    }
  };

  onMounted(async () => {
    document.title = "video";
    const videoDOM = videoRef.value!;

    const s = localStorage.getItem(SPEED_KEY);
    if (s) {
      const v = Number(s);
      videoDOM.playbackRate = v;
      currentSpeed.value = v;
    }

    const auto = localStorage.getItem(AUTO_KEY);
    if (auto) {
      autoVideo.value = Boolean(auto);
    }

    const his = localStorage.getItem(HISTORY_KEY);
    if (his) {
      historyMap.value = JSON.parse(his);
    }
    videoDOM.onloadeddata = () => {
      if (currentVideo.value) {
        console.log("startTime", startTime.value);
        console.log("duration", videoDOM.duration);
        videoDOM.playbackRate = currentSpeed.value;
        if (isPlay.value) {
          videoDOM.play();
        }
      }
    };
    videoDOM.ontimeupdate = onTime;

    videoDOM.onended = () => {
      if (isPlay.value)
        if (autoVideo.value && startTime.value >= videoInfo.value.duration) {
          nextVideo();
        } else if (videoInfo.value.type === "h265" && startTime.value < videoInfo.value.duration) {
          // startTime.value++;
          console.log("startTime", startTime.value);

          // videoDOM.pause();
          player.play(startTime.value);
          onPlay();
        }
    };
    //退出画中画
    videoDOM.onleavepictureinpicture = () => {
      videoPicture.value = false;
    };
    videoDOM.onenterpictureinpicture = () => {
      videoPicture.value = true;
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDropFile);
  });
  onBeforeUnmount(() => {
    if (dragSort) {
      dragSort.destroy();
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyMap.value));
    document.removeEventListener("dragover", onDragOver);
    document.removeEventListener("drop", onDropFile);
  });
  window.ipcRenderer.on("main-process-console", (_event: any, data: any) => {
    console.log("main-process-console", data);
  });
</script>
