"""Serve the extracted bookkeeping pages and API from one origin."""

import argparse
import importlib.util
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent


def create_app(*, data_dir=None, model_dir=None):
    from fastapi.responses import RedirectResponse
    from fastapi.staticfiles import StaticFiles

    if data_dir is not None:
        os.environ["AI_BOOKKEEPER_DATA_DIR"] = str(Path(data_dir).resolve())
    else:
        os.environ.setdefault(
            "AI_BOOKKEEPER_DATA_DIR", str(ROOT / ".runtime" / "bookkeeper")
        )
    if model_dir is not None:
        os.environ["QWEN_MODEL_DIR"] = str(Path(model_dir).resolve())

    backend = ROOT / "AI_accounting_agent" / "backend"
    sys.path.insert(0, str(backend))
    spec = importlib.util.spec_from_file_location("accounting_backend", backend / "app.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    application = module.app

    @application.get("/", include_in_schema=False)
    def home():
        return RedirectResponse("/accounting/welcome/code.html")

    application.mount(
        "/accounting",
        StaticFiles(directory=ROOT / "AI_accounting_agent" / "frontend" / "accounting"),
        name="accounting",
    )
    return application


def main():
    parser = argparse.ArgumentParser(description="AI 记账助手")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    parser.add_argument("--data-dir", help="独立账本目录")
    parser.add_argument("--model-dir", help="本地模型目录，也可设置 QWEN_MODEL_DIR")
    args = parser.parse_args()
    import uvicorn

    uvicorn.run(
        create_app(data_dir=args.data_dir, model_dir=args.model_dir),
        host=args.host,
        port=args.port,
    )


if __name__ == "__main__":
    main()
