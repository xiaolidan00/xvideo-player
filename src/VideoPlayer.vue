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
  import {convertBase64UrlToFile, downloadFile, isSegVideo, sleep, waitAction} from "./utils/utils";
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
  const isPicture = ref(props.isPic);
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
    if (video && video.videoWidth && video.videoHeight) {
      ctx.drawImage(video, 0, 0, canvasRef.value!.width, canvasRef.value!.height);
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
    if (animate) {
      cancelAnimationFrame(animate);
    }
    videoDOM.value!.pause();
    state.isPlay = false;
    emit("pause");
  };
  const onTimePlay = debounce(async () => {
    if (state.isSeg) {
      state.isLock = true;
      if (videoDOM.value) videoDOM.value.pause();
      getCurrentVideo();
      videoDOM.value = state.segIndex % 2 === 0 ? videoRef1.value! : videoRef2.value!;

      await sleep(500);
      state.isLock = false;
      getNextVideo();
      if (state.isPlay) {
        playVideo();
      } else {
        onDraw();
      }
    } else {
      onDraw();
    }
  }, 100);

  const onSeek = async (time: number) => {
    console.log("seek", time);
    if (state.isSeg) {
      if (time >= 0 && time <= state.duration)
        for (let i = 0; i < state.frames.length; i++) {
          const f = state.frames[i];
          if (f[0] >= time && time < f[0] + f[1]) {
            resetVideo();
            videoDOM.value!.currentTime = time - f[0];
            state.currentTime = time;
            state.segIndex = i;
            onTimePlay();
            break;
          }
        }
    } else {
      videoDOM.value!.currentTime = time;
      onTimePlay();
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
      //   console.log("current", state.currentTime);
    }
  };
  const onSegEnd = () => {
    if (state.segIndex + 1 < state.frames.length) {
      state.segIndex++;
      console.log("next", state.segIndex);
      getNextVideo();
      playVideo();
    } else {
      if (props.autoplay) {
        emit("next");
      }
    }
  };
  const getCurrentVideo = () => {
    if (state.segIndex % 2 === 0) {
      videoRef1.value!.src = `media://video?index=${state.segIndex}&file="${props.path}`;

      videoRef1.value!.load();
    } else {
      videoRef2.value!.src = `media://video?index=${state.segIndex}&file="${props.path}`;

      videoRef2.value!.load();
    }
  };
  const getNextVideo = () => {
    if (state.segIndex % 2 === 0) {
      videoRef2.value!.src = `media://video?index=${state.segIndex + 1}&file="${props.path}`;
      videoRef2.value!.load();
    } else {
      videoRef1.value!.src = `media://video?index=${state.segIndex + 1}&file="${props.path}`;
      videoRef1.value!.load();
    }
  };
  const playVideo = () => {
    resetVideo();
    videoDOM.value = state.segIndex % 2 === 0 ? videoRef1.value! : videoRef2.value!;
    const video = videoDOM.value!;
    console.log(video.src);
    video.ontimeupdate = onTimeUpdate;
    video.onended = onSegEnd;

    state.isOk = true;
    state.isPlay = true;
    video.playbackRate = props.speed;
    onResize();
    onPlay();
  };
  const onInit = async () => {
    if (props.path === "") return;
    state.isOk = false;

    if (animate) {
      cancelAnimationFrame(animate);
    }

    resetVideo();
    const ctx = canvasRef.value!.getContext("2d")!;
    ctxRef.value = ctx;

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
      if (isSegVideo(state.type)) {
        state.isSeg = true;
        if (state.currentTime > 0) {
          state.isOk = true;
          state.isPlay = true;
          onSeek(res.currentTime);
        } else {
          state.segIndex = 0;
          getCurrentVideo();
          videoDOM.value = videoRef1.value!;
          await sleep(100);
          getNextVideo();
          playVideo();
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
  });
  onBeforeUnmount(() => {
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
