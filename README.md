# FileDiff

轻量级 Windows 文件夹内容比较器。

比较两个文件夹平级内容的差异（不递归子目录），支持三种输入方式：拖拽、点击选择、手动输入路径。

## 使用方法

1. 双击 `start.cmd` 启动服务（自动打开浏览器）
2. 将两个文件夹拖入对比区域，或点击选择，或手动输入路径
3. 点击「比较」查看差异结果
4. 用完点击页面右上角「退出」关闭服务

## 技术栈

- Node.js
- 纯浏览器端文件系统 API（File System Access API / webkitGetAsEntry）

## 项目结构

```
file-diff/
├── start.cmd       # 启动脚本
├── server.js       # Node 服务
├── renderer/       # 前端页面
│   ├── index.html
│   ├── style.css
│   └── app.js
└── package.json
```
