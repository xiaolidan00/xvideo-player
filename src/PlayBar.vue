<template>
  <div class="play-bar">
    <div class="play-bar-content">
      <i @click="togglePlay" :class="['iconfont', isPlay ? 'icon-pause' : 'icon-play']"></i>
      <div class="play-slider" ref="sliderRef" :style="{'--range-value': percent + '%'}">
        <div class="bar"></div>
        <div class="circle"></div>
      </div>
    </div>
    <div class="play-bar-text">{{ formatTime(theTime) || "0" }}/{{ formatTime(props.total) || "0" }}</div>
  </div>
</template>

<script setup lang="ts">
  import {debounce} from "lodash-es";
  import {ref, useTemplateRef, watch} from "vue";
  import {useDragMove} from "./utils/useDragMove";
  const sliderRef = useTemplateRef<HTMLDivElement>("sliderRef");
  const emit = defineEmits(["update:time", "update:isPlay", "play", "pause", "seek"]);

  const props = withDefaults(defineProps<{isPlay: boolean; time: number; total: number}>(), {
    time: 0,
    total: 10
  });
  const thePlay = ref(props.isPlay);
  const percent = ref("0");
  watch(
    () => props.isPlay,
    (v) => {
      if (thePlay.value != v) thePlay.value = v;
    }
  );

  const formatTime = (time: number) => {
    let t = time + 0;
    let h = 0;
    let m = 0;
    let s = 0;
    if (t > 3600) {
      h = Math.floor(t / 3600);
      t -= h * 3600000;
    }
    if (t > 60) {
      m = Math.floor(t / 60);
      t -= m * 60;
    }
    if (t > 1) {
      s = Math.floor(t);
    }
    return `${h > 0 ? (h <= 9 ? "0" : "") + h : "00"}:${m > 0 ? (m <= 9 ? "0" : "") + m : "00"}:${s > 0 ? (s <= 9 ? "0" : "") + s : "00"}`;
  };

  const togglePlay = () => {
    thePlay.value = !thePlay.value;
    if (thePlay.value) {
      emit("play");
    } else {
      emit("pause");
    }
  };

  const theTime = ref(props.time);
  watch(
    () => props.time,
    (v) => {
      if (theTime.value != v) {
        theTime.value = v;

        const vv = (100 * theTime.value) / props.total;
        if (Number.isNaN(vv)) {
          percent.value = "0";
        } else {
          percent.value = vv.toFixed(2);
        }
      }
    }
  );
  const onMove = (ev: any) => {
    const slider = sliderRef.value!;
    const rect = slider.getBoundingClientRect();

    let w = ev.x - rect.left;
    if (w < 0) {
      w = 0;
    } else if (w > rect.width) {
      w = rect.width;
    }

    const v = w / rect.width;
    theTime.value = v * props.total;
    const vv = 100 * v;
    if (Number.isNaN(vv)) {
      percent.value = "0";
    } else {
      percent.value = vv.toFixed(2);
    }

    //@ts-ignore
    slider.style["--range-value"] = percent.value + "%";
    emit("update:time", theTime.value);
    emit("seek", theTime.value);
  };

  useDragMove(sliderRef, {
    start: onMove,
    move: onMove,
    end: onMove
  });

  const onRange = debounce((e: MouseEvent) => {
    console.log(e);
    // const v = Number(el.offset);
    //     emit("update:time", v);
    //     emit("seek", v);
    //     getPercent();
  }, 100);
</script>

<style lang="scss" scoped>
  .play-bar {
    width: 100%;
    height: 60px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 50%, rgba(0, 0, 0, 0) 100%);

    display: flex;

    padding: 0 20px 8px 20px;

    flex-direction: column;

    .play-bar-content {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .play-slider {
      width: calc(100% - 50px);
      margin: 0px;
      padding: 0px;
      position: relative;
      top: 10px;
      height: 20px;
      --range-value: 0%;
      display: inline-flex;
      flex-direction: column;
      cursor: pointer;
      .bar {
        flex: none;
        background: linear-gradient(
          to right,
          white var(--range-value, 0%),
          rgba(255, 255, 255, 0.2) var(--range-value, 0%)
        );
        backdrop-filter: blur(10px);
        border-radius: 3px;
        height: 6px;
        pointer-events: none;
      }
      .circle {
        flex: none;
        // appearance: none;
        border-radius: 50%;
        height: 20px;
        width: 20px;

        position: relative;
        background-color: white;

        box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
        top: -13px;

        left: calc(var(--range-value) - 10px);
        pointer-events: none;
      }
    }
    .play-bar-text {
      text-align: right;
      font-size: 12px;
      line-height: 12px;
      pointer-events: none;
      position: relative;
    }
    i.iconfont {
      color: white;
      height: 40px;
      width: 40px;
      backdrop-filter: blur(10px);
      background-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);

      font-size: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      cursor: pointer;
    }
    // input[type="range"] {
    //   width: calc(100% - 50px);
    //   margin: 0px;
    //   padding: 0px;
    //   height: 10px;
    //   --range-value: 0%;
    //   appearance: none;
    //   background: transparent;
    //   &::-webkit-slider-runnable-track {
    //     background-color: gray;
    //     background: linear-gradient(to right, white 0%, white var(--range-value, 0%), gray var(--range-value, 0%));
    //     border-radius: 3px;
    //     height: 6px;
    //     box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
    //   }
    //   &::-webkit-slider-thumb {
    //     appearance: none;
    //     border-radius: 50%;
    //     height: 20px;
    //     width: 20px;
    //     position: relative;
    //     background-color: white;
    //     color: white;
    //     box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);

    //     top: -7px;
    //     cursor: pointer;
    //   }
    // }
  }
</style>
