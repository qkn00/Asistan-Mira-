import urllib.request, re

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/automation/produce/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    resp = urllib.request.urlopen(req)
    content = resp.read().decode('utf-8', errors='ignore')
    idx = content.find("templateFailed")
    print(content[max(0, idx - 400) : min(len(content), idx + 800)])
except Exception as e:
    print('Error:', e)
