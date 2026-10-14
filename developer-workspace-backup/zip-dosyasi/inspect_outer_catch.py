import urllib.request

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/automation/produce/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

idx = content.rfind("catch (error)")
if idx == -1:
    idx = content.rfind("catch (err)")
if idx == -1:
    idx = content.rfind("catch")
print(content[idx : idx + 800])
