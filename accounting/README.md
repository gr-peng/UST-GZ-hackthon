# FinPilot

个人财务助手，包含记账、资产与持仓、预算、任务对话和投资研究。


## 运行

需要 Python 3.12+，主程序使用标准库，无需前端构建：

```bash
python -B server.py --port 65281
```

打开 `http://127.0.0.1:65281/?app=1#/today`。首次启动创建本地合成持仓，运行数据保存在 `.runtime/`。

启用模型连接：

```bash
python -B server.py --port 65281 --allow-api --agent-validation
```

在“我的 → 模型与连接”填写提供方、Key 和模型名。语音扩展按需使用 `voice_service.py` 和 `requirements-voice-demo.txt`。

## 目录

- `backend/`：对话、提供方与后端接口。
- `baseline_backend/`：持仓和行情模块。
- `web/`：App 源码与运行资源。
- `demo/positions.synthetic.json`：首次启动所需的合成持仓。
- `tests/`：源版本的自动化检查。
- `config/`：配置示例。


