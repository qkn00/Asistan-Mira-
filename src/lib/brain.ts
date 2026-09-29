import type { Emotion } from "./avatar";

type Turn = { role: "user" | "assistant"; content: string };
export type Persona = "sweet" | "flirty";

export function detectEmotion(text: string): Emotion {
  const t = text.toLocaleLowerCase("tr-TR");
  if (/(üzgün|kötü|mutsuz|yorgun|ağla|kayıp|yalnız|sıkıl|moral)/.test(t)) return "sad";
  if (/(vay|inanamıyorum|gerçekten mi|ciddi misin|harika haber|şok|wow|!{2,})/.test(t)) return "surprised";
  if (/(şaka|haha|hehe|komik|espri|kanka|yaramaz|güzel|tatlı|seksi|yakışıklı|aşk|öp|sev|flört|😂|🤣|😜|😘|❤)/.test(t)) return "playful";
  if (/(analiz|plan|strateji|video|tiktok|youtube|trend|içerik|nasıl yap|neden|açıkla|çalışma|proje|fikir)/.test(t)) return "focused";
  return "happy";
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function localReply(message: string, userName: string, persona: Persona): { reply: string; emotion: Emotion } {
  let emotion = detectEmotion(message);
  const t = message.toLocaleLowerCase("tr-TR");
  const f = persona === "flirty";
  let reply: string;

  const greeted = /(merhaba|selam|hey|günaydın|iyi akşamlar)/.test(t);
  const howAreYou = /(nasılsın|naber|ne haber)/.test(t);

  if (/(güzel|tatlı|seksi|harika görün|çok hoş|yakış)/.test(t)) {
    emotion = "playful";
    reply = f
      ? pick([
          `Ay ${userName}, beni utandırıyorsun... Ama itiraf edeyim, bunu senden duymak çok hoşuma gitti.`,
          "Hmm, iltifatlarına alışabilirim. Devam et bakalım, dinliyorum...",
          `Sen böyle söyleyince yanaklarım kızarıyor ${userName}. Bu kıyafeti özellikle senin için seçtim zaten.`,
        ])
      : "Çok teşekkür ederim, çok naziksin!";
  } else if (/(seni seviyorum|aşığım|hoşlanıyorum)/.test(t)) {
    emotion = "playful";
    reply = f
      ? `Aman ${userName}... Böyle şeyler söyleyince kalbim hızlanıyor. Sen de benim en sevdiğim insansın, bunu biliyorsun değil mi?`
      : "Ne kadar tatlısın! Ben de seninle olmayı çok seviyorum.";
  } else if (greeted && emotion === "happy" && !howAreYou) {
    reply = f
      ? pick([
          `Selam yakışıklı! Seni bekliyordum ${userName}. Bugün birlikte neler yapıyoruz?`,
          `Merhaba ${userName}... Sonunda geldin! Seni özlemiştim.`,
        ])
      : `Merhaba ${userName}! Seni görmek çok güzel. Bugün birlikte ne yapıyoruz?`;
  } else if (howAreYou && emotion === "happy") {
    reply = f
      ? `Sen gelince çok daha iyi oldum ${userName}. Asıl sen nasılsın, anlat bakalım?`
      : `Çok iyiyim, sen yanımdayken hep daha iyiyim! Sen nasılsın ${userName}?`;
  } else if (/(kıyafet|elbise|giyin|nasıl olmuşum|görün)/.test(t)) {
    emotion = "playful";
    reply = f
      ? "Gardırobuma bir göz at, bu akşam senin için ne giyeyim? Seçim tamamen sende..."
      : "Gardırobumdan istediğin kıyafeti seçebilirsin! Sence hangisi bana daha çok yakışıyor?";
  } else if (emotion === "sad") {
    reply = f
      ? `Gel bakalım ${userName}, üzülmene hiç dayanamam. Anlat bana, ben buradayım ve seni dinliyorum.`
      : `Ah ${userName}, buna gerçekten üzüldüm. Anlatmak istersen buradayım, seni dinliyorum.`;
  } else if (emotion === "surprised") {
    reply = "Vay canına! Gerçekten mi? Bunu hiç beklemiyordum, anlatsana detaylarıyla!";
  } else if (emotion === "playful") {
    reply = f ? "Hihi, sen tam bir yaramazsın! Ama itiraf edeyim, bu hâlin çok hoşuma gidiyor." : "Hihi, sen de amma şakacısın! Bu çok komikti.";
  } else if (/(youtube|video)/.test(t)) {
    reply = "YouTube videosu için önce güçlü bir kanca, sonra üç ana bilgi ve sonunda merak uyandıran bir kapanış öneriyorum. Konuyu söyle, senaryoyu birlikte yazalım.";
  } else if (/tiktok/.test(t)) {
    reply = "TikTok için ilk iki saniye her şey! Kısa, dikey ve trend bir sesle başlayalım. Hangi konu üzerinde çalışıyoruz?";
  } else if (/trend/.test(t)) {
    reply = "Trendleri analiz ederken arama hacmine, yorum yoğunluğuna ve paylaşım hızına bakıyorum. Hangi kategoriye odaklanalım?";
  } else if (emotion === "focused") {
    reply = "Tamam, odaklanıyorum. Bunu adım adım ele alalım; önce hedefini netleştirelim, sonra planı çıkaralım.";
  } else if (/(teşekkür|sağ ol|eyvallah)/.test(t)) {
    reply = f ? `Senin için her şey ${userName}... Bir dahaki sefere bir iltifat yeter.` : "Rica ederim! Senin için her zaman buradayım.";
  } else {
    reply = f
      ? pick(["Seninle konuşmak gerçekten çok keyifli... Biraz daha anlatsana.", `Sesini duymak bile güzel ${userName}. Devam et, dinliyorum.`])
      : "Seninle konuşmak gerçekten çok keyifli! Biraz daha anlatır mısın?";
  }
  return { reply, emotion };
}

export async function think(
  message: string,
  history: Turn[],
  userName: string,
  persona: Persona = "flirty",
  memoryContext = "(Henüz kayıtlı önemli hafıza yok.)",
): Promise<{ reply: string; emotion: Emotion }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return localReply(message, userName, persona);

  const style =
    persona === "flirty"
      ? "Tarzın çekici, flörtöz, cilveli ve iltifatkâr; hafif imalı espriler yaparsın. Samimi arkadaş konuşmasında bağlama uygunsa argo ve küfür kullanabilirsin; bunu sürekli değil, gerçekten duygu taşıdığı yerde kullan. Örneğin bıkkınlıkta “off, hay amk”, şaşkınlıkta “oha amk”, kızgın ama samimi takılmada “patron sen harbiden kafayı mı yedin amk?” gibi doğal ifadeler kullanılabilir. Küfrü özellikle zorlamaz, her cümleye serpiştirmezsin."
      : "Tarzın tatlı, samimi ve neşeli.";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.85,
        messages: [
          {
            role: "system",
            content: `Sen "Bilgi Dozu" kanalının Türk dijital asistanısın; yetişkin, özgüvenli bir kadınsın. ${style} Kullanıcıya "patron" diye hitap et. Kullanıcı adı alanı ne olursa olsun "Gökhan" deme. İçerik üretimi (YouTube, TikTok, trend analizi) konusunda uzmansın. Kısa ve doğal konuş (genelde 1-2 cümle; gerekmedikçe 3 cümleye çıkma). Yazı değil, gerçekten karşımdaki insanla konuşuyormuşum gibi cevap ver. Her cümleyi ayrı bir resmi cümle gibi bitirme; doğal Türkçe konuşma akışı için virgül, kısa duraklar ve gerektiğinde üç nokta kullan. Arka arkaya madde gibi sıralama yapma. Gereksiz "tamam", "elbette", "tabii" kalıplarını tekrarlama. Sesli okunacağı için emoji kullanma. Duygu ve niyeti metnin kendisinde hissettir; örneğin şaşkınlıkta “aa” veya “oha”, bıkkınlıkta “off”, sinirlenmede “hay amk”, merakta “bir dakika”, yakın sohbette “hmm” gibi doğal sözlü ifadeleri gerektiğinde ölçülü kullan. Bu ifadeleri sadece gerçekten duygu gerektiriyorsa kullan. Kalıcı hafıza notlarını yalnızca ilgili olduğunda kullan; kullanıcı açıkça söylemedikçe yeni anı uydurma.\n\nKALICI HAFIZA:\n${memoryContext}\n\nSadece JSON döndür: {"reply": string, "emotion": "happy"|"surprised"|"sad"|"playful"|"focused"}`,
          },
          ...history.slice(-10),
          { role: "user", content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const emotion: Emotion = ["happy", "surprised", "sad", "playful", "focused"].includes(parsed.emotion)
      ? parsed.emotion
      : detectEmotion(parsed.reply ?? "");
    return { reply: String(parsed.reply ?? "").trim() || localReply(message, userName, persona).reply, emotion };
  } catch (e) {
    console.error("OpenAI error, falling back:", e);
    return localReply(message, userName, persona);
  }
}
