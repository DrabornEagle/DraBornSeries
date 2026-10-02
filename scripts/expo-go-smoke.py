#!/usr/bin/env python3
"""Run source in the official Expo Go runtime. Never builds an app APK/AAB."""
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET

out = Path('artifacts/expo-go')
out.mkdir(parents=True, exist_ok=True)
metro_log = Path(os.environ['RUNNER_TEMP']) / 'dbs-metro.log'

def adb(*args):
    return subprocess.check_output(['adb', *args], text=True)

def logs():
    value = adb('logcat', '-d') + '\n' + metro_log.read_text(errors='replace')
    value = re.sub(r'https?://[^\s]+', '[media]', value)
    (out / 'logcat.txt').write_text(value)
    return value

adb('install', '-r', os.environ['RUNNER_TEMP'] + '/expo-go.apk')
adb('shell', 'appops', 'set', 'host.exp.exponent', 'SYSTEM_ALERT_WINDOW', 'allow')
adb('reverse', 'tcp:8081', 'tcp:8081')
adb('logcat', '-c')
with metro_log.open('w') as stream:
    metro = subprocess.Popen(['npx', 'expo', 'start', '--go', '--localhost', '--clear'], stdout=stream, stderr=stream, env={**os.environ, 'CI': '1', 'EXPO_NO_TELEMETRY': '1'})
    try:
        for attempt in range(40):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8081/status', timeout=1) as response:
                    if 'packager-status:running' in response.read().decode():
                        break
            except Exception:
                pass
            time.sleep(1)
        else:
            raise AssertionError('Expo Metro did not start.')
        adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'exp://127.0.0.1:8081/--/?episode=aa930f3f-db90-4bc6-917a-e9284f84a4b1', 'host.exp.exponent')
        for attempt in range(48):
            time.sleep(5)
            value = logs()
            if re.search(r'FATAL EXCEPTION|Fatal signal|JavascriptException|TurboModuleRegistry.*could not be found', value):
                raise AssertionError('Expo Go runtime crashed; see sanitized logs.')
            if 'DraBornSeries: R2 browser video frame rendered' in value and 'DraBornSeries: video playback advanced' in value:
                break
            if attempt % 4 == 3:
                # Dismiss only Expo Go's first-run development tip.
                try:
                    adb('shell', 'uiautomator', 'dump', '/sdcard/dbs-expo.xml')
                    root = ET.fromstring(adb('shell', 'cat', '/sdcard/dbs-expo.xml'))
                    for node in root.iter():
                        label = (node.get('text', '') + ' ' + node.get('content-desc', '')).strip().lower()
                        if label in ['got it', 'continue', 'understood']:
                            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
                            adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                except Exception:
                    pass
        else:
            raise AssertionError('R2 Chromium did not render a frame and advance playback in Expo Go.')
        (out / 'r2-playback.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
        adb('shell', 'uiautomator', 'dump', '/sdcard/dbs-expo.xml')
        (out / 'ui.xml').write_text(adb('shell', 'cat', '/sdcard/dbs-expo.xml'))
        print('Expo Go 58: real R2 KAYRA frame rendered and playback time advanced; no app APK built.')
    finally:
        logs()
        metro.terminate()
        try:
            metro.wait(timeout=10)
        except subprocess.TimeoutExpired:
            metro.kill()
