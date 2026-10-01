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
