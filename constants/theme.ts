export interface ThemePalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceAccent: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  text: string;
  textLight: string;
  accentPositive: string;
  accentNegative: string;
  accentPositiveText: string;
  accentNegativeText: string;
  border: string;
  focusRing: string;
  inputBg: string;
}

export interface ColorScheme {
  key: string;
  label: string;
  dot: string;
  light: Pick<ThemePalette, 'primary' | 'primaryHover' | 'primaryText' | 'focusRing'>;
  dark: Pick<ThemePalette, 'primary' | 'primaryHover' | 'primaryText' | 'focusRing'>;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    key: 'slate', label: '霧灰', dot: '#6B7C93',
    light: { primary: 'bg-[#6B7C93]', primaryHover: 'hover:bg-[#5A6A7D]', primaryText: 'text-[#556475]', focusRing: 'focus:ring-[#6B7C93]' },
    dark:  { primary: 'bg-[#8A9BB0]', primaryHover: 'hover:bg-[#748698]', primaryText: 'text-[#8A9BB0]', focusRing: 'focus:ring-[#8A9BB0]' },
  },
  {
    key: 'blue', label: '煙燻藍', dot: '#6E8898',
    light: { primary: 'bg-[#6E8898]', primaryHover: 'hover:bg-[#5C7888]', primaryText: 'text-[#4A6B7A]', focusRing: 'focus:ring-[#6E8898]' },
    dark:  { primary: 'bg-[#8DA7B7]', primaryHover: 'hover:bg-[#7892A2]', primaryText: 'text-[#8DA7B7]', focusRing: 'focus:ring-[#8DA7B7]' },
  },
  {
    key: 'green', label: '莫蘭迪綠', dot: '#6B8F7E',
    light: { primary: 'bg-[#6B8F7E]', primaryHover: 'hover:bg-[#5C806F]', primaryText: 'text-[#4D7565]', focusRing: 'focus:ring-[#6B8F7E]' },
    dark:  { primary: 'bg-[#8AAE9D]', primaryHover: 'hover:bg-[#759988]', primaryText: 'text-[#8AAE9D]', focusRing: 'focus:ring-[#8AAE9D]' },
  },
  {
    key: 'pink', label: '莫蘭迪粉', dot: '#B5838D',
    light: { primary: 'bg-[#B5838D]', primaryHover: 'hover:bg-[#A3747E]', primaryText: 'text-[#8A5B64]', focusRing: 'focus:ring-[#B5838D]' },
    dark:  { primary: 'bg-[#D4A2AC]', primaryHover: 'hover:bg-[#BF8D97]', primaryText: 'text-[#D4A2AC]', focusRing: 'focus:ring-[#D4A2AC]' },
  },
  {
    key: 'rose', label: '乾燥玫瑰', dot: '#A67F8E',
    light: { primary: 'bg-[#A67F8E]', primaryHover: 'hover:bg-[#96707F]', primaryText: 'text-[#7D5A67]', focusRing: 'focus:ring-[#A67F8E]' },
    dark:  { primary: 'bg-[#C59EAD]', primaryHover: 'hover:bg-[#B08999]', primaryText: 'text-[#C59EAD]', focusRing: 'focus:ring-[#C59EAD]' },
  },
  {
    key: 'purple', label: '莫蘭迪紫', dot: '#8E7F9E',
    light: { primary: 'bg-[#8E7F9E]', primaryHover: 'hover:bg-[#7E708E]', primaryText: 'text-[#675878]', focusRing: 'focus:ring-[#8E7F9E]' },
    dark:  { primary: 'bg-[#AD9EBD]', primaryHover: 'hover:bg-[#9889A8]', primaryText: 'text-[#AD9EBD]', focusRing: 'focus:ring-[#AD9EBD]' },
  },
  {
    key: 'lavender', label: '薰衣草灰', dot: '#9088A0',
    light: { primary: 'bg-[#9088A0]', primaryHover: 'hover:bg-[#807890]', primaryText: 'text-[#665E78]', focusRing: 'focus:ring-[#9088A0]' },
    dark:  { primary: 'bg-[#AFA7BF]', primaryHover: 'hover:bg-[#9A92AA]', primaryText: 'text-[#AFA7BF]', focusRing: 'focus:ring-[#AFA7BF]' },
  },
  {
    key: 'caramel', label: '焦糖奶茶', dot: '#A08C7B',
    light: { primary: 'bg-[#A08C7B]', primaryHover: 'hover:bg-[#907D6C]', primaryText: 'text-[#7A6655]', focusRing: 'focus:ring-[#A08C7B]' },
    dark:  { primary: 'bg-[#BFAB9A]', primaryHover: 'hover:bg-[#AA9685]', primaryText: 'text-[#BFAB9A]', focusRing: 'focus:ring-[#BFAB9A]' },
  },
  {
    key: 'taupe', label: '暖灰棕', dot: '#9B8E82',
    light: { primary: 'bg-[#9B8E82]', primaryHover: 'hover:bg-[#8B7F73]', primaryText: 'text-[#746860]', focusRing: 'focus:ring-[#9B8E82]' },
    dark:  { primary: 'bg-[#BAADA1]', primaryHover: 'hover:bg-[#A5988C]', primaryText: 'text-[#BAADA1]', focusRing: 'focus:ring-[#BAADA1]' },
  },
];

const LIGHT_BASE: Omit<ThemePalette, 'primary' | 'primaryHover' | 'primaryText' | 'focusRing'> = {
  bg: 'bg-[#F5F5F7]',
  surface: 'bg-[#FFFFFF]',
  surfaceAlt: 'bg-[#FAFAFA]',
  surfaceAccent: 'bg-[#F2F4F7]',
  text: 'text-[#2D3436]',
  textLight: 'text-[#8795A1]',
  accentPositive: 'bg-[#34C759]',
  accentNegative: 'bg-[#FF3B30]',
  accentPositiveText: 'text-[#34C759]',
  accentNegativeText: 'text-[#FF3B30]',
  border: 'border-[#E3E8EE]',
  inputBg: 'bg-[#FFFFFF]',
};

const DARK_BASE: Omit<ThemePalette, 'primary' | 'primaryHover' | 'primaryText' | 'focusRing'> = {
  bg: 'bg-[#000000]',
  surface: 'bg-[#1C1C1E]',
  surfaceAlt: 'bg-[#2C2C2E]',
  surfaceAccent: 'bg-[#3A3A3C]',
  text: 'text-[#F5F5F7]',
  textLight: 'text-[#9CA3AF]',
  accentPositive: 'bg-[#30D158]',
  accentNegative: 'bg-[#FF453A]',
  accentPositiveText: 'text-[#30D158]',
  accentNegativeText: 'text-[#FF453A]',
  border: 'border-[#38383A]',
  inputBg: 'bg-[#1C1C1E]',
};

// 預先生成所有組合，確保 Tailwind 能掃描到所有 class 字面量
const THEME_MAP: Record<string, { light: ThemePalette; dark: ThemePalette }> = {};
for (const scheme of COLOR_SCHEMES) {
  THEME_MAP[scheme.key] = {
    light: { ...LIGHT_BASE, ...scheme.light },
    dark: { ...DARK_BASE, ...scheme.dark },
  };
}

/** 根據深淺模式 + 色系 key 取得 ThemePalette */
export function buildTheme(isDark: boolean, colorKey: string): ThemePalette {
  const entry = THEME_MAP[colorKey] ?? THEME_MAP['slate'];
  return isDark ? entry.dark : entry.light;
}

// 向下相容
export const LIGHT_THEME: ThemePalette = THEME_MAP['slate'].light;
export const DARK_THEME: ThemePalette = THEME_MAP['slate'].dark;
