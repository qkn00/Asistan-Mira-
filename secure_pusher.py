import http.server, socketserver, urllib.parse, subprocess, os, sys

PORT = 3000

HTML_FORM = """<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Güvenli GitHub Push Portu (Düzeltme Commit)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px; max-width: 480px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
  h2 { margin-top: 0; color: #38bdf8; font-size: 1.3rem; display: flex; align-items: center; gap: 8px; }
  p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; }
  .badge { background: #0369a1; color: #e0f2fe; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 0.85rem; }
  label { display: block; font-weight: 600; font-size: 0.85rem; margin-top: 18px; margin-bottom: 6px; color: #cbd5e1; }
  input[type="password"] { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 1rem; box-sizing: border-box; outline: none; }
  input[type="password"]:focus { border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
  button { width: 100%; margin-top: 20px; padding: 12px; border: none; border-radius: 8px; background: #22c55e; color: #052e16; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background 0.2s; }
  button:hover { background: #16a34a; }
  .result { margin-top: 18px; padding: 12px; border-radius: 8px; font-size: 0.9rem; line-height: 1.4; display: none; }
  .success { background: #064e3b; border: 1px solid #059669; color: #a7f3d0; display: block; }
  .error { background: #7f1d1d; border: 1px solid #dc2626; color: #fecaca; display: block; }
</style>
</head>
<body>
<div class="card">
  <h2>🔒 Güvenli GitHub Push Portu</h2>
  <p>Commit: <span class="badge">c52cb4b</span> (manualGrace ve libz.so.1 düzeltmesi)<br>Hedef: <span class="badge">qkn00/Asistan-Mira- (main)</span></p>
  <p style="font-size: 0.8rem; color: #64748b;">Bu form doğrudan bellekten çalışır. Token hiçbir zaman sohbete veya loglara yazılmaz.</p>
  
  <form method="POST" action="/push">
    <label for="token">GitHub Personal Access Token (PAT):</label>
    <input type="password" id="token" name="token" placeholder="ghp_... veya github_pat_..." required autocomplete="off">
    <button type="submit" id="btn">🚀 Commit c52cb4b'yi Main'e Gönder</button>
  </form>
  __RESULT_PLACEHOLDER__
</div>
</body>
</html>
"""

class SecurePushHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        html = HTML_FORM.replace("__RESULT_PLACEHOLDER__", "")
        self.wfile.write(html.encode("utf-8"))

    def do_POST(self):
        if self.path != "/push":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8")
        params = urllib.parse.parse_qs(post_data)
        token_list = params.get("token", [""])
        token = token_list[0].strip()

        res_box = ""
        if not token:
            res_box = '<div class="result error">❌ Token boş bırakılamaz.</div>'
        else:
            repo_dir = "/home/user/Asistan-Mira"
            remote_url = f"https://{token}@github.com/qkn00/Asistan-Mira-.git"
            try:
                proc = subprocess.run(
                    ["git", "push", remote_url, "HEAD:main"],
                    cwd=repo_dir,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                if proc.returncode == 0:
                    res_box = '<div class="result success">✅ <b>Harika! Düzeltme commit c52cb4b başarıyla GitHub main dalına gönderildi!</b><br>Railway derlemesi başladı. Şimdi bu kartı kapatıp sohbete dönebilirsin.</div>'
                else:
                    err = proc.stderr.replace(token, "***")
                    res_box = f'<div class="result error">❌ Git push başarısız:<br><pre style="white-space: pre-wrap; font-size: 0.8rem;">{err}</pre></div>'
            except Exception as e:
                err = str(e).replace(token, "***")
                res_box = f'<div class="result error">❌ Hata oluştu: {err}</div>'
            finally:
                token = None
                del token_list

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        html = HTML_FORM.replace("__RESULT_PLACEHOLDER__", res_box)
        self.wfile.write(html.encode("utf-8"))

    def log_message(self, format, *args):
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format%args))

if __name__ == "__main__":
    with socketserver.TCPServer(("0.0.0.0", PORT), SecurePushHandler) as httpd:
        httpd.serve_forever()
