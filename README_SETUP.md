# 探哆哆公司团队周计划：在线版说明

这个文件夹是 `GitHub Pages + Supabase` 在线版。

## 这次更新后你要做什么

1. 先去 Supabase 重新执行一次 `supabase-schema.sql`
2. 再把下面这些文件重新上传到 GitHub 仓库：
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `supabase-schema.sql`
   - `README_SETUP.md`

这次新增了昵称、Leader 私有备注、成员建议、按周查询、修改/删除计划、积分排名和每周记录归档，所以 Supabase SQL 必须先更新。

## Supabase 更新步骤

1. 打开 Supabase 项目
2. 左侧进入 `SQL Editor`
3. 新建查询
4. 复制 `supabase-schema.sql` 的全部内容
5. 粘贴进去，点击 `Run`

如果你之前已经设置过 leader 密码，重新执行 SQL 一般不会覆盖它。

## GitHub 上传步骤

1. 打开 GitHub 仓库
2. 进入你网页文件所在的位置，通常是仓库首页的根目录
3. 点击 `Add file`
4. 点击 `Upload files`
5. 把本文件夹里的文件拖进去
6. 如果 GitHub 提示同名文件已存在，选择覆盖/更新即可
7. 页面底部点击绿色按钮 `Commit changes`
8. 等 1-3 分钟后刷新 GitHub Pages 网页

## 当前功能

- 成员账号只能由 Leader 创建
- 成员可以修改密码、昵称、头像和网页背景色
- 成员端不会显示 Leader 私有备注
- 成员可以提交本周 Todo，完成每条计划获得 1 分
- 成员每周最多设置 5 条本周计划
- 每人每周本周计划最多获得 5 分；重新执行 SQL 会把旧测试产生的超额计划积分自动归 0
- 成员可以响应 Leader 本周计划，打卡随机获得 0-5 分
- 成员可以给公司提建议，Leader 后台可查看
- 成员端可以查看卡通风格的成员积分排名
- 没有上传头像的成员会自动显示一个小动物头像
- 每周日会进入新的一周，成员端本周计划和建议入口自动按新周显示，旧记录不会删除
- Leader 可以发布全员计划，也可以修改或删除已发布计划
- Leader 可以按周查询成员计划、打卡、专属任务和进度
- Leader 可以新增、修改、删除成员账号
- Leader 可以给成员分配专属任务
- Leader 可以增加或减少成员积分

## Supabase 配置位置

`config.js` 里需要填写：

```js
window.TEAM_WIDGET_CONFIG = {
  SUPABASE_URL: "https://你的项目.supabase.co",
  SUPABASE_ANON_KEY: "你的 anon public key"
};
```

Supabase 后台位置：

`Project Settings` -> `API`

复制：

- `Project URL`
- `anon public`
