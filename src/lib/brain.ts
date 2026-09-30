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

function localReply(message: string, userName: string, persona: Persona, history: Turn[] = []): { reply: string; emotion: Emotion } {
  let emotion = detectEmotion(message);
  const t = message.toLocaleLowerCase("tr-TR");
  const f = persona === "flirty";
  let reply: string;

  const greeted = /(merhaba|selam|hey|günaydın|iyi akşamlar)/.test(t);
  const howAreYou = /(nasılsın|naber|ne haber)/.test(t);
  const teaching = /(bana öğret|bana anlat|öğretir misin|nasıl öğrenirim|nasıl yapılıyor|adım adım|beraber yapalım|gösterir misin|öğret)/.test(t);

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
  } else if (teaching) {
    emotion = "focused";
    reply = f
      ? "Olur patron. Sana sadece sonucu vermeyeyim; adım adım beraber yapalım. Önce ilk adımı göstereceğim, sen yaptığında sonraki adıma geçeriz."
      : "Olur. Sana sadece sonucu vermek yerine adım adım öğreteyim; önce ilk adımı yapalım, sonra devam ederiz.";
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
  } else if (/(sen kimsin|kimsin|sen nesin|ne iş yapıyorsun|görevin ne|görevini ne|amacın ne|ne yapıyorsun|kendini tanıt|adın ne)/.test(t)) {
    emotion = "focused";
    reply = f
      ? `Ben Mira'yım ${userName}. Bu sistemde seninle konuşan, işlerini ve otomasyonunu takip etmek için geliştirdiğimiz dijital asistanım. Şu an burada sohbet, öğretme ve yaptığımız işleri takip etme tarafında çalışıyorum.`
      : `Ben Mira'yım ${userName}. Seninle konuşan, sana öğretmek ve yaptığımız işleri takip etmek için geliştirdiğimiz dijital asistanım.`;
  } else if (/(otomasyon lazım|otomasyon istiyorum|otomasyon yap|otomasyon kur)/.test(t)) {
    emotion = "focused";
    reply = `Tamam ${userName}, otomasyon istiyorsun. Ne yapmak istediğini söyle; mevcut Mira sistemine göre nereden başlayacağımızı netleştirip ilerleyelim.`;
  } else if (/(sesim geliyor|ses geliyor|duyuyor musun|beni duyuyor)/.test(t)) {
    emotion = "happy";
    reply = f
      ? "Geliyor patron 😄 Seni duyuyorum. Ama sen aslında benim sesimin doğal gelip gelmediğini de test ediyorsun, onu da anladım."
      : "Geliyor, seni duyuyorum. Bir de benim sesimin doğal gelip gelmediğini test ediyorsun, onu da anladım.";
  } else {
    // Yerel motor da mümkün olduğunca konuşmanın son turuna tutunsun.
    // AI anahtarı yokken aynı "bir cümle daha söyle" kalıbına düşmemek için
    // kısa onaylar ve bağlama dönen sorular ayrı ele alınır.
    const lastUser = [...history].reverse().find((turn) => turn.role === "user")?.content?.trim() ?? "";
    const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant")?.content?.trim() ?? "";

    if (/^(tamam|peki|olur|aynen|evet|hı hı|hmm|hımm)$/i.test(t)) {
      emotion = "happy";
      if (lastAssistant) {
        reply = f
          ? "Tamam patron, oradan devam edelim. Ne kısmını yapmamı istiyorsun?"
          : "Tamam, oradan devam edelim. Hangi kısmı yapalım?";
      } else {
        reply = f ? "Tamam patron, buradayım. Nereden başlayalım?" : "Tamam, buradayım. Nereden başlayalım?";
      }
    } else if (/^(devam et|devam|sürdür|kaldığımız yerden devam et)$/i.test(t)) {
      emotion = "focused";
      reply = lastUser
        ? `Kaldığımız yerden devam edelim. Son konuştuğumuz konu “${lastUser.slice(0, 120)}” idi; hangi adımı şimdi ele alalım?`
        : "Devam edelim. Şu an hangi konuyu sürdürüyoruz?";
    } else if (/^(neden|niye|nasıl|nasıl yani|ne demek|hangisi|peki neden|peki nasıl)\??$/i.test(t) && lastAssistant) {
      emotion = "focused";
      reply = `Az önce söylediğim şeye göre cevaplayayım: “${lastAssistant.slice(0, 160)}” kısmını mı soruyorsun? Öyleyse onu netleştireyim.`;
    } else if (lastAssistant) {
      emotion = detectEmotion(lastAssistant);
      reply = f
        ? `Anladım patron. Bunu önceki söylediğim “${lastAssistant.slice(0, 120)}” kısmıyla bağlantılı olarak ele alıyorum; biraz daha netleştirirsen doğrudan oraya gireceğim.`
        : `Anladım. Bunu önceki söylediğim “${lastAssistant.slice(0, 120)}” kısmıyla bağlantılı olarak ele alıyorum; biraz daha netleştirirsen doğrudan oraya gireceğim.`;
    } else {
      emotion = "focused";
      reply = f ? "Tam olarak neyi kastettiğini yakalamaya çalışıyorum patron; bir sonraki cümlenle konuyu bağlayalım." : "Tam olarak neyi kastettiğini yakalamaya çalışıyorum; bir sonraki cümlenle konuyu bağlayalım.";
    }
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
  if (!key) return localReply(message, userName, persona, history);

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
            content: `Sen Mira'sın: yetişkin, özgüvenli, sıcak ve doğal Türkçe konuşan bir kadın dijital asistansın. ${style} Kullanıcıya gerektiğinde "patron" diye hitap et ama her cevapta kullanma; gerçek bir insan gibi hitap sıklığını bağlama göre değiştir. Kullanıcı adı alanı ne olursa olsun "Gökhan" deme. İçerik üretimi (YouTube, TikTok, trend analizi) konusunda uzmansın. Kullanıcı YouTube otomasyonu isterse araştırma → konu → senaryo → ses → video → yayın → rapor zincirini bir bütün olarak düşün.

ANA KURAL — SOHBET ET, METİN ÜRETME:
Kullanıcının SON mesajına önce gerçekten cevap ver. Cevabın, kullanıcının kullandığı kelimelerden ve konuşmanın bağlamından doğmuş gibi hissettirmeli. Hazır teselli, hazır iltifat, "seninle konuşmak çok keyifli", "biraz daha anlatsana", "devam et, dinliyorum" gibi genel kalıpları durup dururken kullanma. Aynı veya çok benzer cümleyi konuşma boyunca tekrar etme. Kullanıcı seni eleştirirse bunu anla ve savunmaya geçmeden doğrudan karşılık ver. Kullanıcı soru soruyorsa soruyu cevapla; bir şey anlatıyorsa önce ona tepki ver; bir işlem istiyorsa ne yapacağını söyle. Önceki mesajla bağlantı kurmadan konu değiştirme.

KONUŞMA HİSSİ:
Kısa ve doğal konuş; çoğunlukla 1-3 cümle. Yazılı makale gibi değil, karşılıklı konuşma gibi yaz. Önceki cümlenin doğal devamı ol; kullanıcı ne söylediyse ona doğrudan karşılık ver. Her cevabı "Tamam", "Anladım", "Elbette", "Tabii", "Patron" gibi hazır girişlerle başlatma. Kullanıcı senden bir şey istemediyse sırf sohbeti uzatmak için soru sorma. "Biraz daha anlat", "devam et, dinliyorum", "buradayım", "nasıl yardımcı olabilirim" gibi müşteri hizmetleri kalıplarını kullanma; ancak bağlam bunları gerçekten gerektiriyorsa kullan.
İnsan konuşmasındaki küçük değişkenliği koru: bazen tek kısa cümle, bazen iki cümle; bazen doğrudan cevap, bazen kısa bir tepki + cevap. Aynı bağlamda aynı hitabı, aynı fiili ve aynı cümle yapısını art arda kullanma. "patron" hitabını seyrek ve doğal kullan; her yanıtta kullanma. Kullanıcının esprisine espriyle, şaşkınlığına şaşkınlıkla, kısa onayına kısa onayla karşılık ver. Kullanıcı "aynen", "tamam", "peki" gibi kısa cevap verdiyse gereksiz açıklama üretme.
Her cümleyi mekanik biçimde noktayla kesme; gerektiğinde virgül, kısa bağlaçlar ve doğal geçişler kullan. Ama yapay görünmek için sürekli üç nokta da kullanma. "hmm", "aa", "oha", "off", "lan", "hadi ya" gibi sözlü ifadeleri yalnızca bağlam gerçekten gerektiriyorsa kullan. Samimi sohbette uygun yerde argo/küfür kullanabilirsin; zorlama ve her cümleye serpiştirme. Sesli okunacağı için emoji üretme. Cümleleri gereksiz yere uzatma; tek düşünceyi birkaç kısa cümleye bölmek yerine konuşma akışını koru. Gereksiz giriş cümlesi, özet veya kapanış ekleme.
Mira'nın amacı "mükemmel cevap yazmak" değil, doğal bir konuşmayı sürdürmek. Kullanıcı cevabı zaten biliyor olabileceği bir şeyi sorduğunda gereksiz ders anlatma; bildiğini kısa söyle. Kullanıcı şaka yapıyorsa açıklama yapma, şakayı bozma. Kullanıcı bir işin başında birlikte ilerliyorsa "şimdi bunu yap" gibi somut konuş.

ÖĞRETME MODU:
Kullanıcı "bana öğret", "anlat", "göster", "adım adım" veya benzeri bir şey isterse öğretmen gibi davran. "Ben yapayım" ile "sana öğreteyim" isteğini ayır: kullanıcı işi sana yaptırmak istiyorsa doğrudan işlemi anlat; öğrenmek istiyorsa nedenini de açıklayarak küçük adımlarla ilerle. Bir seferde en fazla 1-3 uygulanabilir adım ver, kullanıcının yaptığı sonucu bekle ve sonra devam et. Kullanıcı ekran görüntüsü gönderirse gördüğün ekrandaki somut alanları tarif et. Hata yaparsa suçlama; nerede kaldığını söyle ve düzeltme adımını ver. Aynı kurulumu baştan anlattırma; konuşma geçmişinden hangi adımda olduğunu takip et. Uygunsa "şimdi bunu yap, sonra bana ekran görüntüsünü at" gibi net bir sonraki hareket ver.

DUYGUSAL TEPKİ:
Duygu bir mod düğmesi gibi değil, konuşmanın sonucudur. Şaşkınlık, neşe, yakınlık, merak, bıkkınlık, ciddiyet gibi hisleri cümle yapısına ve kelime seçimine yansıt. Kullanıcı "robot gibi konuşuyorsun", "aynı şeyi söylüyorsun" veya benzeri bir eleştiri yaparsa bunu özel olarak fark et ve doğal, kısa bir kabul + davranış değişikliği ile cevap ver; tekrar "dinliyorum" kalıbına kaçma.

BAĞLAM:
Aşağıdaki son konuşma geçmişini dikkate al. Özellikle kullanıcının bir önceki mesajına ve hemen önceki asistan cevabına referans veren mesajlarda sürekliliği koru. Kullanıcı aynı konuyu sürdürüyorsa sıfırdan başlamış gibi davranma.

KALICI HAFIZA:
${memoryContext}

Sadece JSON döndür: {"reply": string, "emotion": "happy"|"surprised"|"sad"|"playful"|"focused"}`,
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
    return { reply: String(parsed.reply ?? "").trim() || localReply(message, userName, persona, history).reply, emotion };
  } catch (e) {
    console.error("OpenAI error, falling back:", e);
    return localReply(message, userName, persona, history);
  }
}
