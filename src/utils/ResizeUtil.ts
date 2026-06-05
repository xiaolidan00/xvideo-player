import {debounce} from "lodash-es";

export class ResizeUtil {
  resizeObserver: ResizeObserver;
  resizeCb: Function;
  el: HTMLElement;
  resize: Function;
  constructor(el: HTMLElement, resizeCb: Function, time = 100) {
    this.el = el;
    this.resizeCb = resizeCb;
    this.resize = debounce(this.onResize, time);
    this.resize();
    this.resizeObserver = new ResizeObserver(this.resize.bind(this));
    this.resizeObserver.observe(this.el);
    document.addEventListener("resize", this.resize.bind(this));
    document.addEventListener("fullscreenchange", this.resize.bind(this));
  }
  onResize() {
    this.resizeCb();
  }
  destroy() {
    document.removeEventListener("resize", this.resize.bind(this));
    document.removeEventListener("fullscreenchange", this.resize.bind(this));
    if (this.resizeObserver) {
      this.resizeObserver.unobserve(this.el);
      this.resizeObserver.disconnect();
    }
  }
}
