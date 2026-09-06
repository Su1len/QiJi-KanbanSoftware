import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

// 动态背景容器（V1.0.1）
// - 沙箱 iframe 加载主题的 dynamicBackground HTML（双层沙箱：wrapper + opaque 皮肤）
// - pointer-events: none，所有鼠标操作穿透到看板
// - 加载前 HEAD 预检 + 10 秒加载超时，异常自动降级为静态底图并打印警告
// - iframe 一旦成功加载即锁定（loaded），后续组件重渲染/日期切换不会重新挂载或误降级
const DynamicBackground: React.FC = () => {
  const { theme, themeName } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const enabled = theme.dynamicBackgroundEnabled === true && !!theme.dynamicBackground;
  // 动态皮肤经双层沙箱加载：外层 wrapper（同源空白页）+ 内层 opaque-origin iframe，
  // 皮肤脚本无法访问父窗口、无法发起网络请求（服务端注入 CSP + sandbox）。
  const iframeSrc = enabled
    ? `/api/theme-dynamic/${encodeURIComponent(themeName)}`
    : '';

  // 主题/开关变化时重置加载状态
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [themeName, enabled]);

  // 加载前预检：文件缺失/路由异常直接降级
  useEffect(() => {
    if (!enabled || !iframeSrc) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(iframeSrc, { method: 'HEAD' });
        if (!cancelled && !resp.ok) {
          console.warn(`[Theme] 动态背景加载失败（HTTP ${resp.status}），已降级为静态底图`);
          setFailed(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn(`[Theme] 动态背景加载失败，已降级为静态底图:`, (e as any)?.message);
          setFailed(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, iframeSrc]);

  // 超时降级：仅在 iframe 尚未成功加载时生效；onLoad 后立即清除，避免误降级
  useEffect(() => {
    if (!enabled || failed || loaded) return;
    const timer = setTimeout(() => {
      console.warn('[Theme] 动态背景加载超时，已降级为静态底图');
      setFailed(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [enabled, failed, loaded, themeName]);

  if (!enabled || failed) return null;

  return (
    <div
      data-testid="dynamic-background"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <iframe
        key={iframeSrc}
        title="dynamic-background"
        src={iframeSrc}
        sandbox="allow-same-origin allow-scripts"
        onLoad={() => {
          setLoaded(true);
          setFailed(false);
        }}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
};

// memo：父组件（主视图）随日期切换重渲染时，保持组件实例与 iframe DOM 稳定
export default React.memo(DynamicBackground);
