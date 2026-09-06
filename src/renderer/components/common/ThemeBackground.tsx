import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const ThemeBackground: React.FC<{ targetComponent: string }> = ({ targetComponent }) => {
  const { theme } = useTheme();
  const overlays = theme.imageOverrides.filter(o => o.targetComponent === targetComponent);
  if (overlays.length === 0) return null;
  // 动态背景启用时，主内容区静态底图让位给动态 HTML 层（HTML 自带 bg.png 底图）
  if (targetComponent === 'MainContent' && theme.dynamicBackgroundEnabled === true && !!theme.dynamicBackground) {
    return null;
  }

  return (
    <>
      {overlays.map((overlay, i) => {
        const hasImage = overlay.imagePath && overlay.imagePath.length > 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 0,
              opacity: overlay.opacity ?? 0.1,
              ...(hasImage
                ? {
                    backgroundImage: `url(${overlay.imagePath})`,
                    backgroundPosition: overlay.position || 'center',
                    backgroundSize: overlay.size || 'cover',
                    backgroundRepeat: 'no-repeat',
                  }
                : {
                    background: `linear-gradient(135deg, ${overlay.color1 || 'transparent'}, ${overlay.color2 || 'transparent'})`,
                    backgroundPosition: overlay.position || 'center',
                    backgroundSize: overlay.size || 'cover',
                  }
              ),
            }}
          />
        );
      })}
    </>
  );
};

export default ThemeBackground;
