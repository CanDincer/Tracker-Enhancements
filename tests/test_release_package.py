import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("package_release", Path(__file__).parents[1] / "scripts/package-release.py")
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class ReleasePackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.source = Path(self.temporary.name) / "source"
        self.output = Path(self.temporary.name) / "dist"
        self.source.mkdir()
        self.manifest = {"id": "tracker-enhancements", "version": "1.5.1",
                         "esmodules": ["module/main.js"], "styles": ["styles/dist/main.css"],
                         "languages": [{"path": "lang/en.json"}]}
        for name, content in {"module/main.js": "// runtime", "module/package.json": '{}',
                              "styles/dist/main.css": "/* runtime */", "lang/en.json": '{}',
                              "node_modules/dev/index.js": "excluded", "tests/dev.js": "excluded",
                              "styles/src/main.scss": "excluded"}.items():
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        self.write_metadata()

    def write_metadata(self):
        for name in ("module.json", "package.json", "package-lock.json"):
            data = self.manifest if name == "module.json" else {"version": self.manifest["version"]}
            (self.source / name).write_text(json.dumps(data))

    def package(self, tag="v1.5.1"):
        return packager.package_release(self.source, self.output, tag, "CanDincer/Tracker-Enhancements")

    def test_installable_zip_and_standalone_manifest_match(self):
        original = (self.source / "module.json").read_bytes()
        archive = self.package()
        with zipfile.ZipFile(archive) as zipped:
            self.assertEqual(set(zipped.namelist()), {"module.json", "module/main.js", "module/package.json",
                                                    "lang/en.json", "styles/dist/main.css"})
            self.assertEqual(zipped.read("module.json"), (self.output / "module.json").read_bytes())
            manifest = json.loads(zipped.read("module.json"))
            self.assertEqual(manifest["version"], "1.5.1")
            self.assertEqual(manifest["download"], "https://github.com/CanDincer/Tracker-Enhancements/releases/download/v1.5.1/tracker-enhancements.zip")
            self.assertEqual(manifest["manifest"], "https://github.com/CanDincer/Tracker-Enhancements/releases/latest/download/module.json")
        self.assertEqual((self.source / "module.json").read_bytes(), original)
        first_build = archive.read_bytes()
        self.package()
        self.assertEqual(archive.read_bytes(), first_build)

    def test_mismatched_metadata_prevents_publication(self):
        for name in ("module.json", "package.json", "package-lock.json"):
            with self.subTest(name=name):
                self.write_metadata()
                (self.source / name).write_text(json.dumps({**self.manifest, "version": "1.5.0"}))
                with self.assertRaisesRegex(ValueError, "does not match"):
                    self.package()
                self.assertFalse(self.output.exists())

    def test_missing_or_outside_runtime_assets_are_rejected(self):
        for path in ("module/missing.js", "../outside.js"):
            with self.subTest(path=path):
                self.manifest["esmodules"] = [path]
                self.write_metadata()
                with self.assertRaisesRegex(ValueError, "Missing packaged runtime asset"):
                    self.package()

    def test_tag_spelling_and_prerelease_versions_are_preserved(self):
        for tag, version in (("1.5.1", "1.5.1"), ("v1.5.2-rc.1", "1.5.2-rc.1")):
            with self.subTest(tag=tag):
                self.manifest["version"] = version
                self.write_metadata()
                self.package(tag)
                manifest = json.loads((self.output / "module.json").read_text())
                self.assertEqual(manifest["version"], version)
                self.assertIn(f"/download/{tag}/", manifest["download"])
        for tag in ("main", "v1.5", "../../v1.5.1"):
            with self.subTest(tag=tag), self.assertRaisesRegex(ValueError, "release tag"):
                self.package(tag)
