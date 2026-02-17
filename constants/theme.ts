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

export const LIGHT_THEME: ThemePalette = {
  bg: 'bg-[#F5F5F7]',
  surface: 'bg-[#FFFFFF]',
  surfaceAlt: 'bg-[#FAFAFA]',
  surfaceAccent: 'bg-[#F2F4F7]',
  primary: 'bg-[#6B7C93]',
  primaryHover: 'hover:bg-[#556375]',
  primaryText: 'text-[#6B7C93]',
  text: 'text-[#2D3436]',
  textLight: 'text-[#8795A1]',
  accentPositive: 'bg-[#34C759]',
  accentNegative: 'bg-[#FF3B30]',
  accentPositiveText: 'text-[#34C759]',
  accentNegativeText: 'text-[#FF3B30]',
  border: 'border-[#E3E8EE]',
  focusRing: 'focus:ring-[#6B7C93]',
  inputBg: 'bg-[#FFFFFF]',
};

export const DARK_THEME: ThemePalette = {
  bg: 'bg-[#000000]',
  surface: 'bg-[#1C1C1E]',
  surfaceAlt: 'bg-[#2C2C2E]',
  surfaceAccent: 'bg-[#3A3A3C]',
  primary: 'bg-[#7E8F9F]',
  primaryHover: 'hover:bg-[#6B7C93]',
  primaryText: 'text-[#7E8F9F]',
  text: 'text-[#F5F5F7]',
  textLight: 'text-[#9CA3AF]',
  accentPositive: 'bg-[#30D158]',
  accentNegative: 'bg-[#FF453A]',
  accentPositiveText: 'text-[#30D158]',
  accentNegativeText: 'text-[#FF453A]',
  border: 'border-[#38383A]',
  focusRing: 'focus:ring-[#7E8F9F]',
  inputBg: 'bg-[#1C1C1E]',
};
