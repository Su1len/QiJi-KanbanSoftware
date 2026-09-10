import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api-client';
import { currentLang } from '../i18n';
import { useLang } from './LanguageContext';

export interface ColorScheme {
  bgPrimary: string; bgSecondary: string; bgCard: string; bgHover: string;
  accent: string; accentHover: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  border: string;
  success: string; warning: string; danger: string; info: string;
  // 可选：顶部导航栏背景（动态皮肤下可用半透明色保证日期文字可读）
  topNavBg?: string;
  // 可选：日期栏文字颜色（默认用 textPrimary）
  dateText?: string;
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
  themeNameEn?: string;
  themeAuthor: string;
  version: string;
  darkMode: boolean;
  languages?: string[];
  colorScheme: ColorScheme;
  fontOverrides: FontOverrides;
  textOverrides: Record<string, string>;
  imageOverrides: ImageOverride[];
  // HTML 动态背景（V1.0.1）：文件名位于主题文件夹内；enabled 由设置页开关持久化到 theme.json
  dynamicBackground?: string;
  dynamicBackgroundEnabled?: boolean;
}

const DEFAULT_THEME: ThemeDefinition = {
  themeName: '浅灰',
  themeAuthor: '骐骥官方',
  version: '1.0.0',
  darkMode: false,
  colorScheme: {
    bgPrimary: '#f5f5f5', bgSecondary: '#e8e8e8', bgCard: '#ffffff', bgHover: '#f0f0f0',
    accent: '#1890ff', accentHover: '#40a9ff',
    textPrimary: '#1a1a1a', textSecondary: '#8c8c8c', textMuted: '#bfbfbf',
    border: '#d9d9d9',
    success: '#52c41a', warning: '#faad14', danger: '#ff4d4f', info: '#1890ff',
  },
  fontOverrides: { titleFont: '"Microsoft YaHei", "PingFang SC", sans-serif', bodyFont: '"Microsoft YaHei", "PingFang SC", sans-serif' },
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
  setDynamicEnabled: (enabled: boolean) => Promise<void>;
  availableThemes: ThemeEntry[];
  t: (key: string, defaultText: string) => string;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  themeName: 'light-gray',
  setTheme: async () => {},
  setDynamicEnabled: async () => {},
  availableThemes: [{ key: 'light-gray', name: '浅灰' }],
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
  // 顶栏背景：无配置时透明（动态背景透出，静态主题行为不变）
  root.style.setProperty('--color-topnav-bg', cs.topNavBg || 'transparent');
  // 日期栏文字：无配置时跟随主文字色
  root.style.setProperty('--color-date-text', cs.dateText || cs.textPrimary);
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
    topNavBg:     typeof rawCS.topNavBg === 'string' ? rawCS.topNavBg : undefined,
    dateText:     typeof rawCS.dateText === 'string' ? rawCS.dateText : undefined,
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
    themeNameEn:  raw.themeNameEn  || undefined,
    themeAuthor:  raw.themeAuthor  || '未知',
    version:      raw.version      || '1.0.0',
    darkMode:     typeof raw.darkMode === 'boolean' ? raw.darkMode : true,
    languages:    Array.isArray(raw.languages) ? raw.languages : undefined,
    colorScheme,
    fontOverrides,
    textOverrides: raw.textOverrides && typeof raw.textOverrides === 'object' ? raw.textOverrides : {},
    imageOverrides,
    dynamicBackground: typeof raw.dynamicBackground === 'string' && raw.dynamicBackground ? raw.dynamicBackground : undefined,
    dynamicBackgroundEnabled: raw.dynamicBackgroundEnabled === true,
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
  const { lang } = useLang();
  const [theme, setThemeState] = useState<ThemeDefinition>(DEFAULT_THEME);
  const [themeName, setThemeName] = useState<string>('light-gray');
  const [availableThemes, setAvailableThemes] = useState<ThemeEntry[]>([{ key: 'light-gray', name: '浅灰' }]);
  const [loaded, setLoaded] = useState(false);

  // Load available themes list (reloads on language change so names match the UI language)
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
              const displayName = (lang === 'en' && d.themeNameEn) ? d.themeNameEn : (d.themeName || key);
              entries.push({ key, name: displayName });
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
  }, [lang]);

  useEffect(() => {
    (async () => {
      const saved = await api.getSetting('theme');
      // 默认主题为浅灰；用户已保存的主题偏好保持不变
      let name = saved || 'light-gray';
      let def = await loadTheme(name);
      // 启动校验：当前皮肤不支持当前语言时，自动切回默认皮肤（浅灰）
      if (def.languages && def.languages.length > 0 && !def.languages.includes(currentLang)) {
        name = 'light-gray';
        def = await loadTheme(name);
        await api.setSetting('theme', name);
      }
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

  // 动态背景开关：持久化到该主题的 theme.json（重启后保持）
  const setDynamicEnabled = useCallback(async (enabled: boolean) => {
    if (!theme.dynamicBackground) return;
    try {
      await api.setThemeDynamic(themeName, enabled);
      setThemeState(prev => ({ ...prev, dynamicBackgroundEnabled: enabled }));
    } catch (e) {
      console.warn('[Theme] 动态背景开关保存失败:', (e as any)?.message);
    }
  }, [theme.dynamicBackground, themeName]);

  const t = useCallback((key: string, defaultText: string): string => {
    // 多语言文案覆盖：theme.json 中以 "key-zh" / "key-en" 形式提供
    const override = theme.textOverrides[key + '-' + currentLang];
    return override || defaultText;
  }, [theme.textOverrides]);

  if (!loaded) return <>{children}</>; // Render children with default theme while loading

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme: switchTheme, setDynamicEnabled, availableThemes, t }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}

export { DEFAULT_THEME };
