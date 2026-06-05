<template>
  <div :class="['video-player', state.isSeg ? 'seg' : '']">
    <div class="video-canvas" ref="containerRef" @click="togglePlay">
      <canvas ref="canvasRef"></canvas>
    </div>
    <video ref="videoRef1" class="video1" controls />
    <video ref="videoRef2" class="video2" controls />
    <div class="video-contols">
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
  const emit = defineEmits(["update:isPic", "next"]);
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
  const onPause = () => {
    if (!state.isOk) return;
    if (animate) {
      cancelAnimationFrame(animate);
    }
    videoDOM.value!.pause();
    state.isPlay = false;
  };
  const onSeek = debounce(async (time: number) => {
    console.log("seek", time);
    if (state.isSeg) {
      for (let i = 0; i < state.frames.length; i++) {
        const f = state.frames[i];
        if (f[0] >= time && time < f[0] + f[1]) {
          state.isLock = true;
          videoDOM.value!.pause();
          resetVideo();
          state.segIndex = i;
          getCurrentVideo();
          videoDOM.value!.currentTime = time - f[0];
          await sleep(500);
          state.isLock = false;
          getNextVideo();
          if (state.isPlay) {
            playVideo();
          } else {
            onDraw();
          }

          break;
        }
      }
    } else {
      videoDOM.value!.currentTime = time;
      await sleep(100);
      onDraw();
    }
  }, 100);
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
      return;
      state.type = res.format.format_name;
      state.duration = Number(res.format.duration);
      state.width = res.streams[0].width;
      state.height = res.streams[0].height;
      state.frames = res.frames;
      if (isSegVideo(state.type)) {
        state.isSeg = true;
        state.segIndex = 0;
        getCurrentVideo();
        videoDOM.value = videoRef1.value!;
        await sleep(100);
        getNextVideo();
        playVideo();
      } else {
        videoDOM.value = videoRef1.value!;
        const video = videoDOM.value;
        video.src = "media://video?file=" + props.path;
        video.onloadeddata = () => {
          state.isOk = true;
          state.isPlay = true;
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
    () => props.path,
    (v: string) => {
      state.isOk = false;
      if (v) onInit();
    }
  );
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
    console.log(e.key);
    let time = 0;
    switch (e.key) {
      case "ArrowRight":
        time = 5;
        break;
      case "ArrowLeft":
        time = -5;
        break;
    }
    if (time !== 0) {
      videoDOM.value!.pause();
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
    onInit
  });
</script>

<style lang="scss" scoped>
  .video-player {
    height: 100%;
    width: 100%;
    .video-canvas {
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      > canvas {
        pointer-events: none;
      }
    }
    video {
      opacity: 0;
      position: absolute;
      pointer-events: none;
    }
    .video-contols {
      position: absolute;
      z-index: 3;
      left: 0px;
      bottom: 0px;
      width: calc(100% - 200px);
      display: none;
    }
    &:hover {
      .video-contols {
        display: block;
      }
    }
  }
</style>
