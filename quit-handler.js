// 骐骥看板 — 窗口关闭时彻底退出 NW.js
// 通过 package.json 的 "inject-js-end" 注入到每一个页面，
// 因此即使 launcher.html 跳转到看板界面（旧页面 JS 环境被销毁），
// 看板页面仍会注册本处理器，保证关窗即退出、无后台残留。
(function () {
  try {
    var gui = require('nw.gui');
    var win = gui.Window.get();
    win.on('close', function () {
      this.hide();
      gui.App.quit();
      this.close(true);
    });
    try { window.__QUIT_HANDLER_INSTALLED__ = true; } catch (e) {}
  } catch (e) {
    try { window.__QUIT_HANDLER_ERROR__ = String(e && e.message || e); } catch (e2) {}
    // 非 NW.js 环境（例如普通浏览器中打开）时静默跳过
  }
})();
