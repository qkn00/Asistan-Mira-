import urllib.request

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/automation/worker/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

# print where BILGI_DOZU_TEMPLATE_SPEC is loaded or read
idx = content.find("BILGI_DOZU_TEMPLATE_SPEC")
print("BILGI_DOZU_TEMPLATE_SPEC found at:", idx)
if idx != -1:
    print(content[max(0, idx - 200) : idx + 800])
else:
    # search where prompt is built
    idx2 = content.find("system:")
    print("system prompt found at:", idx2)
    print(content[idx2 : idx2 + 1000])
