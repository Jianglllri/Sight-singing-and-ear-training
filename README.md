# 听音训练 (Sound Training)

一个基于 Flask 的交互式音乐听音训练应用，帮助用户通过科学方法提升音乐听力能力。

## 来源说明

本项目最初基于 [Airyleo/Sight-singing-and-ear-training](https://github.com/Airyleo/Sight-singing-and-ear-training) 继续开发，当前仓库为在原始版本基础上的扩展和整理。

## 🎯 项目简介

本项目旨在帮助音乐爱好者、学生和专业音乐人通过系统化的训练提高听音能力，从"大概准"到精确识别音高，甚至培养绝对音感。
当前已完成自然大调所有调式听音训练，后续作者将继续完善其他专业训练需求

### 核心理念
- 音乐不是听见的，是解构的
- 你的耳朵可以像眼睛一样精确
- 从'大概准'到绝对音感之间，只差一套科学方法

## ✨ 功能特点

### 训练模式
- **自然大调音阶训练**：专注于自然大调音阶的音高识别

### 页面预览

#### 首页
![首页预览](static/screenshots/index.png)

#### 音阶训练页面
![音阶训练页面预览](static/screenshots/scale.png)

### 技术特色
- 交互式钢琴界面
- 高质量音频样本
- 响应式设计，支持多设备访问
- 直观的用户界面

## 🛠️ 技术栈

### 后端
- Python 3.x
- Flask 2.0.0+

### 前端
- HTML5
- CSS3
- JavaScript
- Bootstrap 5.3.0

### 音频资源
- 高质量钢琴音频样本
- 完整的88键钢琴音高覆盖

## 📦 安装与运行

### 一键启动（推荐）

双击项目根目录下的 **`一键启动.bat`**，脚本将自动完成：
1. 检测 Python 环境
2. 安装项目依赖
3. 启动 Flask 服务器
4. 自动打开浏览器访问训练页面

### 手动运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/Airyleo/Sight-singing-and-ear-training.git
   cd sound_training
   ```

2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **运行应用**
   ```bash
   python app.py
   ```

4. **访问应用**
   打开浏览器，访问 http://127.0.0.1:5000

## 📁 项目结构

```
sound_training/
├── 一键启动.bat             # 一键启动脚本（推荐）
├── app.py                 # Flask 应用主文件
├── requirements.txt       # 项目依赖
├── README.md              # 项目说明文档
├── static/                # 静态文件
│   ├── audio/             # 音频文件
│   │   ├── piano/         # 钢琴音频样本
│   │   └── voice/         # 唱名人声录音
│   ├── css/               # CSS 样式文件
│   ├── js/                # JavaScript 文件
│   └── images/            # 图片资源
└── templates/             # HTML 模板文件
    ├── index.html         # 首页
    ├── c_major_scale.html # 自然大调音阶训练页面
    ├── natural_scale_training.html # 自然音阶训练页面
    ├── free_training.html # 自由训练页面
    └── piano_test.html    # 钢琴测试页面
```

## 🎵 音频资源

项目包含完整的钢琴88键音频样本，涵盖：
- 基本音高（C, D, E, F, G, A, B）
- 升降音（# 和 b）
- 不同八度

## 📄 许可证

本项目采用 **CC BY-NC 4.0 许可证**（知识共享署名-非商业性使用 4.0 国际许可协议）。

### 许可条款
- ✅ **允许**：个人使用、教育目的、非商业项目、修改和分发
- ❌ **禁止**：商业用途
- ⚠️ **要求**：必须署名原作者

### 详细信息
请参阅 [CC BY-NC 4.0 许可证](https://creativecommons.org/licenses/by-nc/4.0/) 了解完整条款。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

### 贡献指南
1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 📞 联系方式



## 🙏 致谢

- 音频样本：感谢提供高质量钢琴音频的贡献者，所有采用的开源项目均在网页中展示
- 设计灵感：@Photo by weston m on Unsplash
- 背景图片：@Photo by Wes Hicks on Unsplash

---

**享受音乐，享受训练！** 🎶