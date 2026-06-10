<template>
  <div :class="['video-player', state.isSeg ? 'seg' : '']">
    <div class="video-canvas" ref="containerRef" @click="togglePlay">
      <canvas ref="canvasRef" v-show="path"></canvas>
      <div v-show="!path" class="video-empty" @click="openFile">请选择文件</div>
    </div>
    <video ref="videoRef1" class="video1" controls />
    <video ref="videoRef2" class="video2" controls />
    <div class="video-contols" v-if="path">
      <PlayBar
        :total="state.duration"
        v-model:is-play="state.isPlay"
        @play="onPlay"
        @pause="onPause"
        v-model:time="state.currentTime"
        @seek="onSeek"
      ></PlayBar>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {onBeforeUnmount, onMounted, reactive, useTemplateRef, watch, ref} from "vue";
  import {ResizeUtil} from "./utils/ResizeUtil";
  import PlayBar from "./PlayBar.vue";
  import {convertBase64UrlToFile, downloadFile, getBlob, isSegVideo, sleep, waitAction} from "./utils/utils";
  import {debounce} from "lodash-es";

  const props = withDefaults(defineProps<{path: string; autoplay?: boolean; isPic?: boolean; speed?: number}>(), {
    speed: 1
  });
  const emit = defineEmits(["update:isPic", "next", "pause", "open"]);
  const containerRef = useTemplateRef<HTMLDivElement>("containerRef");
  const canvasRef = useTemplateRef<HTMLCanvasElement>("canvasRef");
  const ctxRef = ref<CanvasRenderingContext2D>();
  const videoDOM = ref<HTMLVideoElement>();
  const videoRef1 = useTemplateRef<HTMLVideoElement>("videoRef1");
  const videoRef2 = useTemplateRef<HTMLVideoElement>("videoRef2");
  const state = reactive({
    isPlay: false,
    loading: false,
    duration: 0,
    currentTime: 0,
    type: "mp4",
    isSeg: false,
    width: 1080,
    height: 1920,
    isOk: false,
    frames: [] as Array<[number, number]>,
    segIndex: 0,
    isLock: false
  });
  const cacheData = new Map<number, Blob>();
  const statusCache = new Map<number, boolean>();
  const urlCache = new Map<number, string>();
  const isPicture = ref(props.isPic);
  let interval: any;
  let animate: any;
  let resizeUtil: ResizeUtil;
  const togglePlay = () => {
    state.isPlay = !state.isPlay;
    if (state.isPlay) {
      onPlay();
    } else {
      onPause();
    }
  };
  const onDraw = () => {
    const ctx = ctxRef.value!;
    const video = videoDOM.value;
    if (video && canvasRef.value && video.videoWidth && video.videoHeight) {
      ctx.drawImage(video, 0, 0, canvasRef.value.width, canvasRef.value.height);
    }

    if (state.isPlay) {
      animate = requestAnimationFrame(onDraw);
    }
  };
  const onPlay = () => {
    if (!state.isOk) return;
    if (animate) {
      cancelAnimationFrame(animate);
    }
    videoDOM.value!.play();

    onDraw();
    state.isPlay = true;
  };
  const openFile = () => {
    emit("open");
  };
  const onPause = () => {
    if (!state.isOk) return;
    if (interval) {
      clearInterval(interval);
    }
    if (animate) {
      cancelAnimationFrame(animate);
    }
    videoDOM.value!.pause();
    state.isPlay = false;
    emit("pause");
  };
  const onTimePlay = debounce(async () => {
    emit("pause");

    statusCache.set(state.segIndex, true);
    await getCurrentVideo(state.segIndex);
    const dom = state.segIndex % 2 === 0 ? videoRef1.value! : videoRef2.value!;

    const f = state.frames[state.segIndex];

    if (state.isPlay) {
      await waitForVideo(dom);
      dom.currentTime = state.currentTime - f[0];
    } else {
      videoDOM.value = dom;
      onDraw();
    }
    statusCache.set(state.segIndex + 1, true);
    getCurrentVideo(state.segIndex + 1);
  }, 100);

  const onSeek = async (time: number) => {
    if (time < 0) {
      time = 0;
    } else if (time > state.duration) {
      time = state.duration;
    }

    if (state.isSeg) {
      for (let i = 0; i < state.frames.length; i++) {
        statusCache.set(i, false);
      }
      for (let i = 0; i < state.frames.length; i++) {
        const f = state.frames[i];

        if (f[0] >= time && time < f[0] + f[1]) {
          if (videoDOM.value) videoDOM.value.pause();
          resetVideo();
          state.currentTime = time;
          state.segIndex = i;
          console.log("seek", i, time);
          onTimePlay();
          break;
        }
      }
    } else {
      videoDOM.value!.currentTime = time;
      if (state.isPlay) {
        onPlay();
      } else {
        onDraw();
      }
    }
  };
  const onResize = () => {
    const container = containerRef.value!;
    const canvas = canvasRef.value!;
    const scale = Math.min(container.offsetHeight / state.height, container.offsetWidth / state.width);

    canvas.height = Math.round(scale * state.height);
    canvas.width = Math.round(scale * state.width);
  };
  const resetVideo = () => {
    {
      videoRef1.value!.onloadeddata = null;
      videoRef1.value!.ontimeupdate = null;
      videoRef1.value!.onended = null;
    }
    {
      videoRef2.value!.onloadeddata = null;
      videoRef2.value!.ontimeupdate = null;
      videoRef2.value!.onended = null;
    }
  };
  const onTimeUpdate = () => {
    if (state.isLock) return;
    const frame = state.frames[state.segIndex];
    if (frame) {
      state.currentTime = frame[0] + videoDOM.value!.currentTime;
    }
  };
  const waitForVideo = (dom: HTMLVideoElement) => {
    return new Promise((resolve) => {
      if (interval) {
        clearInterval(interval);
      }
      interval = setInterval(() => {
        if (urlCache.get(state.segIndex)) {
          clearInterval(interval);
          videoDOM.value = dom;
          playVideo();
          resolve(true);
        }
      }, 100);
    });
  };
  const onSegEnd = async () => {
    if (state.segIndex + 1 < state.frames.length && state.isPlay) {
      resetVideo();
      statusCache.delete(state.segIndex);
      URL.revokeObjectURL(urlCache.get(state.segIndex)!);
      urlCache.delete(state.segIndex);
      state.segIndex++;
      console.log("next", state.segIndex);
      const dom = state.segIndex % 2 === 0 ? videoRef1.value! : videoRef2.value!;
      await waitForVideo(dom);
      if (state.segIndex + 1 < state.frames.length) {
        statusCache.set(state.segIndex + 1, true);
        getCurrentVideo(state.segIndex + 1);
      }
    } else {
      if (props.autoplay) {
        emit("next");
      }
    }
  };

  const getCurrentVideo = async (segIndex: number, retry: number = 0) => {
    if (segIndex < state.frames.length) {
      try {
        const startTime = window.performance.now();
        let data: Blob;
        if (cacheData.has(segIndex)) {
          data = cacheData.get(segIndex)!;
        } else {
          data = await getBlob(`media://video?index=${segIndex}&file="${props.path}`);
          cacheData.set(segIndex, data);
        }

        if (statusCache.get(segIndex)) {
          const url = URL.createObjectURL(data);
          const t = ((window.performance.now() - startTime) / 1000).toFixed(2);
          if (segIndex % 2 === 0) {
            console.log("videoRef1", segIndex, t);
            videoRef1.value!.src = url;
            videoRef1.value!.title = segIndex + "";
            videoRef1.value!.load();
          } else {
            console.log("videoRef2", segIndex, t);
            videoRef2.value!.src = url;
            videoRef1.value!.title = segIndex + "";
            videoRef2.value!.load();
          }
          urlCache.set(segIndex, url);
        }
      } catch (error) {
        console.log("getCurrentVideo error", error);
        if (retry < 3) await getCurrentVideo(segIndex, retry + 1);
      }
    }
  };

  const playVideo = () => {
    const video = videoDOM.value!;
    video.onloadeddata = () => {
      onPlay();
    };
    video.playbackRate = props.speed;
    video.ontimeupdate = onTimeUpdate;
    video.onended = onSegEnd;
    onPlay();
  };
  const onInit = async () => {
    if (props.path === "") return;
    state.isOk = false;

    if (animate) {
      cancelAnimationFrame(animate);
    }
    statusCache.clear();
    cacheData.clear();
    urlCache.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    urlCache.clear();
    resetVideo();

    const res = await waitAction(
      {
        eventName: "video-info",
        data: props.path
      },
      true
    );
    if (res) {
      console.log(res);

      state.type = res.formatType;
      state.duration = Number(res.duration);
      state.width = res.width;
      state.height = res.height;
      state.frames = res.frames;
      state.currentTime = res.currentTime;
      if (state.currentTime >= state.duration - 3) {
        state.currentTime = 0;
      }
      onResize();
      if (isSegVideo(state.type)) {
        state.isSeg = true;
        state.isOk = true;
        state.isPlay = true;
        if (state.currentTime > 0) {
          onSeek(state.currentTime);
        } else {
          state.segIndex = 0;
          statusCache.set(0, true);
          await getCurrentVideo(0);
          await waitForVideo(videoRef1.value!);
          statusCache.set(1, true);
          getCurrentVideo(1);
        }
      } else {
        state.isSeg = false;
        videoDOM.value = videoRef1.value!;
        const video = videoDOM.value;
        video.src = "media://video?file=" + props.path;
        video.onloadeddata = () => {
          state.isOk = true;
          state.isPlay = true;
          video.currentTime = state.currentTime;
          video.playbackRate = props.speed;
          onResize();
          onPlay();
        };
        video.ontimeupdate = () => {
          console.log("current", video.currentTime);
          state.currentTime = video.currentTime;
        };
        video.onended = () => {
          onPause();
        };
      }
    } else {
      alert("视频文件读取失败！");
    }
  };

  watch(
    () => props.speed,
    (v) => {
      if (videoDOM.value) videoDOM.value.playbackRate = v;
    }
  );
  const captureVideo = debounce(() => {
    const canvas = document.createElement("canvas");

    canvas.height = videoDOM.value!.videoHeight;
    canvas.width = videoDOM.value!.videoWidth;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoDOM.value!, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/png");
    const fileName = new Date().getTime() + ".png";
    const file = convertBase64UrlToFile(image, fileName);
    downloadFile(file, file.name);
  }, 100);

  const onPicture = debounce(() => {
    isPicture.value = !isPicture.value;

    if (isPicture.value) {
      videoDOM.value!.requestPictureInPicture();
    } else {
      document.exitPictureInPicture();
    }
    emit("update:isPic", isPicture.value);
  }, 100);

  const onkeyup = (e: KeyboardEvent) => {
    let time = 0;
    switch (e.code) {
      case "ArrowRight":
        time = 5;
        break;
      case "ArrowLeft":
        time = -5;
        break;
      case "Space":
        togglePlay();

        return;
    }
    if (time !== 0) {
      state.currentTime += time;
      onSeek(state.currentTime);
    }
  };
  onMounted(() => {
    const containerDom = containerRef.value!;
    resizeUtil = new ResizeUtil(containerDom, () => {
      if (state.isOk) {
        onResize();
        onDraw();
      }
    });
    document.addEventListener("keyup", onkeyup);
    const ctx = canvasRef.value!.getContext("2d")!;
    ctxRef.value = ctx;
  });
  onBeforeUnmount(() => {
    onPause();
    document.removeEventListener("keyup", onkeyup);
    if (resizeUtil) resizeUtil.destroy();
  });
  defineExpose({
    captureVideo,
    onPicture,
    onPlay,
    onPause,
    onInit,
    state
  });
</script>
