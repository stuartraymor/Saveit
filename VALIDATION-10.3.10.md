# Saveit 10.3.10 validation

Tested on 2026-11-18 on Windows 11 with two monitors (main monitor at 200 % scaling).

All app runs used disposable profiles (`SAVEIT_REVIEW_DATA`) and a disposable runtime copy. The owner's library was not touched.

## Scrolling capture (real screen, real Saveit, `tests/native-live-scroll.cjs`)

A test page sits under a selected area and is scrolled with real mouse-wheel and keyboard input. Every row of the test page carries a binary row number. The result is decoded row by row and must contain:
- every content row exactly once, in order;
- the sticky header exactly once;
- no gaps and no repeats.

| Test | Scenario | Result |
|---|---|---|
| A | Steady wheel scrolling to the end | PASS, 4810 px |
| B | Scroll down, back up, then down again (scrolling up must add nothing) | PASS, 2210 px |
| C | Stop part way, then click Capture | PASS, 2910 px |
| D | Page-sized jumps and very small steps, mixed | PASS, 3090 px |
| E | Fast scrolling | PASS, 5810 px |
| F | Long page, about 20,000 px | PASS, 20450 px |
| G | Sticky header 56 px plus content | PASS, 1510 px; header appears once |

All seven tests had 0 discontinuities and 0 repeated rows.

Unit and replay tests (`tests/live-stitch.test.js`) all pass. They cover:
- the pointer and dirty-row cases (P1–P7);
- a gradient picture with a tiny first step (D2);
- dithering jitter, focus-border changes, small overlaps and fixed-footer evidence.

### Speed

The selected area is read by `saveit-region-grab.exe` (GDI, per-monitor DPI aware) in 12–36 ms per look. The previous screen capture took 0.5–0.8 s per look, which is why scrolling capture felt slow. If the helper is missing, the old capture path is still used.

### Comparison with Snagit

TechSmith documents Snagit's manual panoramic capture as:
1. select an area;
2. click Start;
3. scroll yourself;
4. click Stop.

Saveit's flow is the same: select, scroll yourself, click Capture.

Sources:
- https://www.techsmith.com/learn/tutorials/snagit/scrolling-capture/
- https://www.techsmith.com/blog/scrolling-screenshot
- https://support.techsmith.com/hc/en-us/articles/4407009878029-Scrolling-Preview-Window-and-Control-Bar-is-Captured-by-Snagit

## Voice effects on real speech (`tests/voice-speech-check.cjs`)

The test speech is Windows text-to-speech: 11.88 s long, with a voice pitch of 90.1 Hz, played at a peak of −1 dBFS.

Every effect kept the exact original length, produced no NaN values, peaked below 0 dBFS and added no clicks.

| Effect | Peak | Pitch |
|---|---|---|
| Deep −5 | −2.02 dBFS | 67.4 Hz (expected 67.5 Hz), −1 cent |
| Deep −12 | −1.65 dBFS | 45.5 Hz (expected 45.0 Hz), +20 cents |
| High +7 | −1.20 dBFS | 134.1 Hz (expected 134.9 Hz), −11 cents |
| High +12 | −1.09 dBFS | 177.1 Hz (expected 180.1 Hz), −29 cents |
| Robot | −1.36 dBFS | — |
| Radio / Telephone | −0.36 dBFS | — |
| Echo | −4.04 dBFS | — |
| Reverb | −4.00 dBFS | — |

Radio was +1.36 dBFS before the safety stage was added.

The rendered WAVs are in `outputs/voice-effects-speech/` and are not committed.

Browser suite `voice-effects-tests`: 12/12 PASS. The audio pitch regression suite: 82/82 PASS.

## Native app checks (real Electron runtime)

| Suite | Result |
|---|---|
| native-gui-10310 | 14/14 PASS |
| native-window-capture | 6/6 PASS |
| native-widget-hide1022 | 16/16 PASS (passed on a rerun; the first run exited 1 with no failed checks) |
| native-record-controls | PASS |
| native-live-scroll A–G | PASS |
| native-video-journey | FAIL on both 10.3.9 and 10.3.10; see the next paragraph |

native-gui-10310 covers:
- right-click before a selection makes no capture;
- right-click capture equals the Capture button, once;
- the widget Clipboard appears only in Image mode;
- the top-bar Clipboard is unchanged;
- the AppUserModelID matches.

native-record-controls previously checked for the old version 10.2.10. It now reads the version from package.json.

native-video-journey: a 1280×720 region records as 718 px high. 10.3.9 gives exactly the same result, so this is not a regression. It is a known limitation and still needs to be investigated.

The journey test's default FFmpeg path had a typo, now fixed.

## Browser suites (Playwright, Edge)

These suites passed:
- rotate 24
- polish 35
- audio94 24
- audio-export 6
- audio113 16
- stepguide 10
- review103 8
- review2 11
- update-ui 13
- video-editor 41
- video-annotation 8
- video-audio-gaps 7
- video-flow 8
- video-timeline-controls 5
- flatten 5
- voice-effects 12

Node tests: all pass, including the CRLF check and the scrolling capture asset checks.

These suites fail on both 10.3.9 and 10.3.10 with the same checks. The failures are not regressions:
- layer-media: 9 failures (audio insert and paste expectations)
- audio114: 1 failure (compact 800×600 layout)
- audio115: 5 failures (FFmpeg LUFS comparisons and compact layout)
- audio116: 1 failure (compact layout)

## Taskbar identity

Before 10.3.10 was installed, all three Saveit shortcuts (Start menu, desktop and pinned taskbar) had an empty AppUserModelID.

The app repairs them at startup (`syncShortcutIdentity`). After 10.3.10 was installed with `tools/update-installed.ps1` and started, all three read `com.saveit.app`, the same identity the running app uses.

## Known limitations

Scrolling capture:
- Horizontal scrolling was not tested on the real screen.
- Content hidden under a sticky header that was never seen without the header cannot be recovered.
- A plain bar with no text at the top or bottom is treated as fixed.
- A large static overlay over the scrolled content breaks matching. The bar then says it cannot line the view up.
- An overlay scrollbar thumb inside the selected area is captured.
- Exactly repeated content (identical rows over a whole view) is ambiguous.

Other:
- The video recording height loses 2 px in the journey test, the same as in 10.3.9.
