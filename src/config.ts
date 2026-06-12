export const speedList = [
  {label: "x1", value: 1.0},
  {label: "x1.25", value: 1.25},
  {label: "x1.5", value: 1.5},
  {label: "x1.75", value: 1.75},
  {label: "x2", value: 2.0}
];
export type VideoItemType = {
  filePath: string;
  idx: number;

  currentTime: number;
  duration: number;
};
export const getPercent = (item: VideoItemType) => {
  if (item.currentTime > 0 && item.duration > 0) {
    return Math.round((100 * item.currentTime) / item.duration);
  }
  return 0;
};
export const formatName = (str: string) => {
  return str.substring(str.lastIndexOf("\\") + 1) || "";
};
