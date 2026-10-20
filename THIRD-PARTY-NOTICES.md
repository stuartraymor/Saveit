# Third-party software in Saveit

Saveit itself is released under the MIT License (see LICENSE). It includes or installs the following open-source components. Their own license texts are kept next to them in `app/third-party/`.

| Component | Used for | License | Where |
|---|---|---|---|
| [Electron](https://www.electronjs.org/) 33 (with Chromium and Node.js) | The app runtime. Not stored in this repository: Setup downloads the official release from GitHub and checks its SHA-256 fingerprint. | MIT, plus the licenses of the components it contains (listed in `LICENSES.chromium.html` inside the installed runtime) | Installed next to Saveit |
| [JSZip](https://stuk.github.io/jszip/) | Reading and writing zip files (Word, PowerPoint and Saveit files) | MIT (JSZip is dual-licensed MIT or GPLv3; Saveit uses it under MIT) | `app/third-party/jszip-LICENSE.txt` |
| [pako](https://github.com/nodeca/pako) | Compression | MIT | `app/third-party/pako-LICENSE.txt` |
| [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) | PowerPoint export | MIT | `app/third-party/pptxgenjs-LICENSE.txt` |
| [lamejs](https://github.com/zhuker/lamejs) 1.2.1 | MP3 encoding | LGPL-3.0. Kept as its own unmodified file (`app/third-party/lame.min.js`); you may replace that file with another build of lamejs. Source: the lamejs project page above. | `app/third-party/lamejs-LICENSE.txt` |

The step-capture helper (`app/saveit-steps.exe`), the update window (`app/saveit-updating.exe`) and the installer (`Saveit-Setup.exe`) are built from the source files in `native/` with the C# compiler that ships with Windows.
