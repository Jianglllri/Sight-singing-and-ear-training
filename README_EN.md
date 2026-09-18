# Sight-singing and Ear Training (听音训练)

An interactive music ear-training application based on Flask, helping users improve pitch, interval, melodic-contour and jianpu (numbered notation) dictation skills through systematic practice.

## Origin

This project started from [Airyleo/Sight-singing-and-ear-training](https://github.com/Airyleo/Sight-singing-and-ear-training) and is continued/extended in this repository.

## 🎯 Project Introduction

- Music is not just heard, it's deconstructed
- Your ears can be as precise as your eyes
- Between "approximately accurate" and absolute pitch, there is only one scientific method

## ✨ Features

### Training Modes
- **Natural major scale training**: pitch recognition of natural major scales
- **Pitch training**: single-note/interval comparison, whole/half-step judgement, octave direction, melodic contour (pair-by-pair ↑ / → / ↓)
- **Jianpu dictation**: built-in song library + custom import, with "contour / solfège / full dictation" difficulty levels
- **Free practice · Piano simulator**: 88-key piano for free playing and listening

### Page Preview

#### Homepage
![Homepage Preview](static/screenshots/index.png)

#### Scale Training Page
![Scale Training Page Preview](static/screenshots/scale.png)

### Technical Features
- Interactive piano interface
- High-quality piano samples (full 88 keys) with automatic fallback to synthesized tone
- Transposition to any key plus octave up/down playback
- SVG-based jianpu rendering
- Responsive design for multiple devices

## 🛠️ Technology Stack

### Backend
- Python 3.x
- Flask 3.x (see `requirements.txt`)
- SQLite (user song library)

### Frontend
- HTML5 / CSS3 / JavaScript
- Bootstrap 5.3.0 (local static files first, CDN as fallback)

### Audio Resources
- High-quality piano audio samples
- Complete 88-key piano pitch coverage

## 📦 Installation and Running

### One-Click Launch (Recommended)

- **Windows**: double-click `一键启动.bat` in the project root
- **macOS / Linux**: run `./start.sh`

The script will:
1. Check the Python environment
2. Create a virtualenv and install/update dependencies (also re-installs when `requirements.txt` changes)
3. Start the Flask server
4. Open the browser

### Manual Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jianglllri/Sight-singing-and-ear-training.git
   cd Sight-singing-and-ear-training
   ```

2. **Install dependencies**
   ```bash
   python3 -m venv .venv
   ./.venv/bin/pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   ./.venv/bin/python app.py
   ```

4. **Access the application**
   Open your browser and visit http://127.0.0.1:5000

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `FLASK_HOST` | `127.0.0.1` | Bind address; set `0.0.0.0` to expose |
| `FLASK_PORT` | `5000` | Listening port |
| `FLASK_DEBUG` | `0` | Debug mode; **keep it off in production** |
| `JIANPU_DB_PATH` | `instance/jianpu_library.db` | Custom SQLite database path |

### Public Deployment and Authentication

The application is designed for single-user / intranet scenarios and intentionally does **not** implement application-level write authentication (to avoid embedding secrets in the frontend).
If you expose it publicly, terminate authentication at a reverse proxy. For example, Nginx Basic Auth:

```nginx
location / {
    auth_basic "Sound Training";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://127.0.0.1:5000;
}
```

You may also use OAuth, a VPN, or an IP allow-list. Run the app with a production WSGI server (Gunicorn/Waitress) instead of the Flask dev server.

## 📁 Project Structure

```
Sight-singing-and-ear-training/
├── app.py                     # Flask app (pages + song library / OCR API)
├── songs.json                 # Single source of truth for built-in songs
├── requirements.txt           # Runtime dependencies
├── start.sh                   # macOS / Linux launcher
├── 一键启动.bat                # Windows launcher
├── tools/
│   └── build_assets.py        # Generates frontend data from songs.json and syncs docs/
├── static/                    # Source static assets (used by Flask)
│   ├── audio/piano/           # Piano samples
│   ├── audio/voice/           # Solfège voice recordings
│   ├── vendor/bootstrap/      # Local Bootstrap
│   ├── css/  js/  images/  screenshots/
├── templates/                 # Jinja2 templates (used by Flask)
│   ├── index.html
│   ├── c_major_scale.html
│   ├── pitch_training.html
│   ├── jianpu_training.html
│   └── piano_simulator.html
├── docs/                      # GitHub Pages static site (generated, do not edit)
└── instance/                  # Runtime SQLite database (gitignored)
```

## 🎼 Song Data and Static Site Build

- Built-in songs use **`songs.json` as the single source of truth**: the backend seeds the database from it, and `static/js/builtin_songs.js` is generated from it as well.
- After editing songs, run the build script to sync the frontend data and `docs/`:

  ```bash
  python3 tools/build_assets.py          # generate + sync
  python3 tools/build_assets.py --check  # check only (used by CI)
  ```

- `docs/` is generated from `templates/` and `static/`; do not maintain both by hand.
- Built-in songs are **read-only**: editing one in the UI saves a copy ("Save as copy") instead of overwriting the built-in entry; your changes also survive restarts.
- Built-in songs ship with static score images (`static_image` in `songs.json`) which the API returns directly; images are stored in SQLite only when you **manually upload** one for a custom song.
- Built-in songs are migrated by `source_id`: when you change a built-in song's notation/tempo/key in `songs.json`, existing databases are updated on next start (titles are never rewritten, so no duplicates are created).

## 🎵 Audio Resources

The project includes complete 88-key piano audio samples covering basic pitches, accidentals, and multiple octaves.

## 📄 License

This project is licensed under the **CC BY-NC 4.0 License** (Creative Commons Attribution-NonCommercial 4.0 International License).

- ✅ **Allowed**: personal use, education, non-commercial projects, modification and distribution
- ❌ **Prohibited**: commercial use
- ⚠️ **Required**: attribution to the original author

See the [CC BY-NC 4.0 License](https://creativecommons.org/licenses/by-nc/4.0/) for details.

## 🤝 Contribution

Issues and pull requests are welcome.

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- Audio samples: thanks to the contributors who provided high-quality piano audio
- Design inspiration: @Photo by weston m on Unsplash
- Background image: @Photo by Wes Hicks on Unsplash

---

**Enjoy music, enjoy training!** 🎶
