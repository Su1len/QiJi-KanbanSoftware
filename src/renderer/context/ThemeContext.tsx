import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api-client';

export interface ColorScheme {
  bgPrimary: string; bgSecondary: string; bgCard: string; bgHover: string;
  accent: string; accentHover: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  border: string;
  success: string; warning: string; danger: string; info: string;
}

export interface FontOverrides {
  titleFont: string;
  bodyFont: string;
}

export interface ImageOverride {
  targetComponent: string;
  imagePath?: string;
  color1?: string;
  color2?: string;
  opacity?: number;
  position?: string;
  size?: string;
}

export interface ThemeDefinition {
  themeName: string;
  themeAuthor: string;
  version: string;
  darkMode: boolean;
  colorScheme: ColorScheme;
  fontOverrides: FontOverrides;
  textOverrides: Record<string, string>;
  imageOverrides: ImageOverride[];
}

const DEFAULT_THEME: ThemeDefinition = {
  themeName: '深蓝',
  themeAuthor: '骐骥官方',
  version: '1.0.0',
  darkMode: true,
  colorScheme: {
    bgPrimary: '#1a1d2e', bgSecondary: '#161929', bgCard: '#242840', bgHover: '#2a2f4a',
    accent: '#4f8cff', accentHover: '#6ba1ff',
    textPrimary: '#e8eaf0', textSecondary: '#8a8fa8', textMuted: '#5a5f78',
    border: '#2e334d',
    success: '#52c41a', warning: '#faad14', danger: '#ff4d4f', info: '#4f8cff',
  },
  fontOverrides: { titleFont: '"Microsoft YaHei", sans-serif', bodyFont: '"Microsoft YaHei", sans-serif' },
  textOverrides: {},
  imageOverrides: [],
};

export interface ThemeEntry {
  key: string;
  name: string;
}

interface ThemeContextType {
  theme: ThemeDefinition;
  themeName: string;
  setTheme: (name: string) => Promise<void>;
  availableThemes: ThemeEntry[];
  t: (key: string, defaultText: string) => string;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  themeName: 'dark-blue',
  setTheme: async () => {},
  availableThemes: [{ key: 'dark-blue', name: '深蓝' }],
  t: (_k, d) => d,
});

function applyColorScheme(cs: ColorScheme): void {
  const root = document.documentElement;
  const map: Record<string, string> = {
    '--color-bg-primary': cs.bgPrimary,
    '--color-bg-secondary': cs.bgSecondary,
    '--color-bg-card': cs.bgCard,
    '--color-bg-hover': cs.bgHover,
    '--color-accent': cs.accent,
    '--color-accent-hover': cs.accentHover,
    '--color-text-primary': cs.textPrimary,
    '--color-text-secondary': cs.textSecondary,
    '--color-text-muted': cs.textMuted,
    '--color-border': cs.border,
    '--color-success': cs.success,
    '--color-warning': cs.warning,
    '--color-danger': cs.danger,
    '--color-info': cs.info,
  };
  for (const [key, value] of Object.entries(map)) {
    root.style.setProperty(key, value);
  }
  // Font
  root.style.setProperty('--font-family', cs.textPrimary); // will be overridden
}

function validateTheme(raw: any, name: string): ThemeDefinition {
  // Not an object at all → use default
  if (!raw || typeof raw !== 'object') {
    console.warn(`[Theme] "${name}" theme.json 格式无效，使用默认主题`);
    return { ...DEFAULT_THEME, themeName: name };
  }

  // Merge with defaults: any missing field gets the DEFAULT_THEME value
  const defaults = DEFAULT_THEME.colorScheme;
  const rawCS = raw.colorScheme || {};
  const colorScheme: ColorScheme = {
    bgPrimary:    rawCS.bgPrimary    || defaults.bgPrimary,
    bgSecondary:  rawCS.bgSecondary  || defaults.bgSecondary,
    bgCard:       rawCS.bgCard       || defaults.bgCard,
    bgHover:      rawCS.bgHover      || defaults.bgHover,
    accent:       rawCS.accent       || defaults.accent,
    accentHover:  rawCS.accentHover  || defaults.accentHover,
    textPrimary:  rawCS.textPrimary  || defaults.textPrimary,
    textSecondary:rawCS.textSecondary|| defaults.textSecondary,
    textMuted:    rawCS.textMuted    || defaults.textMuted,
    border:       rawCS.border       || defaults.border,
    success:      rawCS.success      || defaults.success,
    warning:      rawCS.warning      || defaults.warning,
    danger:       rawCS.danger       || defaults.danger,
    info:         rawCS.info         || defaults.info,
  };

  // Log warnings for missing colors
  const missingColors = (Object.keys(defaults) as (keyof ColorScheme)[])
    .filter(k => !rawCS[k]);
  if (missingColors.length > 0) {
    console.warn(`[Theme] "${name}" 缺少 ${missingColors.length} 个颜色，已用默认值填充:`, missingColors.join(', '));
  }

  // Validate font overrides
  const rawFont = raw.fontOverrides || {};
  const fontOverrides: FontOverrides = {
    titleFont: rawFont.titleFont || defaults.bgPrimary, // defaults.bgPrimary was wrong before, use proper default
    bodyFont:  rawFont.bodyFont  || '"Microsoft YaHei", sans-serif',
  };

  // Validate image overrides: filter out entries without targetComponent
  const rawImages = Array.isArray(raw.imageOverrides) ? raw.imageOverrides : [];
  const imageOverrides: ImageOverride[] = rawImages
    .filter((img: any) => {
      if (!img || !img.targetComponent) {
        console.warn(`[Theme] "${name}" 有一条图片配置缺少 targetComponent，已跳过`);
        return false;
      }
      // Warn if neither imagePath nor colors are specified
      if (!img.imagePath && !img.color1) {
        console.warn(`[Theme] "${name}" 的 "${img.targetComponent}" 图片配置既无 imagePath 也无颜色，已跳过`);
        return false;
      }
      return true;
    })
    .map((img: any) => ({
      targetComponent: img.targetComponent,
      imagePath: img.imagePath || undefined,
      color1: img.color1 || undefined,
      color2: img.color2 || undefined,
      opacity: typeof img.opacity === 'number' ? img.opacity : undefined,
      position: img.position || undefined,
      size: img.size || undefined,
    }));

  if (Array.isArray(raw.imageOverrides) && rawImages.length !== imageOverrides.length) {
    console.warn(`[Theme] "${name}" ${rawImages.length} 条图片配置中 ${rawImages.length - imageOverrides.length} 条被跳过（格式无效）`);
  }

  return {
    themeName:    raw.themeName    || name,
    themeAuthor:  raw.themeAuthor  || '未知',
    version:      raw.version      || '1.0.0',
    darkMode:     typeof raw.darkMode === 'boolean' ? raw.darkMode : true,
    colorScheme,
    fontOverrides,
    textOverrides: raw.textOverrides && typeof raw.textOverrides === 'object' ? raw.textOverrides : {},
    imageOverrides,
  };
}

async function loadTheme(name: string): Promise<ThemeDefinition> {
  try {
    const resp = await fetch(`/themes/${name}/theme.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();
    return validateTheme(raw, name);
  } catch (e: any) {
    console.warn(`[Theme] 无法加载主题"${name}"，使用默认主题:`, e.message);
    return { ...DEFAULT_THEME, themeName: name };
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeDefinition>(DEFAULT_THEME);
  const [themeName, setThemeName] = useState<string>('dark-blue');
  const [availableThemes, setAvailableThemes] = useState<ThemeEntry[]>([{ key: 'dark-blue', name: '深蓝' }]);
  const [loaded, setLoaded] = useState(false);

  // Load available themes list on startup (scans themes/ directory)
  useEffect(() => {
    fetch('/api/themes')
      .then(r => r.json())
      .then(async (keys: string[]) => {
        if (keys.length === 0) return;
        // Load each theme's display name from its theme.json
        const entries: ThemeEntry[] = [];
        for (const key of keys) {
          try {
            const r = await fetch(`/themes/${key}/theme.json`);
            if (r.ok) {
              const d = await r.json();
              entries.push({ key, name: d.themeName || key });
            } else {
              entries.push({ key, name: key });
            }
          } catch {
            entries.push({ key, name: key });
          }
        }
        setAvailableThemes(entries);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await api.getSetting('theme');
      const name = saved || 'dark-blue';
      const def = await loadTheme(name);
      setThemeState(def);
      setThemeName(name);
      applyColorScheme(def.colorScheme);
      setLoaded(true);
    })();
  }, []);

  const switchTheme = useCallback(async (name: string) => {
    const def = await loadTheme(name);
    setThemeState(def);
    setThemeName(name);
    applyColorScheme(def.colorScheme);
    await api.setSetting('theme', name);
  }, []);

  const t = useCallback((key: string, defaultText: string): string => {
    return theme.textOverrides[key] || defaultText;
  }, [theme.textOverrides]);

  if (!loaded) return <>{children}</>; // Render children with default theme while loading

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme: switchTheme, availableThemes, t }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}

export { DEFAULT_THEME };
