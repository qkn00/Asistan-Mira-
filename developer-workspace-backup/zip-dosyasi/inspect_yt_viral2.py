import urllib.request, re

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/chat/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

matches = [m.start() for m in re.finditer(r'/yt-viral', content)]
for idx in matches[1:]:
    print(content[idx-50 : idx+500])
    print('---')
