---
owner: interaction-designer
status: frozen
---

# Çapraz Analiz

> **DONDURULDU (2026-10-07).** Bu dosya Anlatım 1-8 karar tarihçesidir, artık güncellenmez. Geçerli durum: [harita](../harita.md).

_Son güncelleme: 2026-10-07 (Anlatım 1-8; son kararlar Anlatım 8)_

## Anlatım 8 kararları ve sonuçları (en güncel, önce bunu oku)
1. **Rehber (bireysel kişi / firma / marka) ve Rehber sayfası v1'de OLACAK.** Ürün sahibinin kararı; "tek kayıt öner" eleştirimi (elestiri #3) karşılanmadı, karar onundur. Risk notu kalır: üç katman v1 iş yükünü artırır. Katmanı sade sunma yolları (hepsi **öneri**, doğrulanmadı):
   - **Kullanıcı yalnız marka yazar; firma arka planda ve boş.** Kayıt anında firma sorusu yok. "Belirsiz" zaten geçerli durum (Anlatım 6): firma yoksa marka tek başına geçerlidir.
   - **Firma alanı Rehber sayfasında "ayrıntı" altında, varsayılan kapalı.** Firma/IBAN/ticari unvan yalnız kullanıcı Rehber'de bir kaydı açıp "Firma ekle" derse görünür.
   - **Kayıt anı = tek alan, yazarken öner.** "Kime?" tek kutu; kişi mi marka mı olduğunu kullanıcı seçmez, ilk sonuç türü etiketiyle gelir; yeni isimde varsayılan tür "marka" (gider) ya da "kişi" (borç akışında). Tür sonradan değiştirilebilir.
   - **Rehber listesi tek liste, tür filtreyle.** Üç ayrı sayfa/sekme değil.
   - **Firma bazlı rapor yalnız en az bir kayıtta firma varsa görünür**; yoksa gösterilmez (boş ekran riskini kaldırır).
   - Mühendislik tarafı (uyumsuzluk): `contacts` firma/marka/kişi ayrımını ve çoktan-çoğa marka-firma ilişkisini taşımıyor olabilir; geçmişi bağlama kapsamı açık soru.
2. **İlk ekran 5 seçenek:** Gelir · Gider · Transfer · Borç · ATM. Borç tek düğme, ikinci dokunuş Aldım / Verdim / Ödeşme (AKS-005; AKS-006 birleşti). Bedeli: en sık işlemlerden birine +1 dokunuş; son yön/kişi öne çıkarılarak telafi önerilir (sıklık verisi yok, doğrulanmadı). Not: "Ödeşme" (borcu kapama) mevcut notlarda kaybolma riskindeydi; yön seçiminde üçüncü seçenek olarak eklendi (**öneri**).
3. **Vade farkı muhasebesi: karar YOK, sonra karar verilecek.** AKS-007 ve AKS-009 (murabaha toplam geri ödeme farkı) aynı soru ailesi; tek karar ikisini kapatır. Karar verilene kadar iki akış da "toplam borç baştan mı, taksitte mi" seçeneklerini açık tutar.
4. **Geri Al ilk sürümde VAR — tüm akışlar için ortak ilke.** Ayrıntı ve kapsam soruları aşağıdaki "Ortak ilke: Geri Al" ve `acik-sorular.md`.
5. **Banka bağımlı davranış ilkesi (yeni).** Nakit avans, kredi ve vadeli hesapta sonuç bankanın sözleşmesine bağlı (varsayılan yenileme, erken kapama indirimi, günlük faiz). Uygulama bunları **varsaymaz ve kendiliğinden yazmaz**: kullanıcı gerçeği girer (kayıt = gerçekleşen); uygulama yalnız *gösterim* üretir ve onu "tahmini" etiketler. Banka bilgileri `acik-sorular.md` "Ürün sahibinin teyit edeceği banka bilgileri" listesinde.
6. **Terim sorunu: "faiz" mi "kâr payı" mı.** Katılım bankası ürünleri (Türkiye Finans) faiz değil kâr payı kullanır. Ortak çözüm önerisi: arayüzde tek nötr kelime ("getiri" kazanç tarafı, "maliyet/kâr payı" borç tarafı) veya kullanıcının banka türü ayarına göre etiket. Karar yok (açık soru). Eleştirel not: banka türü ayarı yeni bir kullanıcı alanı ekler; nötr kelime bunu ortadan kaldırır.

### Ortak ilke: Geri Al (Anlatım 8)
Geri Al, "Düzelt" ve "Sil"den ayrıdır; kullanıcı dilinde üçü:
- **Geri Al:** az önce yaptığım kaydı yok say (yanlış dokundum). Hızlı, kısa süreli, tek dokunuş; kayıt silinmiş gibi bakiyeler eski haline döner.
- **Düzelt:** kaydı koru, alanı değiştir (tutar, kişi, kategori).
- **Sil / İade:** bankada gerçekten olmuş bir işlem tersine döndü (mağaza iadesi) → *ters hareket*, geçmiş kalır. Geri Al ile karıştırılmamalı: iade gerçek bir olaydır, Geri Al ise "hiç olmadı" demektir.
Her yeni/güncel akış için istisna matrisine Geri Al satırı eklendi (`elestiri-ve-istisnalar.md`). Kapsam (süre, hangi kayıtlar, çok kayıtlı işlemler, kilitli dönem) açık soru.

## Ortak nesneler
- **Para kutusu:** cüzdan (nakit), vadesiz, vadeli, kredi kartı, yatırım. Kullanıcı bunları "yer" olarak düşünüyor, hesap olarak değil.
- **Kişi:** arkadaş (borç/alacak, bölüşme), baba (emanet). Kişi hem alacaklı hem borçlu olabilir.
- **Olay tipleri:** harcama, gelir, çekme/yatırma, transfer, borç al/ver, bölüşme, döviz, yatırım al/sat, taksit.

- **Rehber (Kişiler/Kurumlar):** üç tür: **bireysel kişi**, **kurumsal firma** (ticari unvan), **marka** (firmaya bağlı). Ödeme **markaya** yazılır, firma arka plandan türetilir (kullanıcı kuralı: türetilebilen otomatik). Banka hesabı (banka adı + IBAN) hem kişide hem firmada olabilir. Borç/alacak (AKS-004/005/006) ve emanet (baba) aynı Rehber'deki bireysel kişilerle bağlanır.

- **Rehber kararları (Anlatım 5):** marka ↔ firma çoktan-çoğa (franchise/bayi); kişi de marka olabilir; firma yoksa marka tek başına geçerli; **kategori markadan** varsayılan gelir; IBAN çoğunlukla kopyalama (her IBAN'da tek dokunuşla kopyala). Ticari unvan dışındaki kurumsal alanlar isteğe bağlı.
- **Faizli hesap, iki davranış:** (a) günlük faizli: günlük otomatik gelir + kesinti (vergi) görünür; (b) vadeli: sözleşme, vade sonu net tutar baştan bilinir (kullanıcı bugün Excel'le hesaplıyor → değer önerisi). İkisi de "faiz geliri" (yeşil) üretir.

## Kararlar ve çıkan sonuçlar (Anlatım 6)
- **Gider = ana akış, seçenekleri var:** taksit (AKS-007) ve paylaştır (AKS-004) Gider'in içinde. Yani "Gider" tek başına üç yolu taşır: tek çekim, taksitli, paylaşımlı; bunlar birleşebilir (taksitli + paylaşımlı). İlk ekran 5 seçenek (Anlatım 8: Borç tek düğme); "Diğer" listesi taksitten arındı.
- **Paylaştır:** 1..n+ kişi (3+), şekiller eşit / tutar / yüzde. Sonuç: paylar tek tutar-toplam kısıtına bağlı (toplam = ödenen tutar); yüzdeler tutara çevrilir, yuvarlama farkı bir tarafta toplanır (kimde, açık soru).
- **Rehber tek yer:** mevcut kişiler Rehber'le birleşir. Bireysel kişi, firma ve marka aynı çatıda; borç/alacak, bölüşme, emanet (baba) hep Rehber'den kişi seçer. Bu, Rehber'i en çok bağlanan nesne yapar.
- **Marka–firma–kategori esnekliği:** firma seçilmezse "belirsiz" geçerli bir durumdur ve sonradan düzenlenir; kategori markadan varsayılan gelir ama her kayıtta değiştirilebilir. Genel ilke: **varsayılanı sistem verir, kullanıcı geçersiz kılar, boş geçmek serbest.**
- **İşlem esaslı kayıt (genişletildi, Anlatım 7):** yalnız gerçekleşen banka işlemi kaydedilir; tahmin/plan her zaman gösterim. Günlük faiz, vadeli hesabın beklenen getirisi, taksit takvimi, kredi takvimi hep aynı ilkeye bağlı. Taksitli alışveriş: tek gider + kart borcu, aylık taksit yeni gider değil (AKS-007).
- **Yaklaşanlar (Plan) ortak ihtiyaç:** AKS-017 (ödemedi), AKS-018 (vade günü), AKS-007 (ekstre taksit takvimi), AKS-009 (kredi takvimi), borç vadesi. Ortak nesne: tarihli gösterim (konu, tarih, tutar, kapanma koşulu). **Karar (Anlatım 7): yalnız uygulama içi liste; telefon bildirimi yok. Plan kayıt değildir, gösterim/hatırlatmadır.** Kapanma, gerçek bir kaydın girilmesiyle olur (ödeme, vade sonu kaydı).

## Anlatım 7 kararları (özet)
- **Üşengeç kullanıcı şu an kriter değil.** Kullanıcılar her gün kayıt girmek zorunda; entegrasyon ileride. Önce elle girilen sağlam sistem; sadeleştirme sonraki aşama. Mutabakat yalnız bütünlük kontrolü, öncelik düşük (entegrasyon gelince artar).
- **Tüm kayıtlar gerçekleşen esaslı.** Taksit, kredi takvimi, vade getirisi: kayıt değil gösterim.
- **Nakit avans ve kredi ilk sürümde VAR** (kapsam çelişkisi çözüldü; bkz. aşağıda).
- **Renk + ikon + (+/−) işareti** zorunlu (bkz. Hızlı Kayıt ilkeleri).
- **Vadeli hesap yaşam döngüsü (Anlatım 7):** açılış (para yer değiştirir) → vade sonu (vadesize / yenilendi: anapara+faiz ya da yalnız anapara / kısmi) → erken bozma (gerçek yatan tutar elle, fark gelir veya gider). Ayrıntı AKS-018.
- **Vadeli hesap, hedef hesap seçimi (düzeltildi, Anlatım 8):** Türkiye Finans standardında (varsayım, doğrulanmadı) varsayılan sonuç **otomatik yenileme**; vadesize dönüş yalnız yenilememe talimatı varsa olur. Hedef hesap bu senaryoya bağlı bir bilgidir (birden fazla vadesiz hesap olduğu için hangisi seçilir). Yenilemede oran değiştiği için sonraki dönemin beklenen getirisi "tahmini" etiketlenir. Erken bozma = tam bozma + kalan yeniden açılış (varsayım).
- **Ertelenenler (bilinçli):** borç rengi (tek renk / iki ayrı), ATM başka banka komisyon masrafı (varsayılan kategori/hesaplar bitmeden dokunulmaz). Bunlar tasarımda "boşluk" değil "ertelendi" olarak okunmalı.

## Yeni uyumsuzluk / kontrol notları (modelle)
- Yaklaşanlar: borç kaydında vade tarihi, kartta kesim/son ödeme günü gibi alanlar yok olabilir (kontrol). Telefon bildirimi altyapısı gerekmiyor (karar).
- Vadeli hesap: oran, vade tarihi, hedef vadesiz hesap alanları; "günlük faizli" ile "vadeli" ayrımı hesap türü olarak karşılık bulmuyor olabilir (kontrol).
- Rehber birleşmesi: `contacts` yapısı firma/marka/kişi ayrımını ve çok-çok marka-firma ilişkisini taşımıyor olabilir; mevcut kişi verisinin taşınması (hepsi "bireysel") açık soru.
- Taksit: mevcut Taksitler sayfası ayrı; "Gider'in seçeneği" kararıyla giriş yolu değişecek, ekran önerisi henüz yok. **Kontrol edilecek (Anlatım 7):** `installment-create/pay` "tek gider + kart borcu, taksit = gösterim" ilkesine uyuyor mu (bkz. AKS-007).
- Nakit avans / kredi: hesap-borç tipi, faiz/komisyon bölünmesi, taksit takvimi (gösterim) modelde karşılık buluyor mu (kontrol).
- Paylaştır 3+ kişi/yüzde: `contact_balances` ile tek adımda kurulabiliyor mu doğrulanmalı.

## Üç sınıf iş
1. **Tek adımlı, sık:** kartla alışveriş, ATM çekme/yatırma, transfer. Hız burada belirleyici.
2. **İki taraflı:** bölüşme, borç al/ver. Kişi + ödeşme takibi var.
3. **Sürekli/karmaşık:** emanet yatırım, vadeli faiz, kredi, taksit.

## Hızlı Kayıt tasarım ilkeleri (taslak, onay bekliyor)
- İlk soru "ne oldu?" (olay tipi), muhasebe sorusu değil. Yüzeyde ~10 büyük seçenek.
- Çoğu olay en çok 2-3 dokunuş: tutar → nereden/nereye → bitti. Gerisi akıllı varsayılan (son kullanılan kart, sık kategori).
- Oyunlaştırma: hız hissi, animasyonlu onay, seri/ilerleme. **Dikkat:** oyun hissi yanlış kayıt riskini artırmamalı; geri al kolay olmalı.
- **İlk ekran = 5 büyük seçenek (karar Anlatım 8; eskiden 6):** Gelir · Gider · Transfer · **Borç** (tek düğme; ikinci dokunuşta Aldım / Verdim / Ödeşme, bkz. AKS-005) · ATM. _(Önceki: Borç Alma ve Borç Verme ayrı düğmeydi.)_ Eleştirel not: ATM aslında cüzdan↔hesap transferi; sıklığı yüksek olduğu için düğme hakkı var ama Transfer'in kısayolu olduğu bilinmeli. Döviz, yatırım, taksit, bölüşme ilk ekranda yok; ilgili seçeneğin içinde (ör. bölüşme = Gider'in devamı; ATM = çekme/yatırma tek dokunuş ayrımı; döviz/yatırım/taksit/emanet = ilk ekranda **"Diğer"** altında; karar verildi, Anlatım 3).
- Renk dili sabit: gelir yeşil · gider kırmızı · net varlık mavi · borç turuncu. Aynı nesne her ekranda aynı renk.
- **Renk tek başına yetmez (karar, Anlatım 7):** gelir/gider/borç yönü için **ikon + (+/−) işareti zorunlu**; renk yalnız pekiştirir. Her tutar gösteriminde (liste, rapor, özet) işaret ve ikon bulunur. Gerekçe: kırmızı-yeşil renk körlüğü ve hızlı tarama.
- **Hız ilkesi ve üşengeçlik (Anlatım 7):** şimdilik kriter değil; sağlam elle giriş önce. "2-3 dokunuş" hedefi doğruluktan önce gelmez; **Geri Al ilk sürümde VAR (Anlatım 8)**.
- _(Not: bu iki madde dosyada üç kez tekrarlıydı; tek kopyaya indirildi.)_

## Modelle gerilim noktaları (`docs/ARCHITECTURE.md`)
- **Emanet para** → "her kayıt tek üyeye aittir" ve net varlık tanımıyla çatışıyor (para benim hesabımda ama benim değil). Karışık portföy olduğu için hesap bazlı ayırma işe yaramaz; **pay (birim) bazlı** hesap gerekir. Babanın kâr/zarar raporu uygulama dışına çıkar (baba kullanıcı değil). Giriş/çıkış sürekli olduğundan **fon yönetimi benzeri birim değeri** (NAV) gerekir; ayrıca bu, aracı kurum uygulamalarıyla yapılan manuel hesabı değiştirecek asıl değer önerisi.
- **Bölüşme** → tek kayıtta kendi payım + başkasının payı (alacak); mevcut kişi borç/alacak bunu tek adımda karşılıyor mu doğrulanmalı.
- **Nakit avans, kredi** → **ÇÖZÜLDÜ (Anlatım 7): ilk sürümde VAR.** Daha önce `CLAUDE.md` ve ARCHITECTURE.md'de kapsam dışıydı; ikisi de artık güncel (başkası güncelledi, ben dokunmadım). AKS-008 ve AKS-009 taslak, anlatım bekleniyor.
- **Cüzdan** → tek nakit hesabı; ATM sormadan otomatik etkiler (mevcut "hesap seç" adımı bu akışta kalkmalı).
- **Borç = turuncu** → "borç" iki anlam taşıyor: kart/kredi borcum ve arkadaşa borcum. **Karar: şimdilik es geçildi** (Anlatım 6), ileride düzenlenecek.

## Henüz yok
Sıklık verisi, kullanıcı tipleri, teyit ihtiyacının gerçek boyutu.
