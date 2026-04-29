from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path

from excel_templates.config import SHEET_CONFIGS
from excel_templates.sanitizer import build_sanitized_workbook


DEFAULT_SOURCE = Path.home() / "Downloads" / "\u041f\u0438\u0442\u0430\u043d\u0438\u0435_2025.xlsm"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build cleaned PNG templates from the source Excel workbook."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(os.environ.get("EXCEL_TEMPLATE_SOURCE", DEFAULT_SOURCE)),
        help="Path to the source .xlsm workbook.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "docs" / "excel-templates",
        help="Directory for generated PNG files.",
    )
    return parser.parse_args()


def cleanup_previous_exports(output_dir: Path) -> None:
    for image_path in output_dir.glob("*.png"):
        image_path.unlink()


def write_manifest(output_dir: Path, manifest_path: Path) -> None:
    payload = [
        {
            "sheet_title": config.title,
            "visible_range": config.visible_range,
            "output_path": str((output_dir / config.output_name).resolve()),
        }
        for config in SHEET_CONFIGS
    ]
    manifest_path.write_text(
        json.dumps(payload, ensure_ascii=True, indent=2),
        encoding="utf-8",
    )


def run_exporter(workbook_path: Path, manifest_path: Path) -> None:
    exporter_path = Path(__file__).resolve().parent / "excel_templates" / "export_ranges.ps1"
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(exporter_path),
            "-WorkbookPath",
            str(workbook_path),
            "-ManifestPath",
            str(manifest_path),
        ],
        check=True,
    )


def main() -> int:
    args = parse_args()
    source_path = args.source.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not source_path.exists():
        raise FileNotFoundError(f"Workbook not found: {source_path}")

    cleanup_previous_exports(output_dir)

    with tempfile.TemporaryDirectory(prefix="excel-template-build-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        temp_workbook = temp_dir / "sanitized-template-source.xlsm"
        manifest_path = temp_dir / "export-manifest.json"

        build_sanitized_workbook(source_path, temp_workbook, SHEET_CONFIGS)
        write_manifest(output_dir, manifest_path)
        run_exporter(temp_workbook, manifest_path)

    for config in SHEET_CONFIGS:
        print(output_dir / config.output_name)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
