<template>
  <div class="play-bar">
    <i @click="togglePlay" :class="['iconfont', isPlay ? 'icon-pause' : 'icon-play']"></i>

    <div class="play-bar-content">
      <div>{{ formatTime(theTime) || "0" }}/{{ formatTime(druation) || "0" }}</div>
      <input
        type="range"
        v-model.number="theTime"
        :step="1"
        :min="0"
        :max="druation"
        :style="{'--range-value': percent + '%'}"
        @change="onTime"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import {computed, ref, watch} from "vue";

  const emit = defineEmits(["update:time", "update:isPlay", "play", "pause", "seek"]);

  const props = withDefaults(defineProps<{isPlay: boolean; time: number; total: number}>(), {
    time: 0,
    total: 10
  });
  const thePlay = ref(props.isPlay);
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
      s = Math.floor(t / 1);
    }
    return `${h > 0 ? h + ":" : ""}${m > 0 ? m + ":" : ""}${s > 0 ? s : ""}`;
  };
  const druation = computed(() => {
    return Math.floor(props.total);
  });

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
      if (theTime.value != v) theTime.value = v;
    }
  );

  const percent = computed(() => {
    const v = (100 * Math.round(props.time)) / druation.value;
    if (Number.isNaN(v)) {
      return "0";
    }
    return v.toFixed(2);
  });
  const onTime = (e: InputEvent) => {
    const v = Number((e.target as HTMLInputElement).value);
    emit("update:time", v);
    emit("seek", v);
  };
</script>

<style lang="scss" scoped>
  .play-bar {
    width: 100%;
    height: 48px;
    background: linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);

    display: flex;
    align-items: center;
    padding: 0 20px 8px 20px;
    gap: 10px;
    .play-bar-content {
      display: inline-flex;
      width: calc(100% - 50px);
      flex-direction: column;
      gap: 10px;
      font-size: 12px;
    }

    i.iconfont {
      color: white;
      height: 40px;
      width: 40px;
      backdrop-filter: blur(10px);
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);

      font-size: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      cursor: pointer;
    }
    input[type="range"] {
      margin: 0px;
      padding: 0px;
      height: 10px;
      --range-value: 0%;
      appearance: none;
      background: transparent;
      &::-webkit-slider-runnable-track {
        background-color: #ccc;
        background: linear-gradient(to right, white 0%, white var(--range-value, 0%), #ccc var(--range-value, 0%));
        border-radius: 3px;
        height: 6px;
      }
      &::-webkit-slider-thumb {
        appearance: none;
        border-radius: 50%;
        height: 20px;
        width: 20px;
        position: relative;
        background-color: white;
        color: white;
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);

        top: -7px;
        cursor: pointer;
      }
    }
  }
</style>
