# 团队周计划在线版部署说明

这个文件夹是 `GitHub Pages + Supabase` 在线版。

## 你要做的事

### 1. 在 Supabase 创建数据表

1. 打开 Supabase 项目
2. 左侧进入 `SQL Editor`
3. 新建查询
4. 复制 `supabase-schema.sql` 里的全部内容
5. 把第一行的默认 leader 密码改掉：

```sql
insert into public.app_settings (key, value)
values ('leader_code', '123456')
```

把 `123456` 改成你自己的 leader 密码。

6. 点击 `Run`

如果你之前已经执行过旧版 SQL，也可以直接把新版 `supabase-schema.sql` 再执行一次。它会自动补充成员账号、专属任务、积分加减等新功能。

### 2. 填写 Supabase 配置

打开 `config.js`，把里面两项换成你的 Supabase 信息：

```js
window.TEAM_WIDGET_CONFIG = {
  SUPABASE_URL: "https://你的项目.supabase.co",
  SUPABASE_ANON_KEY: "你的 anon public key"
};
```

位置：

Supabase 项目里进入 `Project Settings` -> `API`。

你需要复制：

- `Project URL`
- `anon public`

### 3. 上传到 GitHub

把这个文件夹里的这些文件上传到 GitHub 仓库：

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `supabase-schema.sql`

### 4. 打开 GitHub Pages

1. 进入 GitHub 仓库
2. 点击 `Settings`
3. 点击 `Pages`
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main`
6. Folder 选择 `/root`
7. 保存

等 1-3 分钟，GitHub 会给你一个网址。

## 使用方式

- 成员打开 GitHub Pages 网址即可使用
- Leader 点击右上角 `Leader 登录`
- 输入你在 Supabase SQL 里设置的 leader 密码
- Leader 可以添加成员、发布计划、看进度

## 新版功能

- 页面标题：探哆哆公司团队周计划
- 成员端改为 `成员登录`
- 成员账号和初始密码只能由 Leader 创建
- Leader 可以查看成员账号、密码和员工姓名备注
- 成员登录状态会保存在当前浏览器
- 成员后续可以自己修改密码
- 成员可以自己调整网页背景色
- 成员可以上传自己的头像
- 设置完本周计划后会随机显示励志名言
- 完成每条周计划获得 1 分
- 响应打卡不再需要输入进度，点击即可随机获得 0-5 分
- Leader 可以给指定成员发布专属任务
- Leader 后台可以查看成员计划、积分、打卡完成进度
- Leader 可以给指定成员增加或减少积分

## 注意

这是团队内部轻量版。成员提交、打卡、完成 Todo 不需要登录，方便使用。

Leader 的管理操作通过 Supabase 数据库函数校验 leader 密码，不会把管理权限完全暴露在网页里。
