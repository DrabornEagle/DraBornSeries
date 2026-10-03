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

def ui():
    adb('shell', 'uiautomator', 'dump', '/sdcard/dbs-expo.xml')
    value = adb('shell', 'cat', '/sdcard/dbs-expo.xml')
    (out / 'ui.xml').write_text(value)
    return ET.fromstring(value)

def capture(name):
    (out / (name + '.png')).write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
    ui()

def tap_label(label):
    root = ui()
    for node in root.iter():
        if label in [node.get('text', ''), node.get('content-desc', '')]:
            bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
            if len(bounds) == 4:
                x1, y1, x2, y2 = bounds
                adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                return True
    return False

def assert_runtime(value):
    if re.search(r'FATAL EXCEPTION|Fatal signal|JavascriptException|TurboModuleRegistry.*could not be found|Cannot use shared object that was already released|Cannot set prop.*player', value):
        raise AssertionError('Expo Go native player/runtime failed; see sanitized logs.')

adb('install', '-r', os.environ['RUNNER_TEMP'] + '/expo-go.apk')
adb('shell', 'appops', 'set', 'host.exp.exponent', 'SYSTEM_ALERT_WINDOW', 'allow')
adb('reverse', 'tcp:8081', 'tcp:8081')
adb('logcat', '-c')
with metro_log.open('w') as stream:
    metro = subprocess.Popen(['npm', 'run', 'test:phone'], stdout=stream, stderr=stream, env={**os.environ, 'CI': '1', 'EXPO_NO_TELEMETRY': '1'})
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
            assert_runtime(value)
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
            if 'DraBornSeries: R2 native video frame rendered' in value and 'DraBornSeries: video playback advanced' in value:
                break
        else:
            raise AssertionError('R2 native player did not render a frame and advance playback in Expo Go.')
        # Dismiss Expo's own development menu before exercising our full screen.
        if tap_label('Continue'):
            time.sleep(1)
        tap_label('Got it')
        # Go's Continue tip opens its tools sheet, whose Close icon covers our controls.
        if tap_label('Close'):
            time.sleep(1)
        capture('before-fullscreen')
        if not tap_label('Tam ekran'):
            tap_label('Oynatıcı kontrollerini göster veya gizle')
            if not tap_label('Tam ekran'):
                # The normal player can extend below a small phone viewport.
                width, height = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))[-1])
                adb('shell', 'input', 'swipe', str(width//2), str(height*3//4), str(width//2), str(height*2//5), '350')
                tap_label('Oynatıcı kontrollerini göster veya gizle')
                assert tap_label('Tam ekran'), 'Full screen control was not reachable; see ui.xml and final screenshot.'
        time.sleep(2)
        (out / 'fullscreen.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
        adb('shell', 'input', 'keyevent', '4')
        time.sleep(2)
        assert_runtime(logs())

        # Reproduce the Fast Refresh path from the owner's Termux screenshot.
        before_log = logs()
        before = before_log.count('DraBornSeries: video playback advanced')
        before_frames = before_log.count('DraBornSeries: R2 native video frame rendered')
        module = Path('packages/ui/VideoPlayer.tsx')
        original = module.read_text()
        module.write_text(original + '\n// CI-only Fast Refresh lifecycle probe.\n')
        for attempt in range(30):
            time.sleep(3)
            value = logs(); assert_runtime(value)
            if (value.count('DraBornSeries: R2 native video frame rendered') > before_frames
                    and value.count('DraBornSeries: video playback advanced') > before):
                break
        else:
            raise AssertionError('R2 playback did not resume after Fast Refresh.')
        (out / 'r2-playback.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
        adb('shell', 'uiautomator', 'dump', '/sdcard/dbs-expo.xml')
        (out / 'ui.xml').write_text(adb('shell', 'cat', '/sdcard/dbs-expo.xml'))
        print('Expo Go 58: real R2 KAYRA native frame/time, fullscreen and Fast Refresh passed; no app APK built.')
    finally:
        logs()
        try:
            capture('final-state')
        except Exception:
            pass
        metro.terminate()
        try:
            metro.wait(timeout=10)
        except subprocess.TimeoutExpired:
            metro.kill()
