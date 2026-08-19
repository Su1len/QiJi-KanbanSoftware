import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// NW.js：窗口关闭时彻底退出，防止后台残留进程。
// 应用页面是远程页面（http://localhost），inject-js-end 可能不生效，
// 因此这里在应用代码里再注册一次（需 manifest 配置 node-remote 白名单）。
try {
  const nwG = (window as any).nw;
  if (nwG && nwG.Window && nwG.App && !(window as any).__QUIT_HANDLER_INSTALLED__) {
    const nwWin = nwG.Window.get();
    nwWin.on('close', function (this: any) {
      this.hide();
      nwG.App.quit();
      this.close(true);
    });
    (window as any).__QUIT_HANDLER_INSTALLED__ = true;
  }
} catch (e) {
  // 非 NW.js 环境（普通浏览器开发模式）静默跳过
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
