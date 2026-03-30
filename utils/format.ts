const CIRCLED_NUMBERS = [
  '⓪','①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
  '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳',
  '㉑','㉒','㉓','㉔','㉕','㉖','㉗','㉘','㉙','㉚',
  '㉛','㉜','㉝','㉞','㉟','㊱','㊲','㊳','㊴','㊵',
  '㊶','㊷','㊸','㊹','㊺','㊻','㊼','㊽','㊾','㊿',
];

export const toCircledNumber = (n: number): string => {
  if (n >= 0 && n < CIRCLED_NUMBERS.length) return CIRCLED_NUMBERS[n];
  return `(${n})`;
};
