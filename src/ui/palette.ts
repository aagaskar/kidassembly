/** 16-color palette for the memory-mapped screen (values 0–15). */
export const PALETTE: string[] = [
  "#000000", // 0 black
  "#1d2b53", // 1 navy
  "#7e2553", // 2 plum
  "#008751", // 3 green
  "#ab5236", // 4 brown
  "#5f574f", // 5 dark gray
  "#c2c3c7", // 6 light gray
  "#fff1e8", // 7 white
  "#ff004d", // 8 red
  "#ffa300", // 9 orange
  "#ffec27", // 10 yellow
  "#00e436", // 11 lime
  "#29adff", // 12 sky blue
  "#83769c", // 13 lavender
  "#ff77a8", // 14 pink
  "#ffccaa", // 15 peach
];

export const colorFor = (byte: number) => PALETTE[byte % 16];
