# FileDiff

轻量级文件夹内容比较器，比较两个文件夹平级内容的差异（不递归子目录）。

## 在线版本

浏览器版地址：`https://SongAoBo.github.io/FileDiff/`

在线版支持拖拽文件夹和点击选择文件夹，只保留平级文件名比较。所有读取都在浏览器本地完成，不上传文件内容。

### 浏览器兼容

- 推荐 Chrome / Edge
- 不支持文件夹选择 API 的浏览器会自动回退到文件夹上传控件
- 在线版不支持手动输入 Windows 本地路径

## Windows 本地版

1. 双击 `start.cmd` 启动服务（自动打开浏览器）
2. 将两个文件夹拖入对比区域，或点击选择，或手动输入路径
3. 点击「比较」查看差异结果
4. 用完点击页面右上角「退出」关闭服务

## 技术栈

- Node.js
- 纯浏览器端文件系统 API（File System Access API / webkitGetAsEntry）
- HTML / CSS / JavaScript

## 项目结构

```text
file-diff/
├── docs/           # GitHub Pages 浏览器版
│   ├── index.html
│   ├── style.css
│   └── app.js
├── renderer/       # Windows 本地版前端
├── start.cmd       # Windows 启动脚本
├── server.js       # 本地 Node 服务
└── package.json
```

## GitHub Pages

在仓库的 `Settings > Pages` 中选择：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`

保存并等待部署完成后，访问 `https://SongAoBo.github.io/FileDiff/`。
