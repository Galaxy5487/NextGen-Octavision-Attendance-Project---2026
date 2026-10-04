import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemePalette = 'zinc' | 'emerald' | 'indigo' | 'amber' | 'rose';

export interface PaletteInfo {
  id: ThemePalette;
  name: string;
  color: string;
  previewClass: string;
  accentHex: string;
}

export const THEME_PALETTES: PaletteInfo[] = [
  { id: 'zinc', name: 'Monochrome Zinc', color: 'bg-zinc-900', previewClass: 'from-zinc-900 to-zinc-700', accentHex: '#18181b' },
  { id: 'emerald', name: 'Emerald Wave', color: 'bg-emerald-600', previewClass: 'from-emerald-600 to-teal-500', accentHex: '#059669' },
  { id: 'indigo', name: 'Indigo Electric', color: 'bg-indigo-600', previewClass: 'from-indigo-600 to-violet-600', accentHex: '#4f46e5' },
  { id: 'amber', name: 'Amber Gold', color: 'bg-amber-500', previewClass: 'from-amber-500 to-orange-500', accentHex: '#d97706' },
  { id: 'rose', name: 'Midnight Rose', color: 'bg-rose-600', previewClass: 'from-rose-600 to-pink-600', accentHex: '#e11d48' },
];

interface ThemeCtx {
  mode: ThemeMode;
  palette: ThemePalette;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
  toggleMode: () => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: 'light',
  palette: 'zinc',
  setMode: () => {},
  setPalette: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('ngo_theme_mode');
      if (saved === 'dark' || saved === 'light') return saved;
      return 'light';
    } catch {
      return 'light';
    }
  });


  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    try {
      const saved = localStorage.getItem('ngo_theme_palette') as ThemePalette;
      if (['zinc', 'emerald', 'indigo', 'amber', 'rose'].includes(saved)) return saved;
      return 'zinc';
    } catch {
      return 'zinc';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ngo_theme_mode', mode);
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem('ngo_theme_palette', palette);
      document.documentElement.setAttribute('data-palette', palette);
    } catch {}
  }, [palette]);

  const setMode = (newMode: ThemeMode) => setModeState(newMode);
  const setPalette = (newPalette: ThemePalette) => setPaletteState(newPalette);
  const toggleMode = () => setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <Ctx.Provider value={{ mode, palette, setMode, setPalette, toggleMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
