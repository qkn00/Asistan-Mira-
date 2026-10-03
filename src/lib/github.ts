export async function getFileContent(filePath: string): Promise<string> {
  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'qkn00/Asistan-Mira-';

  if (!token) {
    throw new Error('GITHUB_PAT veya GITHUB_TOKEN ortam değişkeni tanımlanmamış.');
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3.raw',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`GitHub API Hatası: ${res.statusText}`);
  }

  return await res.text();
}

export async function createPR(filename: string, content: string, title: string): Promise<string> {
  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'qkn00/Asistan-Mira-';

  if (!token) {
    throw new Error('GITHUB_PAT veya GITHUB_TOKEN ortam değişkeni tanımlanmamış.');
  }

  const baseBranch = 'main';
  const newBranch = `feature/${Date.now()}`;

  // 1. main branch sha al
  const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${baseBranch}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const refData = await refRes.json();
  const mainSha = refData.object.sha;

  // 2. Yeni branch oluştur
  await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: `refs/heads/${newBranch}`,
      sha: mainSha,
    }),
  });

  // 3. Dosyayı oluştur/güncelle
  await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `feat: ${title}`,
      content: Buffer.from(content).toString('base64'),
      branch: newBranch,
    }),
  });

  // 4. PR oluştur
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      head: newBranch,
      base: baseBranch,
      body: 'Mira Otonom Asistan tarafından otomatik oluşturuldu.',
    }),
  });

  const prData = await prRes.json();
  return prData.html_url || `PR oluşturuldu: ${newBranch}`;
}
