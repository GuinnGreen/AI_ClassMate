import { createContext, useContext } from 'react';
import { ThemePalette, LIGHT_THEME } from '../constants/theme';

const ThemeContext = createContext<ThemePalette>(LIGHT_THEME);

export const ThemeProvider = ThemeContext.Provider;
export const useTheme = () => useContext(ThemeContext);
