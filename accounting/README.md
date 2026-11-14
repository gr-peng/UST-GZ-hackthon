

## 运行

需要 Python 3.11+：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python run.py
```

在运行程序的电脑打开 `http://127.0.0.1:8010`，接口文档为 `/docs`。远程访问可使用 SSH 端口转发，或按需指定 `--host` 和 `--port`。

账单查询和统计不加载模型。自然语言录入、记账对话需要本地 Qwen 模型；票据识别需要相应的视觉模型：

```bash
python -m pip install -r requirements-model.txt
python run.py --model-dir /path/to/local/model
```

新账本初始为空，数据保存到 `.runtime/bookkeeper/`。环境密钥、个人账本、模型权重与运行日志不包含在文件夹中。页面样式和字体使用外部 CDN。

## 文件

- `AI_accounting_agent/backend/`：记账 API 与提示词。
- `AI_accounting_agent/frontend/accounting/`：原版记账页面。
- `run.py`：同源网页与 API 启动入口。
- `SOURCE.json`：真实来源版本、整理内容和文件指纹。
