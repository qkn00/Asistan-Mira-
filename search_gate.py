import urllib.request, json

# search all files in src/lib and src/app
files = ['src/lib/source-search.ts', 'src/app/api/automation/produce/route.ts', 'src/app/api/content/review/route.ts', 'src/lib/script-parse.ts', 'src/lib/content-plan.ts']
for f in files:
    url = f"https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/{f}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        content = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
        if 'Kaynak güvenli' in content:
            print(f"Found in {f}!")
            idx = content.find('Kaynak güvenli')
            print(content[max(0, idx-100) : idx+400])
    except Exception as e:
        print(f, e)
