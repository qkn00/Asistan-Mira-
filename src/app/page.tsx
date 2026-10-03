'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'Yanıt alınamadı.';
      
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
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

  return (
    <main className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-slate-900 text-white">
      <header className="py-4 border-b border-slate-700 flex justify-between items-center">
        <h1 className="text-xl font-bold">Asistan Mira</h1>
        <span className="text-xs bg-blue-600/30 text-blue-400 border border-blue-500/30 px-2 py-1 rounded">
          v1.2 - Copy Ready
        </span>
      </header>

      <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-2">
        {messages.length === 0 && (
          <p className="text-slate-400 text-center mt-10">
            Mira hazır. Komut çalıştırmak için <code className="bg-slate-800 px-2 py-1 rounded">/yt-viral AI tools</code> yazabilirsiniz.
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

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-700 pt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Bir mesaj yazın veya /yt-viral AI tools..."
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
    </main>
  );
}
