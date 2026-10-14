import urllib.request, json

url = 'https://api.github.com/repos/qkn00/Asistan-Mira-/git/trees/main?recursive=1'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
tree = json.loads(resp.read().decode())['tree']

ts_files = [item['path'] for item in tree if item['path'].endswith('.ts') and not item['path'].endswith('.d.ts')]

for path in ts_files:
    raw_url = f"https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/{path}"
    try:
        content = urllib.request.urlopen(urllib.request.Request(raw_url, headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8', errors='ignore')
        if 'TASARIM' in content:
            print("FOUND IN:", path)
            for line in content.splitlines():
                if 'TASARIM' in line:
                    print("  ", line.strip()[:120])
    except Exception as e:
        pass
