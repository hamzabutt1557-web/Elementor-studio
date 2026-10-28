#!/usr/bin/env python3
"""Build the pinned upstream browser API runtime. Never installs an unpinned 'latest'."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE_COMMIT = "90054a89c4ca8a96db6e3a26cd3af3a475eaa2d7"
FONTS_COMMIT = "37827adc41fd165f9a9234ac40f94dbad353aa69"
ROOT = Path(__file__).resolve().parents[1]


def run(*args, cwd=None, env=None):
    subprocess.run(args, cwd=cwd, env=env, check=True)


def checkout(url, commit, path):
    run("git", "init", str(path))
    run("git", "remote", "add", "origin", url, cwd=path)
    run("git", "fetch", "--depth", "1", "origin", commit, cwd=path)
    run("git", "checkout", "--detach", "FETCH_HEAD", cwd=path)
    actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=path, text=True).strip()
    if actual != commit:
        raise RuntimeError("Upstream commit verification failed")


def main():
    for tool in ("git", "cargo", "rustup", "trunk"):
        if not shutil.which(tool):
            raise SystemExit(f"Install {tool} first. See FIGCRAFT-INTEGRATION.md. Nothing was changed.")
    run("rustup", "target", "add", "wasm32-unknown-unknown")
    build_root = ROOT / ".figcraft-build"
    build_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="runtime-", dir=build_root) as tmp:
        tmp = Path(tmp)
        source, fonts = tmp / "source", tmp / "fonts"
        checkout("https://github.com/storytold/figcraft.git", SOURCE_COMMIT, source)
        checkout("https://github.com/storytold/craft-fonts.git", FONTS_COMMIT, fonts)
        env = dict(os.environ, CRAFT_FONTS_DIR=str(fonts), CRAFT_FONTS_REQUIRED="1")
        run("trunk", "build", "--release", "--locked", cwd=source / "apps/figcraft-web", env=env)
        dist = source / "dist/web"
        if not (dist / "index.html").is_file() or not list(dist.glob("*.wasm")):
            raise RuntimeError("Build did not produce a web runtime")
        stage = tmp / "integrated"
        shutil.copytree(dist, stage)
        # Preserve upstream and bundled-font attribution with the custom build.
        release = ROOT / "public/figcraft/figcraft-web-0.11.2"
        for item in release.iterdir() if release.is_dir() else []:
            if item.name.startswith(("LICENSE", "OFL-", "NOTICE")):
                shutil.copy2(item, stage / item.name)
        for item in source.iterdir():
            if item.is_file() and item.name.startswith(("LICENSE", "NOTICE")):
                shutil.copy2(item, stage / item.name)
        for item in fonts.rglob("*"):
            if item.is_file() and ".git" not in item.parts and item.name.upper().startswith(("OFL", "LICENSE", "NOTICE", "COPYING")):
                target = stage / "font-licenses" / item.relative_to(fonts)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, target)
        shutil.copy2(source / "packaging/web/README.md", stage / "HOSTING.md")
        hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in sorted(stage.iterdir()) if p.suffix in (".js", ".wasm")}
        (stage / "provenance.json").write_text(json.dumps({
            "browserControl": True, "status": "built-browser-acceptance-pending",
            "repository": "https://github.com/storytold/figcraft",
            "sourceCommit": SOURCE_COMMIT, "fontsCommit": FONTS_COMMIT,
            "build": "custom pinned-source build; not the official v0.11.2 binary",
            "sha256": hashes,
        }, indent=2) + "\n")
        destination = ROOT / "public/figcraft/integrated"
        previous = ROOT / "public/figcraft/integrated.previous"
        if previous.exists():
            raise RuntimeError("Move integrated.previous aside before replacing another runtime")
        if destination.exists():
            destination.rename(previous)
        try:
            shutil.move(str(stage), destination)
        except Exception:
            if previous.exists():
                previous.rename(destination)
            raise
        print("Pinned Figcraft runtime installed. Previous runtime retained in integrated.previous.")
        print("Run the real browser acceptance test before deploying or marking integration complete.")


if __name__ == "__main__":
    main()
