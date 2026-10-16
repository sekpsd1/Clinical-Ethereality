// Generated from the pinned NotoSans/NotoSansThai Regular characterSet (fontkit).
// See assets/fonts/receipt/README.md. Match the renderer's Thai/Latin font selection.
const ranges = [[32,126],[160,887],[890,895],[900,906],[908,908],[910,929],[931,993],[1008,1327],[3585,3642],[3647,3675],[6832,6848],[7296,7304],[7424,7673],[7675,7957],[7960,7965],[7968,8005],[8008,8013],[8016,8023],[8025,8025],[8027,8027],[8029,8029],[8031,8061],[8064,8116],[8118,8132],[8134,8147],[8150,8155],[8157,8175],[8178,8180],[8182,8190],[8192,8292],[8294,8305],[8308,8334],[8336,8348],[8352,8383],[8432,8432],[8448,8543],[8580,8580],[8585,8585],[9676,9676],[11360,11391],[11744,11858],[42560,42655],[42752,42943],[42946,42954],[42997,43007],[43310,43310],[43824,43883],[64256,64262],[65024,65024],[65056,65071]];

export function hasReceiptGlyphs(value: string): boolean {
  return Array.from(value).every(char => {
    const code = char.codePointAt(0)!;
    return ranges.some(([start, end]) => code >= start && code <= end);
  });
}
