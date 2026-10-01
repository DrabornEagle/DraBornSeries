#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts/smoke
adb install -r artifacts/release/DraBornSeries-v0.7.3-release.apk
adb logcat -c
adb shell am start -W -n com.draborneagle.drabornseries/.MainActivity
for attempt in $(seq 1 8); do
  sleep 5
  adb logcat -d > artifacts/smoke/logcat.txt
  if rg 'FATAL EXCEPTION|Fatal signal|Unable to load script|JavascriptException|Invariant Violation|TurboModuleRegistry.*could not be found' artifacts/smoke/logcat.txt; then
    exit 1
  fi
  adb shell pidof com.draborneagle.drabornseries
done
adb shell uiautomator dump /sdcard/dbs-ui.xml
adb pull /sdcard/dbs-ui.xml artifacts/smoke/ui.xml
adb exec-out screencap -p > artifacts/smoke/startup.png
python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
root = ET.fromstring(Path('artifacts/smoke/ui.xml').read_text())
texts = ' '.join((node.get('text','')+' '+node.get('content-desc','')) for node in root.iter())
assert 'DraBorn' in texts, texts
assert any(word in texts for word in ['Ana Sayfa', 'Keşfet', 'İlk hikâyeni', 'Hemen izle']), texts
print('Signed release remains running and renders the real catalog/navigation.')
PY
python3 - <<'PY'
from pathlib import Path
import re, subprocess, time, xml.etree.ElementTree as ET

def adb(*args):
    return subprocess.check_output(['adb', *args], text=True)

def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/dbs-ui.xml')
    return ET.fromstring(adb('shell', 'cat', '/sdcard/dbs-ui.xml'))

def tap(label):
    for node in dump().iter():
        text = node.get('text', '') + ' ' + node.get('content-desc', '')
        if label in text and node.get('enabled') == 'true':
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
            if x2 > x1 and y2 > y1:
                adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                return True
    return False

assert tap('Ödüller'), 'Rewards navigation is missing.'
time.sleep(3)
for attempt in range(5):
    if tap('Reklamı izle'):
        break
    if attempt == 4:
        raise AssertionError('Android test ad button is missing.')
    adb('shell', 'input', 'swipe', '500', '1800', '500', '650', '450')
    time.sleep(1)

for _ in range(12):
    time.sleep(5)
    logs = adb('logcat', '-d')
    Path('artifacts/smoke/logcat.txt').write_text(logs)
    assert not re.search(r'FATAL EXCEPTION|Fatal signal|JavascriptException', logs), 'Release crashed during test ad.'
    if 'DraBornSeries: AdMob test ad opened' in logs:
        break
else:
    raise AssertionError('Official AdMob test ad did not open; see logcat.')
Path('artifacts/smoke/test-ad.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
Path('artifacts/smoke/test-ad-ui.xml').write_text(adb('shell', 'cat', '/sdcard/dbs-ui.xml'))
print('Official AdMob rewarded test ad loaded and opened in the signed release APK.')
PY
