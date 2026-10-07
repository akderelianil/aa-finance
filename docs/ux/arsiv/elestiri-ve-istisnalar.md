---
owner: interaction-designer
status: frozen
---

# Eleştirel Gözden Geçirme, İstisna Matrisi ve Damıtma

> **DONDURULDU (2026-10-07).** Karar tarihçesi; artık güncellenmez. Geçerli durum ve istisna kalıpları: [harita](../harita.md) §5.

_2026-10-07 · Anlatım 1-7 üzerinde. Amaç: fikirleri doğru kabul etmeden sınamak, her akışın yaşam döngüsünü çıkarmak, karmaşıklığı süzmek._

## 0. Düzeltmeler ve kararlar (Anlatım 7) — önce bunu oku
Ürün sahibi kararlarıyla önceki yargılarımın bir kısmı **geri çekildi veya düzeltildi**; aşağıdaki maddelerde işaretli.
- **Geri çekildi: "günlük faiz elle girmek üşengeç kullanıcıyla çelişir / toplu giriş şart" (eski #2).** Hata: ürün hedefini yanlış çerçeveledim. Karar: üşengeç kullanıcı şu an kriter değil; kullanıcı her gün kayıt girmek zorunda (aksi halde muhasebe anlamsız), ileride entegrasyon gelecek. Toplu giriş ve mutabakat zorunlu değil.
- **Yumuşatıldı: mutabakat / bakiye düzeltme.** Yalnız bütünlük kontrolü; öncelik düşük, entegrasyon gelince önem kazanır. "Üşengeç için en değerli araç" iddiam geçersiz.
- **Düzeltildi: "taksit gelecek ödemeler tahmin mi (eski #1)".** Çelişki yoktu; ben Plan'ı kayıt gibi düşünmüştüm. Doğrusu: **tüm kayıtlar gerçekleşen esaslı; Plan = kayıt değil, gösterim/hatırlatma.** Taksitli alışverişte tutarın tamamı gider + kart borcu; ekstre taksitleri yeni gider değil (AKS-007).
- **Kabul edildi, karar oldu: bildirim (eski #5, #11).** Yalnız uygulama içi "Yaklaşanlar"; telefon bildirimi yok. İki öneri de (platform sınırı, maliyet) bu sonuca uyuyor.
- **Karar: bölüşmede yüzde/tutar gizli (eski #4).** Varsayılan eşit, ayrıntı "daha fazla" altında.
- **Karar: renk + ikon + (+/−) işareti zorunlu (eski #8).**
- **Çözüldü: kapsam çelişkisi (eski #10).** Nakit avans ve kredi ilk sürümde VAR.
- **Kendi önceki ihmalim:** AKS-008/009'u "📥 yalnız gelen kutusu" bırakıp kapsam çelişkisini tek satır notla geçmiştim; şimdi taslak akış ve matris var, içerik anlatımla doğrulanacak.
- **Hâlâ geçerli eleştirilerim:** Rehber firma katmanı v1 için ağır (eski #3); "Borç" tek düğme mü iki düğme mi (eski #7); "geri al" ilk sürümde şart (eski #9).

## 0b. Kararlar ve eleştirel notlar (Anlatım 8) — en güncel
- **Rehber katmanı + sayfa v1'de olacak (karar).** Eski #3 ("tek kayıt öner") karşılanmadı; karar ürün sahibinin. Kalan uyarı: üç katman + çoktan-çoğa ilişki v1 maliyetini artırır; sade sunma yolları `analiz.md` Anlatım 8 bölümünde (marka yazılır, firma arka planda/boş).
- **"Borç" tek düğme (karar).** Eski #7 kabul edildi; ilk ekran 5 seçenek. Bedel: +1 dokunuş; yön hatası riski (tek düğme) → Geri Al ile dengelenir.
- **Geri Al ilk sürümde VAR (karar).** Eski #9 kabul edildi. Aşağıda matriste "Tüm kayıtlar" satırı ve her akış için not.
- **Vade farkı: karar YOK.** Eski kalan soru #3 açık kalır ("sonra karar verilecek"); AKS-009 murabaha farkı aynı aileye girdi.
- **Eski #6 (vadeli hesapta rollover) güçlendi:** araştırma, Türkiye Finans'ta varsayılanın otomatik yenileme olduğunu söylüyor (varsayım). AKS-018 düzeltildi. "Vade bitince vadesize döner" kararı (Anlatım 6) yenilememe senaryosuna daraldı. Bu, ürün sahibinin kendi kararıyla çelişmiyor ama kapsamını daraltıyor; ürün sahibi kendi hesaplarında hangisini yaşıyor teyit etmeli.
- **Yeni eleştiri: bankaya özgü varsayımlar.** Araştırma çoğunlukla karşılaştırma siteleri ve haberlerden; oran aralıkları güvenilmez. Akışlar oran/komisyon varsaymaz, kullanıcıdan alır (kayıt = gerçekleşen). Banka bilgileri `acik-sorular.md` teyit listesinde.
- **Yeni eleştiri: tek banka standardı tuzağı.** "Türkiye Finans standardı" diğer bankalara genellenmemeli; kullanıcılar başka bankaları da kullanıyor (vadesize hesaplar farklı bankalarda, Anlatım 6). Ayrıca kullanıcılar katılım bankası müşterisi olmayabilir: terim ve davranış (kâr payı, yenileme) bankaya göre değişir.

## 1. Damıtma: her şey üç şeye iner
Biriken ~18 akış, kullanıcıya sadece şu üç ilkel ile sunulabilir:

| İlkel | Kullanıcı dili | Kapsadığı akışlar |
|---|---|---|
| **Hareket** | "Para şuradan şuraya gitti" (tutar, nereden, nereye, ne için) | alışveriş, gelir, ATM, transfer, döviz, yatırım al/sat, faiz yattı, bölüşme payı |
| **Rehber** | "Kimle/nerede" (kişi, marka; firma arka planda) | borç/alacak, bölüşme, emanet, kime ödedim, marka→kategori |
| **Plan** | "İleride şu tarihte şu olacak" (**kayıt değil, gösterim/hatırlatma**; yalnız uygulama içi "Yaklaşanlar") | ekstre taksit takvimi, vade günü, kredi takvimi, "ödemedi" hatırlatması, borç vadesi |

**Sonuç:** Taksit, vadeli hesap, hatırlatma ve borç vadesi dört ayrı özellik değil, tek nesnenin (**Plan: tarih + tutar + kapanma koşulu**) dört kullanımı. Ayrı ayrı tasarlanırsa dört kez kodlanır, dört ayrı ekranı olur. Tek "Yaklaşanlar" listesi kullanıcıya da en sade sunumdur.

## 2. Eleştiri: verilen fikirlerde sorunlu/gereksiz olanlar
Sert söylüyorum; karar yine ürün sahibinin.

1. ~~**"Kayıt = gerçekleşen" ilkesi taksitle çelişiyor.**~~ **DÜZELTİLDİ (Anlatım 7):** çelişki yoktu. Taksitli alışverişte tutarın tamamı gider + kart borcu; aylık taksit yalnız gösterim. İlke: kayıt = gerçekleşen, plan = gösterim/hatırlatma.
2. ~~**Günlük faizi elle girmek, "üşengeç kullanıcı" hedefiyle çelişiyor.**~~ **GERİ ÇEKİLDİ (Anlatım 7):** üşengeç kullanıcı şu an kriter değil, kullanıcı her gün kayıt girer. Eski gerekçe (toplu giriş şart, bakiye düzeltme en değerli araç) geçersiz. Kalan: bakiye düzeltme yalnız bütünlük kontrolü, öncelik düşük; entegrasyon gelince önem kazanır. Tahmini kayıt yasağı doğruydu ve sürüyor.
3. **Rehber'de firma + marka + çoktan-çoğa ilişki aşırı mühendislik riski.** Kullanıcı "Migros" yazar, "Migros Ticaret A.Ş." düşünmez. Öneri: v1'de tek kayıt türü (kişi/yer) + isteğe bağlı tür etiketi; firma katmanı, ancak kullanıcı gerçekten ünvan/IBAN saklamak isterse açılsın. "Belirsiz firma" ve "sonradan bağla" akışı, katman kullanılmayınca zaten gereksiz.
4. **Bölüşmede yüzde payı nadir kullanılır.** Günlük hayatta %95 eşit, kalanı "şu kadar da ben yedim" (tutar). Yüzde ve 3+ kişi destekleyin ama varsayılan **eşit**, yüzde gizli seçenek olsun; ana ekranı yüzde alanıyla kalabalıklaştırmayın. **KARAR (Anlatım 7): kabul, "daha fazla" altında.**
5. **"Hatırlatma isteniyor, kişi/kurum ödemedi" belirsiz ve riskli.** _(KARAR Anlatım 7: yalnız uygulama içi "Yaklaşanlar", telefon bildirimi yok.)_ Üç ayrı şey karışıyor: (i) bana borçlu olan hatırlatma, (ii) ben ödemedim (fatura: kapsam dışı), (iii) kurum iade vermedi. Ayrıca PWA'da push bildirimi özellikle iOS'ta sınırlı/kurulum gerektirir; "bildirim gelir" vaadi platform gerçeğine bağlı. Bildirimden önce uygulama içi "Yaklaşanlar" ekranı yeterli ve güvenli ilk adım.
6. **Vadeli hesapta "vade bitince vadesize döner" bankaların gerçek davranışıyla örtüşmeyebilir.** Birçok banka otomatik yenileme (rollover) yapar; ayrıca erken bozma, stopaj, anapara+faizin ayrı yatması var. Kullanıcıya "hedef hesap" seçtirmek iyi, ama "yenilendi / yenilenmedi" seçeneği şart; yoksa uygulama gerçeği yanlış gösterir.
7. **İlk ekranda "Borç Alma" + "Borç Verme" iki ayrı düğme: gereksiz ayrım olabilir.** Kullanıcı aynı kişiyle iki yönde işlem yapıyor (kişi hem alacaklı hem borçlu). Tek "Borç" → "aldım / verdim" ikinci dokunuş olabilir; ilk ekran 5 olur. **ATM** de aslında cüzdan↔banka transferi; sıklığı yüksekse düğme hakkı var, ama bunun "Transfer"in kısayolu olduğu bilinmeli.
8. **Renk dili (kırmızı/yeşil) tek başına yeterli değil.** _(KARAR Anlatım 7: ikon + (+/−) zorunlu.)_ Renk körlüğü (özellikle kırmızı-yeşil) yaygındır; yön için **işaret (+/−) ve ikon** zorunlu olmalı. Borç renginin ertelenmesi makul; ama bu yüzden erişilebilirlik ertelenmemeli.
9. **Oyunlaştırma + "2-3 dokunuş" hız hedefi, doğruluk ile çatışır.** Para kaydında yanlış kayıt güveni yıkar. "Geri al" ilk sürümde olmalı (bkz. istisna matrisi), seri/animasyon sonra.
10. ~~**Çözülmemiş kapsam çelişkisi:** nakit avans/kredi.~~ **ÇÖZÜLDÜ (Anlatım 7):** ilk sürümde VAR. Risk notu: iki büyük alan (AKS-008/009) henüz anlatılmadı; anlatım gelmeden tasarım yapılmıyor.
11. **Hatırlatma/bildirim = bir ürün içinde ikinci ürün.** _(Uygulama içi liste kararıyla risk kalktı.)_ Zamanlayıcı, kullanıcı tercihleri, izin, tekrar deneme... Tek kullanıcılı aile uygulaması için maliyeti yüksek; ilk faydanın %80'i "Yaklaşanlar" listesinden gelir.

## 3. İstisna / yaşam döngüsü matrisi
Her akış için sorulacak sabit sorular: **yanlış girdim · iptal · iade/ters · kısmi · değişiklik · silme · başkası ilgili (ortak kayıt) · tarih geçti/gecikti.**
Sistem kuralı: yalnız kaydın sahibi düzenler/siler; çift taraflı kayıt silinince bakiyeler tutarlı kalmalı (ters kayıt mı, silme mi: teknik karar, kullanıcıya "Sil" ve "Geri al" olarak görünür).

| Akış | İptal/İade/Değişim/Transfer ve diğer ihtimaller | Durum |
|---|---|---|
| **Kartla alışveriş** | Mağaza **iade** eder (tam/kısmi) → gider ters yazılır, kategori düşer; **değişim** (fark öder/alır) → tek net hareket; kart **ekstre/provizyon farkı**; yanlış kart/kategori → düzenle; **yabancı para** harcama → kur farkı | iade/değişim akışı yok |
| **Taksitli alışveriş** (AKS-007, yeniden yazıldı) | Tek gider + kart borcu; takvim gösterim. **İade** (tam/kısmi) → gider ters, kart borcu azalır, takvim kapanır/yeniden hesaplanır; **değişim**; **erken kapama** = gerçek kart ödemesi (+ banka indirimi farkı); **vade farkı** (alışverişte ayrı faiz gideri, açık soru); **ekstre kesim/son ödeme günü**; kart asgari/kısmi ödeme, gecikme faizi; taksit ertelendi/yapılandırıldı (→ AKS-009); geçmişten süren taksit (açılış: kalan borç); kart kapandı | akışta işlendi; **kod uyumu kontrol edilecek** |
| **Nakit avans** (AKS-008, varsayımsal, Anlatım 8) | Komisyon (oran teyit bekliyor), **günlük işleyen faiz** (çekimden itibaren, doğrulanmadı), TCMB tavanı, **faizsiz kampanya**, nakdin gittiği yer, taksitli geri ödeme, erken kapama, gecikme, kısmi ödeme, iptal/iade (ATM'den çıkmadı), yabancı para, **Geri Al** (uygulama kaydı; bankanın iadesi değil) | varsayımsal; banka bilgileri teyit bekliyor |
| **Kredi** (AKS-009, varsayımsal, Anlatım 8) | Kâr payı/tahsis/sigorta/KKDF-BSMV, **net ele geçen ≠ anlaşılan tutar**, sabit taksit (murabaha), erken kapama (kâr payı indirimi **teyit bekliyor**), kısmi erken ödeme, gecikme, kısmi ödeme, cayma, yapılandırma, ortak kredi; KMH/değişken faiz bu üründe geçersiz olabilir; **Geri Al** | varsayımsal; erken kapama teyit bekliyor; vade farkı kararı yok |
| **Bölüşme** | Biri **ödemedi/kısmen ödedi**; pay **sonradan değişti**; kişi **çıktı/yanlış kişi**; yuvarlama; **tüm bölüşme iptal** (alacaklar silinir); ödeyen ben değilsem (başkası ödedi, ben borçluyum) | "ben borçluyum" yönü ve iptal akışı yok |
| **Borç** (AKS-005, tek düğme: aldım/verdim/ödeşme, Anlatım 8) | **Kısmi ödeme**; **bağışlandı/silindi** (alacaktan vazgeç); **yanlış kişiye / yanlış yön** (tek düğmeyle artar → **Geri Al**); karşı yönde borç (net bakiye); faizsiz/faizli (faizli kapsam dışı); **döviz borcu**; vade; borç **devri** (v1 dışı) | AKS-005'te işlendi; bağışlama muhasebesi açık |
| **Transfer** | **EFT/havale iptal/iade** (karşı taraf reddetti); **komisyon** kesildi; **farklı para birimi**; yolda kaldı (iki tarih) | iade ve komisyon yok |
| **ATM** | Para **çıkmadı/eksik çıktı**; başka banka **komisyonu** (ertelendi: dokunma); yatırma **geç yansıdı** | ertelendi (bilinçli) |
| **Gelir** | Maaş **eksik/fazla yattı**; **geri alındı**; düzenli gelir (tekrar) | düzenli gelir yok |
| **Günlük faiz** | Kesinti (stopaj) **sonradan değişti**; **gün atlandı** (isteğe bağlı toplu giriş, öncelik düşük); faiz **hesaba yatmadı**; oran değişti; kapanış | elle günlük giriş esas; toplu giriş/bakiye düzeltme düşük öncelik |
| **Vadeli hesap** (AKS-018, genişletildi) | **Vade sonu:** vadesize döndü / yenilendi (anapara+faiz veya yalnız anapara) / kısmi; yeni oran-vade; **erken bozma** (faiz kaybı veya ceza, gerçek yatan elle); kısmi erken çekim; vade günü yatmadı/geç yattı (hafta sonu); beklenen ≠ gerçek; hedef hesap **kapanmış**; stopaj brüt/net; yabancı para | akışta işlendi (Anlatım 8 düzeltmesi: **varsayılan = otomatik yenileme**, yenilemede oran değişir, kısmi erken çekim = tam bozma + kalan yeniden açılış, kur korumalı hesap ayrı kural: hepsi varsayım/doğrulanmadı); brüt/net açık soru |
| **Emanet/yatırım** | Baba **para çekti**; **zarar**; baba hesabı **kapandı**; fon **bölünme/ücret** kesintisi; birim değeri hatalı girildi | çıkış/zarar ve düzeltme açık değil |
| **Döviz/yatırım al-sat** | Emir **gerçekleşmedi/kısmi**; komisyon; **kur farkı**; alış iptal | komisyon yok |
| **Kime ödedim / marka** | Marka **yeniden adlandırıldı/birleşti**; yanlış markaya ödenmiş; kişi aynı zamanda marka | birleştirme akışı yok |
| **Yaklaşanlar / hatırlatma** | **Yanlış alarm** (aslında ödenmiş); ertele; kapat; ödeme kaydı girilince **otomatik kapanmalı**; yalnız uygulama içi (telefon bildirimi yok, uygulama açılmazsa görülmez: bilinçli sınır) | otomatik kapanma kuralı yok |
| **Tüm kayıtlar** | Başkasının kaydını düzenleme (yetki), **mutabakat** (yalnız bütünlük kontrolü, düşük öncelik; entegrasyonla önem kazanır), kapanmış dönem kilidi (var), **toplu silme**, **Geri Al (ilk sürümde VAR, Anlatım 8)**: Geri Al ≠ Düzelt ≠ İade/Sil (bkz. `analiz.md`); alt durumlar: çok satırlı işlem (taksit, bölüşme, kredi kaydı) tek adımda geri alınır; başkasının kaydı geri alınamaz; kilitli dönemde geri alınamaz; geri alınan kayda bağlı Plan/Yaklaşanlar kaydı da düzelir; geri alınanı yeniden uygulama (ileri al) kapsamı açık; **gerçekleşmemiş işlem kaydı yok** | Geri Al kararlaştı, kapsamı açık soru; mutabakat ertelendi |

**Önerilen çapraz çözümler (süreç tasarımı için):**
1. Bütün akışlar için **"Geri al"** (ilk 10 sn–dakika) + **"Düzelt"** tek mantık.
2. **Mutabakat / bakiye düzeltme:** "Hesapta şu kadar var" yaz, fark kaydedilir. _(Anlatım 7: yalnız bütünlük kontrolü, öncelik düşük; entegrasyon gelince önem kazanır. Eski "en değerli istisna aracı" iddiası geri çekildi.)_
3. **İade = ters hareket** (aynı kayda bağlı), "yeni gelir" değil; raporlarda gider net düşsün.
4. **Kapanış kuralı:** her Plan kaydı (taksit, borç, vade, hatırlatma) ya tamamlanır, iptal edilir ya da gecikmiş görünür; "açıkta kalan" olmaz.

## 4. Kararlar ve kalan sorular

### Karara bağlananlar (Anlatım 7)
- **Bildirim:** yalnız uygulama içi liste ("Yaklaşanlar"); native/telefon bildirimi yok.
- **Nakit avans/kredi:** ilk sürümde VAR.
- **Vadeli hesap:** otomatik yenileme, rollover ve erken bozma desteklenir (AKS-018).
- **Plan = gösterim/hatırlatma, kayıt değil.** Tek "Yaklaşanlar" listesi bu ilkeyle fiilen kabul edildi (taksit takvimi, vade günü, kredi takvimi, alacaklar); yine de listenin tek nesne olarak kurgulanması ayrıca onaylanabilir.
- **Mutabakat:** ilk sürümde zorunlu değil; yalnız bütünlük kontrolü, düşük öncelik (eski öneri "evet" geri çekildi).

### Karara bağlananlar (Anlatım 8)
- Rehber (kişi/firma/marka) + Rehber sayfası v1'de VAR.
- İlk ekran 5 seçenek; Borç tek düğme.
- Geri Al ilk sürümde VAR.
- Nakit avans/kredi: varsayımsal, Türkiye Finans araştırmasıyla ilerle.

### Kalan sorular
1. **Vade farkı** (karar YOK, sonra): banka toplamı baştan kart borcuna yazıyorsa faiz kısmı ayrı gider mi? (AKS-007, AKS-009 aynı aile)
2. **Geri Al kapsamı:** süre, hangi kayıtlar, iade/silme farkı (`acik-sorular.md`).
3. **Terim:** faiz / kâr payı / getiri (`acik-sorular.md`).
4. Banka teyit listesi (`acik-sorular.md`).
