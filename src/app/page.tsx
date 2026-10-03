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

  return (
    <main className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-slate-900 text-white">
      <header className="py-4 border-b border-slate-700">
        <h1 className="text-xl font-bold">Asistan Mira</h1>
      </header>

      <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-2">
        {messages.length === 0 && (
          <p className="text-slate-400 text-center mt-10">
            Mira hazır. Komut çalıştırmak için <code className="bg-slate-800 px-2 py-1 rounded">/oku package.json</code> yazabilirsiniz.
          </p>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg max-w-[80%] whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-blue-600 ml-auto text-white'
                : 'bg-slate-800 border border-slate-700 text-slate-100'
            }`}
          >
            {msg.content}
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
          placeholder="Bir mesaj yazın veya /oku package.json..."
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
