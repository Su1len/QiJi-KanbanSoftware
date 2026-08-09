import React from 'react';

const HelpTab: React.FC = () => (
  <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--color-text-primary)' }}>
    <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>快速上手</h4>

    <p><strong>新建任务</strong>：点击底部「+ 新建主任务」，填写名称后保存。在详细模式下可填写 THEMRPR 七维度信息。</p>
    <p><strong>子任务</strong>：在表单中展开子任务区，添加并命名。设置「后序」可建立工作流水线——完成一个自动跳下一个。</p>
    <p><strong>日期切换</strong>：使用顶部 <code>&lt;&lt;</code> <code>&lt;</code> <code>&gt;</code> <code>&gt;&gt;</code> 按钮切换日期，或直接点击星期按钮。进行中和暂搁置的任务会跨日自动继承。</p>
    <p><strong>项目视图</strong>：左侧栏点击文件夹图标进入。在任务表单中填写「项目名称」即可归入项目。拖拽卡片可改变任务状态。</p>
    <p><strong>AI 助理</strong>：在表单中点击「🤖 AI助理」，用自然语言描述任务，AI 会解析为结构化表单。</p>
    <p><strong>复盘</strong>：已完成的任务可点击「复盘」按钮，填写计划 vs 实际对比，支持导出 Markdown 报告。</p>
    <p><strong>主题换肤</strong>：设置 → 换肤中切换深蓝 / 墨绿 / 暖橙 / 浅灰四套主题，即时生效。</p>

    <h4 style={{ margin: '16px 0 8px', fontSize: 15 }}>任务编辑方式</h4>
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      <li><strong>详细模式</strong>：点击看板中任意任务的 THEMRPR 列（目标列），或双击任务行，即可进入编辑表单</li>
      <li><strong>简易模式</strong>：点击看板中的任务名称，即可进入编辑表单</li>
      <li><strong>项目视图</strong>：双击卡片即可进入编辑表单</li>
    </ul>

    <h4 style={{ margin: '16px 0 8px', fontSize: 15 }}>快捷操作</h4>
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      <li>搜索框支持全日期全文搜索，点击结果可跳转</li>
    </ul>

    <h4 style={{ margin: '16px 0 8px', fontSize: 15 }}>数据安全</h4>
    <p>所有数据存储在本地 <code>data/kanban.db</code> 文件中。请定期通过 设置 → 导出任务 →「导出完整数据库」进行备份。</p>
    <p>若需恢复，使用 设置 → 数据管理 →「导入备份」，选择之前导出的 .db 文件即可。</p>
  </div>
);

export default HelpTab;
