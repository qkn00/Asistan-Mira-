import urllib.request

url = 'https://raw.githubusercontent.com/qkn00/Asistan-Mira-/main/src/app/api/automation/produce/route.ts'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)
content = resp.read().decode('utf-8', errors='ignore')

idx = content.find("MotorQCFailError")
idx2 = content.find("} else", idx)
if idx2 != -1:
    print(content[idx2 : idx2 + 1000])
else:
    # search after sendTelegramMessage
    idx3 = content.find("return NextResponse.json", idx)
    print(content[idx3 : idx3 + 1200])
