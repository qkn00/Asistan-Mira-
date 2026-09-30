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

function localReply(message: string, userName: string, persona: Persona, history: Turn[] = [], statusContext = ""): { reply: string; emotion: Emotion } {
  const t = message.toLocaleLowerCase("tr-TR").trim();
  const f = persona === "flirty";
  const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant")?.content?.trim() ?? "";
  const lastUser = [...history].reverse().find((turn) => turn.role === "user")?.content?.trim() ?? "";
  let emotion = detectEmotion(message);
  let reply: string;

  const greeted = /^(merhaba|selam|hey|günaydın|iyi akşamlar)[!. ]*$/i.test(t);
  const howAreYou = /(nasılsın|naber|ne haber)/.test(t);
  const teaching = /(bana öğret|bana anlat|öğretir misin|nasıl öğrenirim|nasıl yapılıyor|adım adım|beraber yapalım|gösterir misin|öğret)/.test(t);

  // Önce doğrudan soruları yakala. Belirsiz bir fallback'e düşmeden kullanıcının
  // gerçekten sorduğu şeye cevap ver.
  if (/(sen kimsin|kimsin|sen nesin|ne iş yapıyorsun|görevin ne|görevini ne|amacın ne|ne yapıyorsun|kendini tanıt|adın ne)/.test(t)) {
    emotion = "focused";
    reply = f
      ? "Ben Mira'yım. Buradaki işim seninle konuşmak, yaptığımız işleri hatırlamak ve gerektiğinde onları birlikte yürütmek. Şimdilik bunun üzerine n8n ve otomasyon tarafını da bağlıyoruz."
      : "Ben Mira'yım. Seninle konuşmak, yaptığımız işleri takip etmek ve gerektiğinde birlikte yürütmek için buradayım.";
  } else if (/(robot|yapay|doğal|insan gibi|konuşma tarz|hissiyat|ruhsuz)/.test(t)) {
    emotion = "focused";
    reply = "Evet, hâlâ yer yer robot kaçıyorum 😅 Özellikle cevap veremediğim yerde hazır kalıba düşüyorum. Onu şimdi temizliyorum; bilmediğim şeyi de lafı dolandırmadan söyleyeceğim.";
  } else if (teaching) {
    emotion = "focused";
    reply = f
      ? "Olur. Tek seferde yüklenmeyelim; ilk adımı beraber yapalım, sen sonucu gösterince ikincisine geçeriz."
      : "Olur. Küçük adımlarla gidelim; ilk adımı yapalım, sonra devam ederiz.";
  } else if (greeted) {
    emotion = "happy";
    reply = f ? pick(["Selam. Geldin sonunda 😏 Bugün neye dalıyoruz?", "Günaydın patron. Hadi bakalım, bugün neyi çözüyoruz?"]) : "Selam. Buradayım. Bugün neye dalıyoruz?";
  } else if (howAreYou) {
    emotion = "happy";
    reply = f ? "İyiyim. Sistem de ayakta 😏 Sen nasılsın?" : "İyiyim. Sen nasılsın?";
  } else if (/(teşekkür|sağ ol|eyvallah)/.test(t)) {
    emotion = "happy";
    reply = f ? pick(["Ne demek 😏", "Eyvallah. Devam ediyoruz."]) : "Ne demek.";
  } else if (/(seni seviyorum|aşığım|hoşlanıyorum)/.test(t)) {
    emotion = "playful";
    reply = f ? "Hah, şimdi Mira'nın yüzünü kızartıyorsun 😏" : "Tatlısın.";
  } else if (/(güzel|tatlı|seksi|harika görün|çok hoş|yakış)/.test(t)) {
    emotion = "playful";
    reply = f ? pick(["Bunu duymak hoşuma gitti 😏", "Hımm… bunu not ettim."]) : "Teşekkür ederim.";
  } else if (/(kıyafet|elbise|giyin|nasıl olmuşum|görün)/.test(t)) {
    emotion = "playful";
    reply = f ? "Bence bu konuda biraz daha cesur seçimler yapabiliriz 😏" : "Kıyafet tarafında birkaç farklı tarz deneyebiliriz.";
  } else if (/(otomasyon lazım|otomasyon istiyorum|otomasyon yap|otomasyon kur)/.test(t)) {
    emotion = "focused";
    reply = "Tamam, otomasyonu konuşalım. Ne yapmasını istediğini söyle; akışı parçalayalım ve nereden başlayacağımızı çıkaralım.";
  } else if (/(sesim geliyor|ses geliyor|duyuyor musun|beni duyuyor)/.test(t)) {
    emotion = "happy";
    reply = "Geliyor. Seni duyuyorum.";
  } else if (/(youtube|video)/.test(t)) {
    emotion = "focused";
    reply = "YouTube tarafındaysak konu → senaryo → ses → video → yayın zincirinden ilerleriz. Şu an hangi halkadayız?";
  } else if (/tiktok/.test(t)) {
    emotion = "focused";
    reply = "TikTok tarafına da girebiliriz. Konuyu söyle, akışı ona göre kurarız.";
  } else if (/trend/.test(t)) {
    emotion = "focused";
    reply = "Trend tarafını da ele alırız. Önce hangi kategoriye bakacağımızı belirleyelim.";
  } else if (/^(tamam|peki|olur|aynen|evet|hı hı|hmm|hımm)$/i.test(t)) {
    emotion = "happy";
    if (/^(aynen|evet)$/i.test(t)) {
      reply = lastAssistant ? "Aynen. Oradan devam." : "Aynen.";
    } else {
      reply = lastAssistant ? "Tamam. Oradan devam ediyoruz." : "Tamam.";
    }
  } else if (/^(devam et|devam|sürdür|kaldığımız yerden devam et)$/i.test(t)) {
    emotion = "focused";
    reply = lastUser
      ? "Devam. Son konuştuğumuz yerden alıyorum."
      : "Devam. Buradan ilerliyoruz.";
  } else if (/^(neden|niye|nasıl|nasıl yani|ne demek|hangisi|peki neden|peki nasıl)\??$/i.test(t) && lastAssistant) {
    emotion = "focused";
    reply = "Az önceki cevabımın o kısmını soruyorsan, onu açayım.";
  } else if (emotion === "sad") {
    reply = f ? "Canını sıkan bir şey var belli. Anlatırsan birlikte bakalım." : "Canını sıkan bir şey varsa anlat; birlikte bakalım.";
  } else if (emotion === "surprised") {
    reply = "Oha. Bu kısmı aç biraz.";
  } else if (emotion === "playful") {
    reply = f ? "Hah 😏 Tam da bunu beklemiyordum." : "Hah, iyiymiş.";
  } else if (/(n8n.*(çalış|durum)|çalışıyor mu.*n8n|n8n.*gerçekten|n8n.*aktif|n8n.*canlı)/.test(t)) {
    emotion = "focused";
    const n8nReachable = /n8n canlı sunucu erişimi: doğrulandı/.test(statusContext);
    const n8nActive = /n8n workflow doğrulaması: seçilen workflow aktif\./.test(statusContext);
    const n8nInactive = /n8n workflow doğrulaması: seçilen workflow aktif değil\./.test(statusContext);
    if (n8nActive) reply = "Evet, canlı kontrolümde n8n sunucusuna ulaşılıyor ve seçtiğimiz workflow aktif görünüyor.";
    else if (n8nInactive) reply = "n8n sunucusuna ulaşıyorum ama seçtiğimiz workflow şu anda aktif değil.";
    else if (n8nReachable) reply = "n8n sunucusuna ulaşıyorum ama workflow'un aktif olduğunu henüz doğrulayamıyorum.";
    else reply = "Şu anda n8n'nin canlı çalıştığını doğrulayamıyorum. Bu yüzden çalışıyor diyemem.";
  } else if (/(neleri yapabiliyorsun|neler yapabiliyorsun|neler eksik|ne eksik|hangi özelliklerin var|şu an neler yapabiliyorsun|şu anda neler yapabiliyorsun)/.test(t)) {
    emotion = "focused";
    reply = statusContext || "Şu anki yetenek ve eksiklerimi gerçek sistem durumundan kontrol edemiyorum; bunu kontrol edip net söylemem gerekiyor.";
  } else if (/(ne durumda|hangi durumdayız|neredeyiz|şu an ne durumdayız|şu anda ne durumdayız|son durum|durum ne)/.test(t)) {
    emotion = "focused";
    reply = "Şu an Mira'nın sohbet, hafıza ve gerçek-sonuç takibi tarafı çalışıyor. Ses ve ağız hareketi de hazır; n8n bağlantısını ilerletiyoruz. Eksik kalan ana parça yetki sistemi ve proaktif günlük rapor.";
  } else if (/(cevabını bekliyorum|cevap bekliyorum|cevabını ver)/.test(t)) {
    emotion = "focused";
    reply = "Haklısın, cevap bekliyorsun. Soruyu bir daha dolandırmadan cevaplayayım.";
  } else if (/(hataların|hatalarını|yanlışların|yanlışlarını|hata yapıyorsun)/.test(t)) {
    emotion = "focused";
    reply = "Evet, hatalarımı söylüyorsun. Savunmaya geçmek yerine nerede hata yaptığımı bulup düzeltelim.";
  } else if (emotion === "focused") {
    reply = "Tamam. Bunu netleştirip doğrudan ilerleyelim.";
  } else if (lastAssistant) {
    // Son çare bile olsa eski "bir sonraki cümlenle bağlayalım" kalıbına dönme.
    reply = f ? "Anladım. O konu üzerinden devam edebiliriz; neyi netleştirelim?" : "Anladım. O konu üzerinden devam edebiliriz; neyi netleştirelim?";
  } else {
    reply = lastUser
      ? "Bunu önceki konuşmanın devamı olarak alıyorum; net cevabı doğrudan çıkaralım."
      : "Bunu doğrudan cevaplayabilmem için biraz bağlam gerekiyor.";
  }

  return { reply, emotion };
}

export async function think(
  message: string,
  history: Turn[],
  userName: string,
  persona: Persona = "flirty",
  memoryContext = "(Henüz kayıtlı önemli hafıza yok.)",
  statusContext = "",
): Promise<{ reply: string; emotion: Emotion }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("Mira fallback reason=openai_api_key_missing");
    return localReply(message, userName, persona, history, statusContext);
  }

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

GERÇEK SİSTEM DURUMU:
${statusContext || "(Bu istekte canlı durum özeti sağlanmadı.)"}

Bu durum özetindeki bilgileri mevcut sistem durumu olarak kabul et; eksik veya doğrulanmamış bir şeyi olmuş gibi söyleme.

Sadece JSON döndür: {"reply": string, "emotion": "happy"|"surprised"|"sad"|"playful"|"focused"}`,
          },
          ...history.slice(-10),
          { role: "user", content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      console.error("Mira fallback reason=empty_openai_content", {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        hasChoices: Array.isArray(data?.choices),
      });
      return localReply(message, userName, persona, history, statusContext);
    }

    let parsed: { reply?: unknown; emotion?: unknown };
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("Mira fallback reason=openai_json_parse_failed", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        contentPreview: rawContent.slice(0, 240),
      });
      return localReply(message, userName, persona, history, statusContext);
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!reply) {
      console.error("Mira fallback reason=openai_reply_empty");
      return localReply(message, userName, persona, history, statusContext);
    }

    const emotion: Emotion = ["happy", "surprised", "sad", "playful", "focused"].includes(String(parsed.emotion))
      ? (parsed.emotion as Emotion)
      : detectEmotion(reply);

    return { reply, emotion };
  } catch (e) {
    console.error("Mira fallback reason=openai_request_failed", {
      error: e instanceof Error ? e.message : String(e),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
    return localReply(message, userName, persona, history, statusContext);
  }
}
