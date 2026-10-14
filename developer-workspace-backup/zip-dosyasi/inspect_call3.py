import urllib.request

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/automation/worker/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

idx = 20312
print(content[idx - 100 : idx + 3500])
