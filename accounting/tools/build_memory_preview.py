"""Build a dependency-free, double-clickable preview from the shared memory modules."""
import argparse
import base64
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def build(output):
    # These modules have no runtime dependencies beyond one another.
    modules = ['demo-calendar.mjs', 'financial-context.mjs', 'long-term-memory.mjs', 'memory-ui.mjs', 'memory-preview.mjs']
    parts = []
    for name in modules:
        source = (ROOT / 'web' / name).read_text(encoding='utf-8')
        source = re.sub(r'^import .*?;\s*$', '', source, flags=re.M)
        source = re.sub(r'^export (?=(?:const|function) )', '', source, flags=re.M)
        parts.append(source)
    script = "'use strict';\n(() => {\n" + '\n'.join(parts) + '\n})();'
    styles = '\n'.join((ROOT / 'web' / name).read_text(encoding='utf-8')
                       for name in ['long-term-memory.css', 'memory-preview.css'])
    image = 'data:image/png;base64,' + base64.b64encode((ROOT / 'web/assets/dot.png').read_bytes()).decode()
    html = (ROOT / 'tools/memory-preview.template.html').read_text(encoding='utf-8')
    html = html.replace('/* MEMORY_STYLES */', styles).replace('/* MEMORY_SCRIPT */', script)
    html = html.replace('web/assets/dot.png', image)
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding='utf-8')
    print(f'Memory preview: {output}')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default=str(ROOT / 'finpilot-intent-demo.html'))
    build(parser.parse_args().output)
