import {onBeforeUnmount, onMounted} from "vue";

export interface DragMoveConfig {
  start?: (e: DragPosType) => void;
  move?: (e: DragPosType) => void;
  end?: (e: DragPosType) => void;
  minMove?: number;
}
export type DragPosType = {
  offsetx: number;
  offsety: number;
  x: number;
  y: number;
  startx: number;
  starty: number;
  endx: number;
  endy: number;
  enable: boolean;
  move: boolean;
};
export function useDragMove(el: any, config: DragMoveConfig = {minMove: 5}) {
  if (!config.minMove) {
    config.minMove = 5;
  }

  const state: DragPosType = {
    offsetx: 0,
    offsety: 0,
    x: 0,
    y: 0,
    startx: 0,
    starty: 0,
    endx: 0,
    endy: 0,
    enable: false,
    move: false
  };
  const onMouseDown = (ev: MouseEvent) => {
    ev.stopImmediatePropagation();
    ev.stopPropagation();

    if (ev.target !== el.value) return;

    state.x = ev.pageX;
    state.y = ev.pageY;
    state.startx = ev.offsetX;
    state.starty = ev.offsetY;
    state.endx = ev.offsetX;
    state.endy = ev.offsetY;
    state.offsetx = 0;
    state.offsety = 0;
    state.enable = true;
    state.move = false;
    config.start && config.start(state);

    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseup", onMouseUp);

    document.onselectstart = () => false;
  };
  const onMouseMove = (ev: MouseEvent) => {
    if (state.enable) {
      state.offsetx += ev.pageX - state.x;
      state.offsety += ev.pageY - state.y;
      state.x = ev.pageX;
      state.y = ev.pageY;
      state.endx = state.startx + state.offsetx;
      state.endy = state.starty + state.offsety;
      if (Math.abs(state.offsetx) >= config.minMove! || Math.abs(state.offsety) >= config.minMove!) {
        state.move = true;
      }
      config.move && config.move(state);
    }
  };
  const onMouseUp = (ev: MouseEvent) => {
    if (state.enable && state.move) {
      config.end && config.end(state);
    }

    state.enable = false;
    state.move = false;
    document.body.removeEventListener("mousemove", onMouseMove);
    document.body.removeEventListener("mouseup", onMouseUp);

    document.onselectstart = null;
  };
  onMounted(() => {
    const dom = el.value!;
    dom.addEventListener("mousedown", onMouseDown);
  });

  onBeforeUnmount(() => {
    const dom = el.value!;
    document.body.removeEventListener("mousemove", onMouseMove);
    document.body.removeEventListener("mouseup", onMouseUp);
    dom.removeEventListener("mousedown", onMouseDown);
  });
}
