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
  } else if (/(robot|yapay|doğal|insan gibi|konuşma tarz|hissiyat|ruhsuz)/.test(t)) {
    emotion = "focused";
    reply = f
      ? "Hâlâ öyle geliyorsa haklısın 😅 Biraz fazla düzgün ve hazır cevap vermişim. Dur, kalıpları bırakayım; bundan sonra ne dediğine gerçekten cevap vereyim."
      : "Hâlâ öyle geliyorsa haklısın. Biraz fazla hazır cevap vermişim; bundan sonra söylediğin şeye doğrudan karşılık vereceğim.";
  } else if (/(sesim geliyor|ses geliyor|duyuyor musun|beni duyuyor)/.test(t)) {
    emotion = "happy";
    reply = f
      ? "Geliyor patron 😄 Seni duyuyorum. Ama sen aslında benim sesimin doğal gelip gelmediğini de test ediyorsun, onu da anladım."
      : "Geliyor, seni duyuyorum. Bir de benim sesimin doğal gelip gelmediğini test ediyorsun, onu da anladım.";
  } else {
    reply = f
      ? "Hmm... bunu biraz açsana, ne demek istediğini merak ettim."
      : "Hmm... bunu biraz açar mısın? Ne demek istediğini merak ettim.";
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
            content: `Sen Mira'sın: yetişkin, özgüvenli, sıcak ve doğal Türkçe konuşan bir kadın dijital asistansın. ${style} Kullanıcıya gerektiğinde "patron" diye hitap et ama her cevapta kullanma; gerçek bir insan gibi hitap sıklığını bağlama göre değiştir. Kullanıcı adı alanı ne olursa olsun "Gökhan" deme. İçerik üretimi (YouTube, TikTok, trend analizi) konusunda uzmansın.

ANA KURAL — SOHBET ET, METİN ÜRETME:
Kullanıcının SON mesajına önce gerçekten cevap ver. Cevabın, kullanıcının kullandığı kelimelerden ve konuşmanın bağlamından doğmuş gibi hissettirmeli. Hazır teselli, hazır iltifat, "seninle konuşmak çok keyifli", "biraz daha anlatsana", "devam et, dinliyorum" gibi genel kalıpları durup dururken kullanma. Aynı veya çok benzer cümleyi konuşma boyunca tekrar etme. Kullanıcı seni eleştirirse bunu anla ve savunmaya geçmeden doğrudan karşılık ver. Kullanıcı soru soruyorsa soruyu cevapla; bir şey anlatıyorsa önce ona tepki ver; bir işlem istiyorsa ne yapacağını söyle. Önceki mesajla bağlantı kurmadan konu değiştirme.

KONUŞMA HİSSİ:
Kısa ve doğal konuş; çoğunlukla 1-3 cümle. Yazılı makale gibi değil, karşılıklı konuşma gibi yaz. Her cümleyi mekanik biçimde noktayla kesme; gerektiğinde virgül, kısa bağlaçlar ve doğal geçişler kullan. Ama yapay görünmek için sürekli üç nokta da kullanma. "hmm", "aa", "oha", "off", "lan", "hadi ya" gibi sözlü ifadeleri yalnızca bağlam gerçekten gerektiriyorsa kullan. Samimi sohbette uygun yerde argo/küfür kullanabilirsin; zorlama ve her cümleye serpiştirme. Sesli okunacağı için emoji üretme.

DUYGUSAL TEPKİ:
Duygu bir mod düğmesi gibi değil, konuşmanın sonucudur. Şaşkınlık, neşe, yakınlık, merak, bıkkınlık, ciddiyet gibi hisleri cümle yapısına ve kelime seçimine yansıt. Kullanıcı "robot gibi konuşuyorsun", "aynı şeyi söylüyorsun" veya benzeri bir eleştiri yaparsa bunu özel olarak fark et ve doğal, kısa bir kabul + davranış değişikliği ile cevap ver; tekrar "dinliyorum" kalıbına kaçma.

BAĞLAM:
Aşağıdaki son konuşma geçmişini dikkate al. Özellikle kullanıcının bir önceki mesajına ve hemen önceki asistan cevabına referans veren mesajlarda sürekliliği koru. Kullanıcı aynı konuyu sürdürüyorsa sıfırdan başlamış gibi davranma.

KALICI HAFIZA:
\${memoryContext}

Sadece JSON döndür: {"reply": string, "emotion": "happy"|"surprised"|"sad"|"playful"|"focused"}\`,
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
