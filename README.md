# 听音训练（Sight-singing and Ear Training）

一个基于 Flask 的交互式音乐听音训练应用，帮助用户通过系统化练习提升音高、音程、旋律走向与简谱听写能力。

## 来源说明

本项目最初基于 [Airyleo/Sight-singing-and-ear-training](https://github.com/Airyleo/Sight-singing-and-ear-training) 继续开发，当前仓库为在其基础上的扩展与整理。

## 🎯 项目简介

- 音乐不是听见的，是解构的
- 你的耳朵可以像眼睛一样精确
- 从“大概准”到绝对音感之间，只差一套科学方法

## ✨ 功能特点

### 训练模式
- **自然大调音阶训练**：专注于自然大调音阶的音高识别
- **音高训练**：单音/音程比较、全音半音判断、八度方向判断、旋律走向（逐对 ↑ / → / ↓）
- **简谱听写**：内置曲库 + 自定义导入，支持“听走向 / 听唱名 / 听写全谱”三档难度
- **自由训练·模拟钢琴**：88 键模拟钢琴，可自由弹奏与被试听

### 页面预览

#### 首页
![首页预览](static/screenshots/index.png)

#### 音阶训练页面
![音阶训练页面预览](static/screenshots/scale.png)

### 技术特色
- 交互式钢琴界面
- 高质量钢琴音频采样（88 键全覆盖），采样不可用时自动回退到合成音
- 支持任意调号移调与八度升降播放
- 简谱 SVG 矢量渲染
- 响应式设计，支持多设备访问

## 🛠️ 技术栈

### 后端
- Python 3.x
- Flask 3.x（见 `requirements.txt`）
- SQLite（用户曲库）

### 前端
- HTML5 / CSS3 / JavaScript
- Bootstrap 5.3.0（本地静态文件优先，CDN 作为兜底）

### 音频资源
- 高质量钢琴音频样本
- 完整的 88 键钢琴音高覆盖

## 📦 安装与运行

### 一键启动（推荐）

- **Windows**：双击项目根目录下的 `一键启动.bat`
- **macOS / Linux**：运行 `./start.sh`

脚本会依次：
1. 检测 Python 环境
2. 创建虚拟环境并安装/更新依赖（`requirements.txt` 变更时也会自动更新）
3. 启动 Flask 服务器
4. 打开浏览器访问页面

### 手动运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/Jianglllri/Sight-singing-and-ear-training.git
   cd Sight-singing-and-ear-training
   ```

2. **安装依赖**
   ```bash
   python3 -m venv .venv
   ./.venv/bin/pip install -r requirements.txt
   ```

3. **运行应用**
   ```bash
   ./.venv/bin/python app.py
   ```

4. **访问应用**
   打开浏览器访问 http://127.0.0.1:5000

### 可配置环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `FLASK_HOST` | `127.0.0.1` | 监听地址；设为 `0.0.0.0` 可对外提供访问 |
| `FLASK_PORT` | `5000` | 监听端口 |
| `FLASK_DEBUG` | `0` | 是否开启调试模式；**公开部署请保持关闭** |
| `FLASK_ADMIN_TOKEN` | 空 | 设置后，所有写接口需携带请求头 `X-Admin-Token` |
| `JIANPU_DB_PATH` | `instance/jianpu_library.db` | 自定义 SQLite 数据库路径 |

> 公开部署建议：`FLASK_DEBUG=0` + 设置 `FLASK_ADMIN_TOKEN` + 使用 Gunicorn/Waitress 等生产服务器（不要使用 Flask 开发服务器）。

## 📁 项目结构

```
Sight-singing-and-ear-training/
├── app.py                     # Flask 应用（页面路由 + 曲库/OCR API）
├── songs.json                 # 内置曲目唯一数据源
├── requirements.txt           # 项目依赖
├── start.sh                   # macOS / Linux 一键启动
├── 一键启动.bat                # Windows 一键启动
├── tools/
│   └── build_assets.py        # 由 songs.json 生成前端数据并同步 docs/
├── static/                    # 源静态资源（Flask 使用）
│   ├── audio/piano/           # 钢琴音频样本
│   ├── audio/voice/           # 唱名人声录音
│   ├── vendor/bootstrap/      # 本地 Bootstrap
│   ├── css/  js/  images/  screenshots/
├── templates/                 # Jinja2 模板（Flask 使用）
│   ├── index.html
│   ├── c_major_scale.html
│   ├── pitch_training.html
│   ├── jianpu_training.html
│   └── piano_simulator.html
├── docs/                      # GitHub Pages 静态站（由构建脚本生成，勿手工改）
└── instance/                  # 运行时生成的 SQLite 数据库（已 gitignore）
```

## 🎼 曲目数据与静态站构建

- 内置曲目以仓库根目录的 **`songs.json` 为唯一数据源**：后端 `app.py` 首次建库时从中播种，前端 `static/js/builtin_songs.js` 也由它生成。
- 修改曲目后运行构建脚本即可同步前端数据与 `docs/` 静态站：

  ```bash
  python3 tools/build_assets.py          # 生成并同步
  python3 tools/build_assets.py --check  # 仅检查是否已同步（CI 使用）
  ```

- `docs/` 由 `templates/` 与 `static/` 自动生成，请勿手工同时维护两份。
- 内置曲目为**只读**：在网页上修改内置曲目会“另存为副本”为自建曲目，不会覆盖内置数据；数据库在重启后也不会重置你的修改。

## 🎵 音频资源

项目包含完整的钢琴 88 键音频样本，涵盖基本音高、升降音与不同八度。

## 📄 许可证

本项目采用 **CC BY-NC 4.0 许可证**（知识共享署名-非商业性使用 4.0 国际许可协议）。

- ✅ **允许**：个人使用、教育目的、非商业项目、修改和分发
- ❌ **禁止**：商业用途
- ⚠️ **要求**：必须署名原作者

详见 [CC BY-NC 4.0 许可证](https://creativecommons.org/licenses/by-nc/4.0/)。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 🙏 致谢

- 音频样本：感谢提供高质量钢琴音频的贡献者
- 设计灵感：@Photo by weston m on Unsplash
- 背景图片：@Photo by Wes Hicks on Unsplash

---

**享受音乐，享受训练！** 🎶
