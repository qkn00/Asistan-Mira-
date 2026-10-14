import urllib.request

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/automation/produce/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

idx = content.find("Belirtilen video şablonu çalıştırılamadı")
print(content[max(0, idx - 600) : min(len(content), idx + 800)])
