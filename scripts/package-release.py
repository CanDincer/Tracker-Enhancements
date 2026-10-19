"""Package Foundry runtime files and a matching, versioned release manifest."""

import argparse
import json
from pathlib import Path
import re
import zipfile


def package_release(source, output, tag, repository):
    match = re.fullmatch(r"v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)", tag)
    if not match:
        raise ValueError("Use a release tag such as v1.5.1, matching the module version")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Repository must be owner/name")
    version = match[1]
    source, output = Path(source), Path(output)
    manifest = json.loads((source / "module.json").read_text(encoding="utf-8"))
    for name in ("module.json", "package.json", "package-lock.json"):
        metadata = json.loads((source / name).read_text(encoding="utf-8"))
        if metadata.get("version") != version:
            raise ValueError(f"{name} version {metadata.get('version')!r} does not match release {tag!r}")
    if manifest.get("id") != "tracker-enhancements":
        raise ValueError("Unexpected Foundry package ID")

    files = {}
    for directory in ("module", "lang", "styles/dist"):
        for path in sorted((source / directory).rglob("*")):
            if path.is_symlink():
                raise ValueError(f"Runtime symlinks are not supported: {path}")
            if path.is_file():
                files[path.relative_to(source).as_posix()] = path.read_bytes()
    required = manifest.get("esmodules", []) + manifest.get("styles", [])
    required += [language["path"] for language in manifest.get("languages", [])]
    for name in required:
        if name not in files:
            raise ValueError(f"Missing packaged runtime asset: {name}")

    base = f"https://github.com/{repository}/releases"
    manifest["manifest"] = f"{base}/latest/download/module.json"
    manifest["download"] = f"{base}/download/{tag}/tracker-enhancements.zip"
    content = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    files["module.json"] = content
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "tracker-enhancements.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            zipped.writestr(info, data, compresslevel=9)
    with zipfile.ZipFile(archive) as zipped:
        if zipped.testzip() is not None or zipped.read("module.json") != content:
            raise ValueError("Release archive verification failed")
    (output / "module.json").write_bytes(content)
    return archive


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--source", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("dist"))
    args = parser.parse_args()
    try:
        archive = package_release(args.source, args.output, args.tag, args.repository)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f"Release packaging failed: {error}\n")
    print(f"Created {archive} and {archive.parent / 'module.json'}")
