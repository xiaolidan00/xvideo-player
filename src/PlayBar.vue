<template>
  <div class="play-bar">
    <i @click="thePlay = !thePlay" :class="['iconfont', isPlay ? 'icon-pause' : 'icon-play']"></i>

    <input
      type="range"
      v-model.number="theTime"
      :step="0.1"
      :min="0"
      :max="total"
      :style="{'--range-value': percent + '%'}"
      @change="onTime"
    />
  </div>
</template>

<script setup lang="ts">
  import {computed, ref} from "vue";

  const emit = defineEmits(["update:time", "update:isPlay", "play", "pause", "seek", "changeTime"]);

  const props = withDefaults(defineProps<{isPlay: boolean; time: number; total: number}>(), {
    time: 0,
    total: 10
  });
  const thePlay = computed({
    get: () => props.isPlay,
    set: (v) => {
      emit("update:isPlay", v);
      if (v) {
        emit("play");
      } else {
        emit("pause");
      }
    }
  });
  const theTime = computed({
    get: () => props.time,
    set: (v) => {
      emit("update:time", v);
      emit("changeTime", v);
    }
  });
  const percent = computed(() => {
    const v = (100 * props.time) / props.total;
    if (Number.isNaN(v)) {
      return "0";
    }
    return v.toFixed(2);
  });
  const onTime = () => {
    emit("seek");
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
      width: calc(100% - 50px);
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
