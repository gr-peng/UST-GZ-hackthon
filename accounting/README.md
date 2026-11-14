
## 运行

需要 Python 3.11+：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python run.py --demo
```

打开 `http://127.0.0.1:8010`，选择记账或投资。演示账单、股票、组合与资讯样例日期为 **2026-11-15**；原始行情保存在 `historical-data/`，不加 `--demo` 即可查看。记账数据分别保存到 `.runtime/` 下的独立目录。

自然语言入账、票据识别和研究报告需要配置本地模型：

```bash
python -m pip install -r requirements-model.txt
python run.py --demo --model-dir /path/to/local/model
```

票据识别需要视觉模型。页面样式、字体及部分脚本使用外部 CDN。

## 目录

- `AI_accounting_agent/backend/`：记账与投资服务。
- `AI_accounting_agent/frontend/`：原版记账、投资页面。
- `demo-data/`：2026-11-15 合成演示数据。
- `historical-data/`：原始历史行情、资讯及组合快照。
- `run.py`：统一启动入口。
