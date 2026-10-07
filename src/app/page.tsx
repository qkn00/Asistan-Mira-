'use client';

import { useState, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const COMMANDS = [
  { command: '/yardım', description: 'Mira komutlarını gösterir' },
  { command: '/durum', description: 'Mira ve veritabanı durumunu kontrol eder' },
  { command: '/n8n', description: 'n8n bağlantı durumunu kontrol eder' },
  { command: '/n8n-ajan ', description: 'n8n için yeni ajan oluşturma isteği başlatır' },
  { command: '/yt-viral ', description: 'YouTube Shorts otomasyonunu başlatır' },
  { command: '/oku ', description: 'GitHub reposundan dosya içeriğini okur' },
];

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const speakText = async (text: string) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Emel TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (error) {
      console.error('Mira TTS failed:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    if (value.startsWith('/')) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectCommand = (cmd: string) => {
    setInput(cmd);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setShowSuggestions(false);
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      // Do not blindly call res.json(): deployment/proxy errors can return
      // plain text or HTML and cause "Unexpected token ... is not valid JSON".
      const raw = await res.text();
      let data: unknown = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        const preview = raw.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 500);
        throw new Error(
          preview
            ? `Sunucu JSON yerine metin döndürdü (HTTP ${res.status}): ${preview}`
            : `Sunucu geçerli JSON döndürmedi (HTTP ${res.status}).`,
        );
      }

      if (!res.ok) {
        const error =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `HTTP ${res.status}`;
        throw new Error(error);
      }

      const reply =
        data && typeof data === 'object' && 'reply' in data && typeof data.reply === 'string'
          ? data.reply
          : data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Yanıt alınamadı.';

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      speakText(reply);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Hata oluştu: ${err.message || 'Bağlantı hatası'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    const cleanText = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
    navigator.clipboard.writeText(cleanText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderMessageContent = (msg: Message, index: number) => {
    const isCodeBlock = msg.content.startsWith('```');

    if (isCodeBlock) {
      const cleanCode = msg.content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');

      return (
        <div className="relative my-2 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden text-left font-mono text-sm">
          <div className="flex justify-between items-center px-4 py-1.5 bg-slate-800 text-slate-400 text-xs border-b border-slate-700">
            <span>Kod Çıktısı</span>
            <button
              onClick={() => copyToClipboard(msg.content, index)}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-sans transition-colors"
            >
              {copiedIndex === index ? '✓ Kopyalandı' : '📋 Kopyala'}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto text-slate-100 font-mono text-xs leading-relaxed">
            <code>{cleanCode}</code>
          </pre>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="whitespace-pre-wrap text-slate-100">{msg.content}</div>
        {msg.role === 'assistant' && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => copyToClipboard(msg.content, index)}
              className="px-2 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors flex items-center gap-1"
            >
              {copiedIndex === index ? '✓ Kopyalandı' : '📋 Metni Kopyala'}
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!entered) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center overflow-hidden">
        <section className="relative w-full min-h-screen flex flex-col items-center justify-center px-6">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/20 animate-ping" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-7 flex h-28 w-28 items-center justify-center rounded-full border border-blue-400/30 bg-slate-900/80 shadow-2xl shadow-blue-950/40">
              <div className="h-16 w-16 rounded-full bg-blue-500/20 border border-blue-300/30 animate-pulse" />
            </div>
            <p className="mb-2 text-xs uppercase tracking-[0.45em] text-blue-300/70">MIRA</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Hazırım.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
              Görevlerine ve otomasyonlarına odaklanan tek çalışma alanı.
            </p>
            <button
              type="button"
              onClick={() => setEntered(true)}
              className="mt-9 rounded-full border border-blue-400/30 bg-blue-500/10 px-8 py-3 text-sm font-medium text-blue-100 transition-all duration-300 hover:scale-105 hover:bg-blue-500/20"
            >
              Mira'ya gir
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-slate-900 text-white relative">
      <header className="py-4 border-b border-slate-700 flex justify-between items-center">
        <h1 className="text-xl font-bold">Asistan Mira</h1>
        <span className="text-xs bg-blue-600/30 text-blue-400 border border-blue-500/30 px-2 py-1 rounded">
          Görev Merkezi
        </span>
      </header>

      <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-2">
        {messages.length === 0 && (
          <p className="text-slate-400 text-center mt-10">
            Mira hazır. Komut listesini görmek için <code className="bg-slate-800 px-2 py-1 rounded">/</code> tuşuna basabilirsin.
          </p>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg max-w-[90%] ${
              msg.role === 'user'
                ? 'bg-blue-600 ml-auto text-white'
                : 'bg-slate-800 border border-slate-700 text-slate-100'
            }`}
          >
            {renderMessageContent(msg, index)}
          </div>
        ))}
        {loading && (
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-slate-400 max-w-[80%] animate-pulse">
            Mira yanıt yazıyor...
          </div>
        )}
      </div>

      <div className="relative">
        {showSuggestions && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
            <div className="px-3 py-1.5 text-xs text-slate-400 bg-slate-850 border-b border-slate-700 font-semibold">
              Önerilen Komutlar
            </div>
            {COMMANDS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectCommand(item.command)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-700 flex justify-between items-center transition-colors border-b border-slate-700/50 last:border-none"
              >
                <code className="text-blue-400 font-bold">{item.command}</code>
                <span className="text-xs text-slate-400">{item.description}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-700 pt-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Görev veya komut girin..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded-lg disabled:opacity-50"
          >
            Gönder
          </button>
        </form>
      </div>
    </main>
  );
}
