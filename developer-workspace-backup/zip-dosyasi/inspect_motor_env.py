import urllib.request

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/lib/motor-render.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

idx = content.find("run(py")
if idx == -1:
    idx = content.find("run(")
while idx != -1:
    print(content[idx : idx + 250])
    print('---')
    idx = content.find("run(", idx + 5)
