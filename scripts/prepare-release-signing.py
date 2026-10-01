"""Create the first release key, or restore the same private Actions backup."""
import json, os, pathlib, secrets, subprocess, urllib.request, zipfile, io

root = pathlib.Path("artifacts/signing")
root.mkdir(parents=True, exist_ok=True)
token, repo = os.environ["GH_TOKEN"], os.environ["GITHUB_REPOSITORY"]
def request(url):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
    return urllib.request.urlopen(req, timeout=60).read()

archives = json.loads(request(f"https://api.github.com/repos/{repo}/actions/artifacts?name=DraBornSeries-release-signing&per_page=100"))["artifacts"]
available = [item for item in archives if not item["expired"] and str(item["workflow_run"]["id"]) != os.environ["GITHUB_RUN_ID"]]
if available:
    item = max(available, key=lambda entry: entry["id"])
    with zipfile.ZipFile(io.BytesIO(request(item["archive_download_url"]))) as archive:
        for name in ["DraBornSeries-release.jks", "signing.json", "KEYSTORE-README.txt"]:
            (root / name).write_bytes(archive.read(name))
    print("Restored the existing release signing key.")
else:
    if archives or pathlib.Path("docs/release-certificate.json").exists():
        raise SystemExit("Existing signing backup is unavailable. Restore the owner's keystore; do not generate a replacement.")
    password = secrets.token_urlsafe(36)
    info = {"alias": "drabornseries-release", "storePassword": password, "keyPassword": password, "storeFile": "DraBornSeries-release.jks"}
    subprocess.run(["keytool", "-genkeypair", "-storetype", "PKCS12", "-keystore", str(root / info["storeFile"]), "-alias", info["alias"], "-storepass:env", "DBS_GENERATE_PASSWORD", "-keypass:env", "DBS_GENERATE_PASSWORD", "-keyalg", "RSA", "-keysize", "4096", "-validity", "10000", "-dname", "CN=DraBornEagle, OU=DraBornSeries, O=DraBornEagle, C=TR"], env={**os.environ, "DBS_GENERATE_PASSWORD": password}, check=True)
    (root / "signing.json").write_text(json.dumps(info, indent=2))
    (root / "KEYSTORE-README.txt").write_text("DraBornSeries release anahtarı\n\nAPK ve AAB aynı anahtarla imzalanmıştır. Şifreler ve alias signing.json içindedir.\nBu dosyaları gizli tut; sonraki güncellemeleri aynı keystore ile imzala.\nGitHub veya web sitesine yükleme. Play App Signing kullanıldığında bu anahtar upload key olarak saklanır.\n")
    print("Created the first DraBornSeries release signing key.")

info = json.loads((root / "signing.json").read_text())
for value in [info["storePassword"], info["keyPassword"]]: print("::add-mask::" + value)
with open(os.environ["GITHUB_ENV"], "a") as env:
    env.write(f"DBS_RELEASE_STORE_FILE={root.resolve() / info['storeFile']}\nDBS_RELEASE_STORE_PASSWORD={info['storePassword']}\nDBS_RELEASE_KEY_PASSWORD={info['keyPassword']}\nDBS_RELEASE_KEY_ALIAS={info['alias']}\n")
