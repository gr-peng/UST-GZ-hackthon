# 运行指南

需要 Python 3.12+，从当前目录启动：

```bash
python -B server.py --port 65281
```

访问 `http://127.0.0.1:65281/?app=1#/today`。端口被占用时，更换 `--port` 并同步修改浏览器地址。

首次启动使用 `demo/positions.synthetic.json` 初始化持仓；重复启动保留已有数据库。该文件是运行依赖，独立演示站和展示素材未包含。

在线对话：

```bash
python -B server.py --port 65281 --allow-api --agent-validation
```

在“我的 → 模型与连接”填写配置。配置示例见 `config/API-CONFIG.example.json`。未连接模型时，不提供在线模型回答。

研究页的 PDF 附件使用原公开来源链接，不在本目录存放副本。

Node.js 22.12+ 用于前端检查，Python 用于后端检查。源版本的完整测试包含已排除的独立演示站验证；按需要运行对应模块测试。
