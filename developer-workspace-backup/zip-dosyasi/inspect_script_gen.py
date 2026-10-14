import urllib.request, re

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/automation/worker/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

matches = [m.start() for m in re.finditer(r'generateWithFallback', content)]
print("Total generateWithFallback calls:", len(matches))
for i, idx in enumerate(matches):
    print(f"--- CALL {i+1} at {idx} ---")
    print(content[idx : idx + 600])
