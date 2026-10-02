"""Use encrypted Secrets, or seal the first key to the owner's public recipient."""
import base64
import hashlib
import json
import os
import pathlib
import secrets
import subprocess
import urllib.request
import zipfile

root = pathlib.Path("artifacts/signing-private")
public = pathlib.Path("artifacts/signing-encrypted")
root.mkdir(parents=True, exist_ok=True)
public.mkdir(parents=True, exist_ok=True)
token, repo = os.environ["GH_TOKEN"], os.environ["GITHUB_REPOSITORY"]


def request(path, method="GET"):
    req = urllib.request.Request(
        "https://api.github.com/repos/" + repo + path,
        method=method,
        headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


# The repository is public. Retire the obsolete plaintext artifacts instead of
# restoring private signing material from them. Only this exact artifact name
# belongs to the earlier release-key bootstrap.
archives = json.loads(request("/actions/artifacts?name=DraBornSeries-release-signing&per_page=100"))["artifacts"]
obsolete = [item for item in archives if item["name"] == "DraBornSeries-release-signing" and not item["expired"]]
for item in obsolete:
    request("/actions/artifacts/" + str(item["id"]), "DELETE")
print("Removed", len(obsolete), "obsolete plaintext signing backups.")

checkpoint = json.loads(pathlib.Path("docs/release-certificate.json").read_text())
encoded = os.environ.get("DBS_RELEASE_KEYSTORE_BASE64", "")
metadata = os.environ.get("DBS_RELEASE_SIGNING_JSON", "")
if encoded or metadata:
    if not encoded or not metadata:
        raise SystemExit("Both encrypted signing Secrets must be configured.")
    info = json.loads(metadata)
    (root / "DraBornSeries-release.jks").write_bytes(base64.b64decode(encoded, validate=True))
    print("Restored release signing material from encrypted repository Secrets.")
else:
    if not checkpoint.get("privateBootstrap"):
        raise SystemExit("Restore the owner's keystore through encrypted signing Secrets. Refusing to generate a replacement key.")
    password = secrets.token_urlsafe(36)
    print("::add-mask::" + password, flush=True)
    info = {"alias": "drabornseries-release", "storePassword": password, "keyPassword": password, "storeFile": "DraBornSeries-release.jks"}
    subprocess.run(
        ["keytool", "-genkeypair", "-storetype", "PKCS12", "-keystore", str(root / info["storeFile"]), "-alias", info["alias"], "-storepass:env", "DBS_GENERATE_PASSWORD", "-keypass:env", "DBS_GENERATE_PASSWORD", "-keyalg", "RSA", "-keysize", "4096", "-validity", "10000", "-dname", "CN=DraBornEagle, OU=DraBornSeries, O=DraBornEagle, C=TR"],
        env={**os.environ, "DBS_GENERATE_PASSWORD": password}, check=True,
    )
    print("Created a new owner-only release signing key.")

if info.get("storeFile") != "DraBornSeries-release.jks" or any(not isinstance(info.get(key), str) or not info[key] or "\n" in info[key] or "\r" in info[key] for key in ["alias", "storePassword", "keyPassword"]):
    raise SystemExit("Invalid signing metadata.")
for value in [info["storePassword"], info["keyPassword"]]:
    print("::add-mask::" + value, flush=True)
certificate = subprocess.check_output(
    ["keytool", "-exportcert", "-keystore", str(root / info["storeFile"]), "-alias", info["alias"], "-storepass:env", "DBS_VERIFY_PASSWORD"],
    env={**os.environ, "DBS_VERIFY_PASSWORD": info["storePassword"]},
)
fingerprint = hashlib.sha256(certificate).hexdigest()
if checkpoint.get("sha256") and fingerprint != checkpoint["sha256"]:
    raise SystemExit("Signing certificate does not match the owner's pinned release key.")
if fingerprint == checkpoint.get("retiredCertificateSha256"):
    raise SystemExit("The retired signing key must never be reused.")
(root / "signing.json").write_text(json.dumps(info, indent=2))
(root / "KEYSTORE-README.txt").write_text(
    "DraBornSeries release anahtarı\n\nAPK ve AAB aynı anahtarla imzalanmıştır. Şifreler ve alias signing.json içindedir.\n"
    "Bu dosyaları gizli tut; sonraki güncellemeleri aynı keystore ile imzala. GitHub veya web sitesine yükleme.\n"
    "Gelecek Actions derlemeleri için GitHub Settings > Secrets and variables > Actions içinde iki repository secret oluştur:\n"
    "DBS_RELEASE_KEYSTORE_BASE64: JKS dosyasının satır sonu içermeyen base64 verisi.\n"
    "DBS_RELEASE_SIGNING_JSON: signing.json dosyasının içeriği. Workflow sertifikayı doğrular; yeni anahtar üretmez.\n"
    "Play App Signing kullanıldığında bu anahtar upload key olarak saklanır.\n"
)
with zipfile.ZipFile(root / "private-key.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for name in [info["storeFile"], "signing.json", "KEYSTORE-README.txt"]:
        archive.write(root / name, name)
subprocess.run(
    ["openssl", "cms", "-encrypt", "-aes256", "-binary", "-outform", "DER", "-in", str(root / "private-key.zip"), "-out", str(public / "DraBornSeries-private-signing.p7m"), "docs/release-backup-recipient.pem"], check=True,
)
(public / "release-certificate.json").write_text(json.dumps({"alias": info["alias"], "sha256": fingerprint, "algorithm": "RSA", "keySize": 4096, "createdForVersion": "0.7.3"}, indent=2))
with open(os.environ["GITHUB_ENV"], "a") as env:
    env.write(f"DBS_RELEASE_STORE_FILE={root.resolve() / info['storeFile']}\nDBS_RELEASE_STORE_PASSWORD={info['storePassword']}\nDBS_RELEASE_KEY_PASSWORD={info['keyPassword']}\nDBS_RELEASE_KEY_ALIAS={info['alias']}\n")
print("Sealed the backup to the owner's encryption recipient; certificate SHA256:", fingerprint)
