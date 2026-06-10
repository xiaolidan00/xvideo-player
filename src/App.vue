<template>
  <div :class="['video-container', state.isMenu ? 'is-menu' : '']">
    <div class="video-content">
      <div class="video-title">
        <i @click="openVideo" class="video-tool iconfont icon-open_file"></i>

        <i @click="preVideo" title="上一集" class="video-tool iconfont icon-next pre"></i>
        <i @click="nextVideo" title="下一集" class="video-tool iconfont icon-next"></i>

        <span style="flex: 1"></span>
        <select v-model="state.speed">
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

        <i class="video-tool iconfont icon-delete" title="清空文件列表" @click="onAction('clear')"></i>
        <i
          :class="['video-tool iconfont icon-caidan', state.isMenu ? 'active' : '']"
          @click="onAction('menu')"
          title="展开菜单"
        ></i>
      </div>
      <div class="video-player-wrap">
        <VideoPlayer
          :autoplay="state.autoplay"
          :speed="state.speed"
          :path="state.currentVideo"
          v-model:is-pic="state.isPic"
          ref="playerRef"
          @pause="onPause"
          @open="openVideo"
          @next="nextVideo"
        ></VideoPlayer>
      </div>
    </div>
    <div class="video-list" ref="listRef">
      <div class="video-empty" v-if="state.videoList.length === 0" @click="openVideo">请添加文件</div>
      <div
        v-for="(item, idx) in state.videoList"
        :key="idx"
        :class="['video-item', state.currentVideo === item ? 'active' : '', 'item-draggable']"
        :title="item"
      >
        <i class="iconfont icon-list1"></i>
        <span @click="onItem(item)"> {{ formatName(item) }}</span>

        <i class="iconfont icon-delete" @click="onDel(idx)"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {debounce} from "lodash-es";
  import {nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef} from "vue";
  import VideoPlayer from "./VideoPlayer.vue";
  import {waitAction} from "./utils/utils";
  import {speedList} from "./config";
  const playerRef = useTemplateRef<InstanceType<typeof VideoPlayer>>("playerRef");

  const state = reactive({
    speed: Number(localStorage.getItem("speed")) || 1,
    isPic: false,
    isMenu: localStorage.getItem("menu") === "true",
    isTopWin: localStorage.getItem("topwin") === "true",
    autoplay: localStorage.getItem("autoplay") === "true",
    currentVideo: localStorage.getItem("video") || "",
    videoList: [] as string[]
  });

  const formatName = (str: string) => {
    return str.substring(str.lastIndexOf("\\") + 1);
  };

  const onAction = async (type: string) => {
    switch (type) {
      case "capture":
        playerRef.value!.captureVideo();
        break;
      case "picture":
        playerRef.value!.onPicture();
        break;

      case "topwin":
        state.isTopWin = !state.isTopWin;
        localStorage.setItem("topwin", state.isTopWin + "");
        await waitAction({
          eventName: "top-win",
          data: state.isTopWin
        });
        break;

      case "menu":
        state.isMenu = !state.isMenu;
        localStorage.setItem("menu", state.isMenu + "");
        break;
      case "autoplay":
        state.autoplay = !state.autoplay;
        localStorage.setItem("autoplay", state.autoplay + "");
        break;
      case "clear":
        state.videoList = [];
        await waitAction({
          eventName: "clear-video"
        });
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
  const addVideo = async (files: File[]) => {
    const obj: Record<string, number> = {};
    const addList = [];
    state.videoList.forEach((f) => {
      obj[f] = 1;
    });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!obj[file.path]) {
        addList.push(file.path);
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
      state.videoList.push(...addList);
      state.videoList.sort((a, b) => obj[b] - obj[a]);
      if (state.currentVideo === "") {
        onItem(state.videoList[0]);
      }
    }
  };
  const onPause = async () => {
    if (state.currentVideo && playerRef.value) {
      await waitAction({
        eventName: "save-video",
        data: {filePath: state.currentVideo, currentTime: playerRef.value!.state.currentTime}
      });
    }
  };
  const onItem = debounce(async (path: string) => {
    onPause();
    state.currentVideo = path;
    localStorage.setItem("video", state.currentVideo);
    await nextTick();
    playerRef.value!.onInit();
  }, 100);
  const onDel = debounce(async (idx: number) => {
    const f = state.videoList[idx];

    state.videoList.splice(idx, 1);
    await waitAction({
      eventName: "del-video",
      data: f
    });
    if (f === state.currentVideo) {
      playerRef.value!.onPause();
    }
  }, 100);

  const nextVideo = debounce(() => {
    if (state.currentVideo) {
      const index = state.videoList.findIndex((a) => a === state.currentVideo);
      if (index >= 0 && index + 1 < state.videoList.length) {
        onItem(state.videoList[index + 1]!);
      }
    }
  }, 100);
  const preVideo = debounce(() => {
    if (state.currentVideo) {
      const index = state.videoList.findIndex((a) => a === state.currentVideo);
      if (index >= 0 && index - 1 >= 0) {
        onItem(state.videoList[index - 1]!);
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
    document.title = "XVideoPlayer";

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDropFile);
    await waitAction({
      eventName: "top-win",
      data: state.isTopWin
    });
    const p = localStorage.getItem("video");
    if (p) {
      state.currentVideo = p;
    }
  });
  const onMsg = (_event: any, data: any) => {
    console.log("main-process-console", data);
  };
  const onVideoList = (_event: any, data: any) => {
    console.log("video-list", data);
    state.videoList = data;
  };
  window.ipcRenderer.on("video-list", onVideoList);
  window.ipcRenderer.on("main-process-console", onMsg);
  onBeforeUnmount(() => {
    document.removeEventListener("dragover", onDragOver);
    document.removeEventListener("drop", onDropFile);
    window.ipcRenderer.off("main-process-console", onMsg);
    window.ipcRenderer.off("video-list", onVideoList);
  });
</script>
