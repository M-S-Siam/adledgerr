from pathlib import Path
import re
import subprocess

p = Path('App.jsx')
s = p.read_text(encoding='utf-8')
s = s.replace('      <AccountSecuritySettings />\n', '', 1)
marker = 'function SettingsView({ settings, logo, onSave, onLogoUpload, onRemoveLogo, onExport, onImport, onReset }) {'
start = s.find(marker)
if start < 0: raise SystemExit('SettingsView not found')
root = '<div className=\\"max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500\\">'
pos = s.find(root, start)
if pos < 0: raise SystemExit('Settings root not found')
pos += len(root)
s = s[:pos] + '\n    <AccountSecuritySettings />' + s[pos:]
p.write_text(s, encoding='utf-8')

for path in ['.github/workflows/ui-settings-fix.yml', '.github/workflows/ui-settings-fix2.yml', 'scripts/update_settings.py', 'scripts/fix_settings_placement.py']:
    q = Path(path)
    if q.exists(): q.unlink()

subprocess.run(['git','config','user.name','github-actions[bot]'], check=True)
subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git','add','App.jsx','src/AuthGate.jsx','.github/workflows/deploy.yml'], check=True)
subprocess.run(['git','add','-u'], check=True)
subprocess.run(['git','diff','--cached','--check'], check=True)
subprocess.run(['git','commit','-m','Place account security inside Settings [skip ci]'], check=True)
subprocess.run(['git','push','origin','main'], check=True)
