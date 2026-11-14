"""Serve the original accounting and investment modules from one origin."""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent
SCENARIO_DATE = "2026-11-15"


def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def create_app(*, data_dir=None, model_dir=None, demo=False):
    from fastapi.responses import HTMLResponse, Response
    from fastapi.staticfiles import StaticFiles

    ledger_dir = Path(data_dir).resolve() if data_dir else ROOT / ".runtime" / (
        "demo-bookkeeper-20261115" if demo else "bookkeeper"
    )
    ledger_dir.mkdir(parents=True, exist_ok=True)
    os.environ["AI_BOOKKEEPER_DATA_DIR"] = str(ledger_dir)
    os.environ.pop("AI_BOOKKEEPER_JSONL_PATH", None)
    if demo:
        fixture = ledger_dir / "synthetic_bank_bills.jsonl"
        if not fixture.exists():
            shutil.copyfile(ROOT / "demo-data" / fixture.name, fixture)
        os.environ["AI_BOOKKEEPER_JSONL_PATH"] = str(fixture)
    if model_dir is not None:
        os.environ["QWEN_MODEL_DIR"] = str(Path(model_dir).resolve())

    backend = ROOT / "AI_accounting_agent" / "backend"
    sys.path.insert(0, str(backend))
    accounting = _load_module("accounting_backend", backend / "app.py")
    if demo:
        accounting._import_jsonl_if_needed()
    os.environ["AI_TRADER_DATA_DIR"] = str(
        ROOT / ("demo-data" if demo else "historical-data")
    )
    investment = _load_module("investment_backend", backend / "investment_app.py")
    application = accounting.app
    context = {
        "mode": "demo" if demo else "historical",
        "data_kind": "synthetic_demo" if demo else "historical_archive",
        "scenario_date": SCENARIO_DATE if demo else None,
    }

    @application.get("/app-config", include_in_schema=False)
    def app_config():
        return context

    @application.get("/app-context.js", include_in_schema=False)
    def app_context():
        label = f"演示数据 · {SCENARIO_DATE}" if demo else "历史行情"
        script = """document.addEventListener('DOMContentLoaded', () => {
const bar = document.createElement('nav');
bar.style.cssText = 'height:36px;display:flex;align-items:center;justify-content:center;gap:18px;background:#f1f5f9;color:#334155;font:13px sans-serif;position:relative;z-index:1000;flex-shrink:0';
for (const [title, href] of [['记账', '/accounting/welcome/code.html'], ['投资', '/investment/welcome/code.html']]) {
  const a = document.createElement('a'); a.textContent = title; a.href = href; bar.appendChild(a);
}
const caption = document.createElement('span'); caption.textContent = LABEL; bar.appendChild(caption);
document.body.prepend(bar);
});""".replace("LABEL", json.dumps(label, ensure_ascii=False))
        return Response(script, media_type="application/javascript")

    @application.get("/", include_in_schema=False)
    def home():
        label = f"演示数据 · {SCENARIO_DATE}" if demo else "原始历史数据"
        return HTMLResponse(
            '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>AI 记账与投资助手</title><body style="font-family:sans-serif;'
            'max-width:480px;margin:12vh auto;padding:24px;background:#f8fafc">'
            '<h1>AI 记账与投资助手</h1><p>' + label + '</p>'
            '<p><a href="/accounting/welcome/code.html">打开记账</a></p>'
            '<p><a href="/investment/welcome/code.html">打开投资</a></p></body></html>'
        )

    if demo:
        def demo_chart():
            svg = (
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">'
                '<rect width="640" height="240" fill="#f8fafc"/>'
                '<path d="M55 35V185H605" fill="none" stroke="#94a3b8"/>'
                '<circle cx="330" cy="100" r="7" fill="#6366f1"/>'
                '<text x="330" y="70" text-anchor="middle" font-size="20">1.00</text>'
                '<text x="330" y="215" text-anchor="middle" font-size="16">2026-11-15</text>'
                '<text x="65" y="28" font-size="16">演示净值</text></svg>'
            )
            return Response(svg, media_type="image/svg+xml")
        for filename in ["FinAgent_vs_SSE100_Month_11.png", "FinAgent_vs_SSE100_Quarter.png", "FinAgent_vs_SSE100_Year.png"]:
            application.add_api_route(
                "/investment/visual/" + filename, demo_chart,
                methods=["GET"], include_in_schema=False,
            )

    application.mount("/invest-api", investment.app, name="investment-api")
    frontend = ROOT / "AI_accounting_agent" / "frontend"
    application.mount("/accounting", StaticFiles(directory=frontend / "accounting"), name="accounting")
    application.mount("/investment", StaticFiles(directory=frontend / "investment"), name="investment")
    return application


def main():
    parser = argparse.ArgumentParser(description="AI 记账与投资助手")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    parser.add_argument("--data-dir", help="独立记账数据库目录")
    parser.add_argument("--model-dir", help="本地模型目录，也可设置 QWEN_MODEL_DIR")
    parser.add_argument("--demo", action="store_true", help="使用 2026-11-15 的合成演示数据")
    args = parser.parse_args()
    import uvicorn
    uvicorn.run(
        create_app(data_dir=args.data_dir, model_dir=args.model_dir, demo=args.demo),
        host=args.host, port=args.port,
    )


if __name__ == "__main__":
    main()
