<template>
  <div class="video-container">
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
          @click="onAutoVideo"
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
      </div>
      <div class="video-player-wrap">
        <VideoPlayer
          :autoplay="state.autoplay"
          :speed="state.speed"
          :path="state.currentVideo"
          v-model:is-pic="state.isPic"
          ref="playerRef"
        ></VideoPlayer>
      </div>
    </div>
    <div class="video-list" ref="listRef">
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
  import {Sortable} from "@shopify/draggable";
  import {debounce} from "lodash-es";
  import {nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef} from "vue";
  import VideoPlayer from "./VideoPlayer.vue";
  import {waitAction} from "./utils/utils";
  import {speedList} from "./config";
  const playerRef = useTemplateRef<InstanceType<typeof VideoPlayer>>("playerRef");
  const listRef = useTemplateRef<HTMLDivElement>("listRef");
  const state = reactive({
    speed: Number(localStorage.getItem("speed")) || 1,
    isPic: false,
    isTopWin: Boolean(localStorage.getItem("topwin")) || false,
    autoplay: Boolean(localStorage.getItem("autoplay")) || false,
    currentVideo: "",
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
        await waitAction({
          eventName: "top-win",
          data: state.isTopWin
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
        const list = Array.from(input.files) as File[];
        addVideo(list);
      }
    };
    input.click();
  };
  let dragSort: Sortable;
  const addVideo = async (list: File[]) => {
    const obj: Record<string, number> = {};
    state.videoList.forEach((a) => {
      obj[a] = 1;
    });

    const addlist: string[] = [];
    list.forEach((a) => {
      if (obj[a.path] === undefined) {
        console.log(a.name);
        addlist.push(a.path);
      }
    });
    console.log(obj);
    if (addlist.length) {
      state.videoList.push(...addlist);
    }
    if (!state.currentVideo) {
      onItem(state.videoList[0]!);
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
    const children = Array.from(listRef.value!.children) as HTMLElement[];
    const obj: Record<string, number> = {};
    children.forEach((a, i) => {
      obj[a.title] = i;
    });
    state.videoList.sort((a, b) => (obj[a] || 0) - (obj[b] || 0));
  }, 100);

  const onItem = debounce(async (path: string) => {
    state.currentVideo = path;
  }, 100);
  const onDel = debounce((idx: number) => {
    state.videoList.splice(idx, 1);
    playerRef.value!.onPause();
  }, 100);

  const onAutoVideo = () => {
    state.autoplay = !state.autoplay;
    localStorage.setItem("autoplay", state.autoplay + "");
  };
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
    if (dragSort) {
      dragSort.destroy();
    }
    document.removeEventListener("dragover", onDragOver);
    document.removeEventListener("drop", onDropFile);
    window.ipcRenderer.off("main-process-console", onMsg);
    window.ipcRenderer.off("video-list", onVideoList);
  });
</script>
