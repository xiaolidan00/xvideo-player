<template>
  <div :class="['video-container', state.isMenu ? 'is-menu' : '']">
    <div class="video-content">
      <div class="video-title">
        <i @click="openVideo" class="video-tool iconfont icon-open_file"></i>

        <i @click="preVideo" title="上一集" class="video-tool iconfont icon-next pre"></i>
        <i @click="nextVideo" title="下一集" class="video-tool iconfont icon-next"></i>

        <span style="flex: 1"></span>
        <select v-model="state.speed" @change="onAction('speed')">
          <option v-for="item in speedList" :value="item.value">{{ item.label }}</option>
        </select>
        <i
          @click="onAction('autoplay')"
          title="自动播放"
          :class="['video-tool', 'iconfont', 'icon-Autoplay', state.autoplay ? 'active' : '']"
        ></i>
        <i
          @click="onAction('topwin')"
          :class="['video-tool', 'iconfont icon-zhiding', state.isTopWin ? 'active' : '']"
          title="置顶"
        ></i>
        <i
          @click="onAction('capture')"
          v-if="state.currentVideo"
          title="截图"
          class="video-tool iconfont icon-jietu"
        ></i>
        <!-- <i
          @click="onAction('picture')"
          title="画中画"
          v-if="currentPath"
          :class="['video-tool', 'iconfont icon-huazhonghua', state.isPic ? 'active' : '']"
        ></i> -->

        <!-- <i class="video-tool" @click="onAction('fix')" title="修复画面与声音不同步" v-if="state.currentVideo">fix</i> -->
        <span class="video-tool" title="空格-暂停播放，左右箭头-快进后退5s">?</span>
        <i class="video-tool iconfont icon-delete" title="清空文件列表" @click="onAction('clear')"></i>
        <i
          :class="['video-tool iconfont icon-caidan', state.isMenu ? 'active' : '']"
          @click="onAction('menu')"
          title="展开/收起菜单"
        ></i>
      </div>
      <div class="video-player-wrap">
        <VideoPlayer
          :autoplay="state.autoplay"
          :speed="state.speed"
          :path="state.currentVideo"
          v-model:is-pic="state.isPic"
          :item="state.videoItem"
          ref="playerRef"
          @open="openVideo"
          @next="nextVideo"
          @current="updateCurrent"
        ></VideoPlayer>
      </div>
    </div>
    <div class="video-list" ref="listRef">
      <div class="video-empty" v-if="videoList.length === 0" @click="openVideo">请添加文件</div>
      <div
        v-for="(item, idx) in videoList"
        :key="item.filePath"
        :class="['video-item', state.currentVideo === item.filePath ? 'active' : '', 'item-draggable']"
        :title="item.filePath"
      >
        <i class="iconfont icon-list"></i>
        <span @click="onItem(item.filePath)" class="video-item-text"> {{ formatName(item.filePath) }}</span>
        <i class="video-percent" v-if="item.duration">{{ getPercent(item) }}%</i>
        <i class="iconfont icon-delete" @click="onDel(idx)"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {debounce} from "lodash-es";
  import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch} from "vue";
  import VideoPlayer from "./VideoPlayer.vue";
  import {waitAction} from "./utils/utils";
  import {formatName, getPercent, speedList, VideoItemType} from "./config";
  import {Sortable} from "@shopify/draggable";
  const listRef = useTemplateRef<HTMLDivElement>("listRef");
  const playerRef = useTemplateRef<InstanceType<typeof VideoPlayer>>("playerRef");
  let dragSort: Sortable;

  const videoList = ref<VideoItemType[]>([]);
  const state = reactive({
    speed: Number(localStorage.getItem("speed")) || 1,
    isPic: false,
    isMenu: localStorage.getItem("menu") === "true",
    isTopWin: localStorage.getItem("topwin") === "true",
    autoplay: localStorage.getItem("autoplay") === "true",
    currentVideo: "",
    videoItem: null as any
  });

  const onAction = async (type: string) => {
    switch (type) {
      case "capture":
        playerRef.value!.captureVideo();
        break;
      // case "picture":
      //   playerRef.value!.onPicture();
      //   break;

      case "topwin":
        state.isTopWin = !state.isTopWin;
        localStorage.setItem("topwin", state.isTopWin + "");
        await waitAction({
          eventName: "top-win",
          data: state.isTopWin
        });
        break;
      // case "fix":
      //   await waitAction({
      //     eventName: "sync-video"
      //   });
      //   alert("修复命令已执行，请耐心等待");
      //   break;

      case "menu":
        state.isMenu = !state.isMenu;
        localStorage.setItem("menu", state.isMenu + "");
        break;
      case "autoplay":
        state.autoplay = !state.autoplay;
        localStorage.setItem("autoplay", state.autoplay + "");
        break;
      case "clear":
        videoList.value = [];
        state.currentVideo = "";
        await waitAction({
          eventName: "clear-video"
        });
        break;
      case "speed":
        localStorage.setItem("speed", state.speed + "");
        break;
    }
  };

  const openVideo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp4";
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) {
        addVideo(Array.from(input.files));
      }
    };
    input.click();
  };
  const sortEnd = debounce(() => {
    const children = Array.from(listRef.value!.children) as HTMLElement[];
    const obj: Record<string, number> = {};
    children.forEach((a, i) => {
      obj[a.title] = i;
    });
    videoList.value.forEach((item) => {
      item.idx = Number(obj[item.filePath]);
    });
    videoList.value.sort((a, b) => a.idx - b.idx);

    window.ipcRenderer.send(
      "save-all-video",
      videoList.value.map((a) => ({filePath: a.filePath, idx: a.idx}))
    );
  }, 1000);
  const onDragList = () => {
    if (dragSort) {
      dragSort.destroy();
    }
    if (videoList.value.length) {
      dragSort = new Sortable(listRef.value!, {
        draggable: ".item-draggable",
        handle: ".icon-list",
        mirror: {
          appendTo: ".video-list",
          constrainDimensions: true
        }
      });

      dragSort.on("sortable:stop", sortEnd);
    }
  };
  const addVideo = async (files: any[]) => {
    const obj: Record<string, number> = {};
    const addList: any[] = [];
    videoList.value.forEach((f) => {
      obj[f.filePath] = 1;
    });
    const len = videoList.value.length;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!obj[file.path]) {
        addList.push({
          filePath: file.path,

          idx: addList.length + len,
          currentTime: 0,
          duration: 0
        });
        obj[file.path] = 2;
      }
    }
    if (addList.length) {
      await waitAction(
        {
          eventName: "add-video",
          data: addList
        },
        true
      );
      videoList.value.push(...addList);
      videoList.value.sort((a, b) => a.idx - b.idx);
      if (state.currentVideo === "") {
        onItem(videoList.value[0].filePath);
      }
    }
    onDragList();
  };
  const updateCurrent = (data: {filePath: string; currentTime?: number; duration?: number}) => {
    console.log("updateCurrent", data);
    const idx = videoList.value.findIndex((a) => a.filePath === data.filePath);
    if (idx >= 0) {
      if (data.currentTime !== undefined) videoList.value[idx].currentTime = data.currentTime;
      if (data.duration !== undefined) videoList.value[idx].duration = data.duration;
    }
  };
  const onItem = debounce(async (path: string) => {
    await playerRef.value!.saveCurrent();
    state.videoItem = videoList.value.find((a) => a.filePath === path);
    if (state.currentVideo !== path) {
      state.currentVideo = path;
      localStorage.setItem("video", state.currentVideo);
    }
    await nextTick();
    playerRef.value!.onInit();
  }, 100);
  const onDel = debounce(async (idx: number) => {
    const f = videoList.value[idx];

    videoList.value.splice(idx, 1);
    await waitAction({
      eventName: "del-video",
      data: f.filePath
    });
    if (f.filePath === state.currentVideo) {
      playerRef.value!.onPause();
      state.currentVideo = "";
    }
    onDragList();
  }, 100);

  const nextVideo = debounce(() => {
    if (state.currentVideo) {
      const index = videoList.value.findIndex((a) => a.filePath === state.currentVideo);
      if (index >= 0 && index + 1 < videoList.value.length) {
        onItem(videoList.value[index + 1]!.filePath);
      }
    }
  }, 100);
  const preVideo = debounce(() => {
    if (state.currentVideo) {
      const index = videoList.value.findIndex((a) => a.filePath === state.currentVideo);
      if (index >= 0 && index - 1 >= 0) {
        onItem(videoList.value[index - 1]!.filePath);
      }
    }
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

  onMounted(async () => {
    onDragList();
    document.title = "XVideoPlayer";

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDropFile);
    await waitAction({
      eventName: "top-win",
      data: state.isTopWin
    });
  });
  const onMsg = (_event: any, data: any) => {
    console.log("main-process-console", data);
  };
  const onVideoList = async (_event: any, data: any) => {
    videoList.value = data;
    console.log("video-list", videoList.value);
    if (state.currentVideo === "") {
      const p = localStorage.getItem("video");
      if (p) {
        const item = videoList.value.find((a) => a.filePath === p);
        if (item) state.currentVideo = p;
      }
    }
    await nextTick();
    onDragList();
  };

  window.ipcRenderer.on("video-list", onVideoList);
  window.ipcRenderer.on("main-process-console", onMsg);

  onBeforeUnmount(() => {
    if (dragSort) {
      dragSort.destroy();
    }

    document.removeEventListener("dragover", onDragOver);
    document.removeEventListener("drop", onDropFile);
    window.ipcRenderer.off("main-process-console", onMsg);
    window.ipcRenderer.off("video-list", onVideoList);
  });
</script>
