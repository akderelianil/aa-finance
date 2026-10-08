---
owner: interaction-designer
status: active
---

# Süreç Haritası

_Tek doğru kaynak: "şu an geçerli olan" yalnız burada. Son damıtma: 2026-10-08 (Anlatım 1-8 + [ROADMAP](../ROADMAP.md) kararları + uygulamanın bugünkü hali). Ayrıntılı istisnalar [akislar/](akislar/_indeks.md), ham anlatım [gelen-kutusu](gelen-kutusu.md), karar tarihçesi [arsiv/](arsiv/analiz.md) (dondurulmuş)._

Etiketler: **[karar]** ürün sahibi kararı · **[uygulandı]** uygulamada var · **[öneri]** benim önerim, onay bekliyor · **[varsayım]** banka araştırması, doğrulanmadı.

---

## 1. Tek cümle

Kullanıcı yalnız **olanı** girer (**Hareket**). Uygulama bunu **kimle/nerede** olduğuna bağlar (**Rehber**) ve **ileride ne olacağını** gösterir (**Plan**). Plan bir kayıt değildir; gerçek bir Hareket girilince kendiliğinden kapanır.

## 2. Altı ilke (her akış bunlara uyar)

| # | İlke | Durum |
|---|---|---|
| 1 | **Kayıt = gerçekleşen.** Taksit takvimi, beklenen getiri, kredi takvimi gösterimdir, kayıt değil. | [karar] [uygulandı] |
| 2 | **Varsayılanı sistem verir, kullanıcı değiştirir, boş geçmek serbest.** Son kart, markadan kategori, eşit bölüşme. | [karar] [uygulandı]; son kart yerine Nakit geliyor (§8) |
| 3 | **Banka davranışı varsayılmaz.** Gerçek tutar elle girilir; beklenenle fark gelir ya da gider olur (*Fark* kalıbı). | [karar] [uygulandı] (vadeli, kredi, nakit avans) |
| 4 | **Hatanın üç çaresi:** Geri Al · Düzelt · İade. | Geri Al [uygulandı]; Düzelt kısmi; İade **yok** (§6) |
| 5 | **Yön üç işaretle:** renk + ikon + (+/−). | [karar] [uygulandı] |
| 6 | **Hatırlatma yalnız uygulama içi "Yaklaşanlar".** | [karar] [uygulandı] (Ana sayfada) |

## 3. Ana döngü

```mermaid
flowchart TD
  O([Bir şey oldu]) --> N{Ne oldu?}
  N --> I1[Gider]
  N --> I2[Gelir]
  N --> I3[Transfer: ATM, kart ödemesi, nakit avans, vadeli]
  N --> I4[Borç: Aldım / Verdim / Ödeşme, bankadan kredi]
  I1 & I2 & I3 & I4 --> T[Tutar]
  T --> K[Kime / ne için: Rehber + kategori]
  K --> Y[Çipler: hesap · tarih · Daha fazla]
  Y --> S[Daha fazla: taksit, paylaştır, kalemler, döviz, not, etiket, vade]
  S --> H([Kaydet → Hareket])
  H -- yanlış dokundum --> GA[Geri Al: 8 sn]
  H -. tarihli bir şey doğduysa .-> P[Plan → Yaklaşanlar]
  P --> D{Tarih geldi}
  D -- gerçek kayıt girildi --> PK([Plan kapanır])
  D -- henüz olmadı --> PG[Gecikmiş: kırmızı]
  D -- ertele / vazgeç --> PE[+7 gün / hatırlatma kalkar]
  PG --> D
```

Kullanıcı açısından uygulama dört yerden ibaret:
| Yer | Soru | İçerik |
|---|---|---|
| **Hızlı Kayıt** | "Ne oldu?" | Dört tür: Gider · Gelir · Transfer · Borç [uygulandı] |
| **Yaklaşanlar** (Ana sayfa) | "Ne bekliyor?" | Kart son ödeme, kredi taksidi, vade günü, borç/alacak; tarihe göre, tarihsizler altta [uygulandı] |
| **Rehber** | "Kimle?" | Kişi · marka · firma tek liste, tür süzgeci; kişide bakiye [uygulandı] |
| **İşlemler** | "Ne oldu, düzelt" | Liste, arama, tür ve etiket süzgeci, etiket toplamı; Düzelt / Sil [uygulandı] |

Hızlı Kayıt ekran düzeni [uygulandı]: büyük tutar en üstte · "Kime" ve "Kategori" · çip satırı (hesap · tarih · Daha fazla) · seçenekler "Daha fazla" altında · Kaydet altta sabit. İlk kurulumda `/baslangic` banka, kart ve kredi sorar ([AKS-019](akislar/AKS-019-baslangic.md)).

## 4. Bütün süreçler tek tabloda

| Süreç | Giriş | Ne kaydedilir (kullanıcı dili) | Doğan Plan | Planı kapatan | Durum |
|---|---|---|---|---|---|
| Kartla alışveriş · [AKS-001](akislar/AKS-001-kartla-alisveris.md) | Gider | Harcama + kart borcu | Kart son ödeme | Kart ödemesi | [uygulandı] |
| Fişte birden çok kategori | Gider → Daha fazla → Kalemler | Tek kayıt, kategori başına satır; kalan ana kategoriye | — | — | [uygulandı] |
| Taksitli alışveriş · [AKS-007](akislar/AKS-007-taksitli-alisveris.md) | Gider → Daha fazla → Taksitli | Tutarın tamamı harcama + kart borcu | Taksit takvimi (gösterim) | Kart ödemeleri | [uygulandı]; vade farkı açık |
| Hesabı bölüşme · [AKS-004](akislar/AKS-004-hesap-bolusme.md) | Gider → Daha fazla → Paylaştır | Benim payım harcama, diğerleri bana borçlu | Bakiye Yaklaşanlar'da | Borç → Ödeşme | [uygulandı] |
| Borç aldım / verdim · [AKS-005](akislar/AKS-005-borc.md) | Borç → Aldım / Verdim | Para + kişi bakiyesi (gelir/gider değil) | Vade (isteğe bağlı) | Borç → Ödeşme | [uygulandı] |
| Gelir / günlük faiz · [AKS-010](akislar/AKS-010-gunluk-faizli-hesap.md) | Gelir | Gelir + hesap; günlük faizde net yatan | — | — | [uygulandı]; kesinti ayrı değil |
| Transfer, ATM, kart ödemesi · [AKS-012](akislar/AKS-012-transfer.md) | Transfer (+ kısayol çipleri) | Hesaptan hesaba; gelir/gider yok | — | Kart ödemesi kart son ödemeyi kapatır | [uygulandı] |
| Nakit avans · [AKS-008](akislar/AKS-008-nakit-avans.md) | Transfer: kart → Nakit | Nakit + kart borcu; komisyon harcama | Kart son ödeme | Kart ödemesi | [uygulandı]; banka teyidi [varsayım] |
| Kredi · [AKS-009](akislar/AKS-009-kredi.md) | Borç → Aldım → Bankadan kredi | Hesaba yatan + toplam geri ödeme borcu; masraf ve maliyet gider | Kredi taksidi | Transfer → kredi hesabı | [uygulandı]; erken kapama yok |
| Vadeli hesap · [AKS-018](akislar/AKS-018-vadeli-hesap.md) | Transfer → "+ Yeni vadeli hesap" | Para vadesizden vadeliye; gelir yok | Vade günü | Yaklaşanlar → Yenilendi / Hesaba döndü / Erken bozdum | [uygulandı] |
| Başlangıç (açılış) · [AKS-019](akislar/AKS-019-baslangic.md) | `/baslangic` sihirbazı | Bugünkü bakiye ve borçlar | Kartta son ödeme | — | [uygulandı]; süren taksit/kredi takvimi yok |
| Kime ödedim · [AKS-016](akislar/AKS-016-kime-odeme-yaptim.md) | Her kayıtta "Kime?" | Marka/kişi; firma yalnız Rehber'de | — | — | [uygulandı] |
| Etiket (tatil, proje) | Daha fazla → Etiket | #etiket; İşlemler'de süzgeç ve toplam | — | — | [uygulandı] |
| **İade** (mağaza, EFT) | **Yok** | — | — | — | **Boşluk** (§6) |
| Döviz al/sat · AKS-013 | Transfer altındaki "Diğer" bağlantısı | Eski ekran | — | — | Anlatılmadı |
| Hisse/kripto · AKS-014 | Transfer altındaki "Diğer" bağlantısı | Eski ekran | — | — | Anlatılmadı |
| Emanet yatırım · [AKS-015](akislar/AKS-015-emanet-yatirim.md) | — | Model yok | — | — | [karar] v1 sonrası |

## 5. İstisnalar altı kalıba iner

| Kalıp | Ne zaman | Ne olur | Uygulamada |
|---|---|---|---|
| **Geri Al** | Az önce yanlış girdim | Kayıt hiç olmamış sayılır; bağlı Plan da gider | 8 sn "Kaydedildi · Geri al" bildirimi; çok satırlı kayıt tek adımda; vadeli vade sonu geri alınınca önceki dönem döner |
| **Düzelt** | Olay doğru, alan yanlış | Alan değişir, Plan yeniden hesaplanır | Yalnız sade gider/gelir: tutar, kime, kategori, tarih, kalemler, etiket. **Hesap değişmez.** Diğer türler: Sil + yeniden gir |
| **İade (ters hareket)** | Gerçekte geri döndü | İlk kayda bağlı ters kayıt; harcama net düşer | **Yok** |
| **Fark** | Banka farklı tutar yatırdı/çekti | Gerçek tutar girilir, fark gelir veya gider | Kredi masrafı/maliyeti, vadeli getiri/kesinti, nakit avans komisyonu |
| **Kısmi** | Tutarın bir kısmı oldu | Kalan, Plan'da açık kalır | Ödeşme, kart ödemesi (kalan listede), vadeli kısmi çekim |
| **Kapanış** | Plan'ın sonu | Tamamlandı · vazgeçildi · gecikmiş | Gerçek kayıtla kendiliğinden; borç vadesinde "Ertele" (+7 gün) ve "Vazgeç". **Vazgeç bakiyeyi kapatmaz** (§6) |

Bilinçli ertelenenler (boşluk değil): yabancı para borç ve taksit, ATM başka banka komisyonu, mutabakat/bakiye düzeltme, borç rengi, borç devri, faizli kişi borcu, kur korumalı hesap.

## 6. Uygulamaya bakarak eleştirel bulgular [öneri]

| # | Bulgu | Neden önemli | Öneri |
|---|---|---|---|
| B1 | **İade akışı yok.** Gelir olarak girilirse gelir şişer, harcama düşmez. | Her alışverişte olası; listedeki zorunlu istisna. | Gider → Daha fazla → "İade": aynı kategori ve hesapta ters kayıt. |
| B2 | **Kart son ödeme tutarı taksitli alışverişte yanlış.** Yaklaşanlar kesim günündeki kart borcunun tamamını gösterir; 10 taksitlik 10.000 TL'nin hepsi bu ay ödenecek görünür. | "Öde" düğmesi yanlış tutarı doldurur; kullanıcı bankaya güvenir, uygulamaya güvenmez. | Tutar = kesimdeki borç − henüz ekstreye düşmemiş taksitler. Kullanıcı tutarı yine değiştirebilir. |
| B3 | **Düzelt'te hesap değişmiyor.** "Yanlış kart" en sık hata ([AKS-001](akislar/AKS-001-kartla-alisveris.md)). | Sil + yeniden gir iki iş. | Düzelt'e hesap çipi eklensin. |
| B4 | **"Vazgeç" yalnız hatırlatmayı kaldırır**; bakiye tarihsiz satır olarak listeye geri döner. Alacaktan vazgeçme (bağışlama) kaydı yok. | Kapanış kalıbı eksik; liste temizlenmez. | Ayrı "Borcu sildim" seçeneği: bakiye kapanır; verilen için gider, alınan için gelir. |
| B5 | **Başlangıçta girilen kredi ve süren taksitler takvimsiz.** Sihirbaz yalnız kalan borcu sorar. | Yaklaşanlar en önemli iki kalemi göstermez. | [AKS-019](akislar/AKS-019-baslangic.md): "Kalan taksit sayısı ve tutarı" isteğe bağlı sorulsun. |
| B6 | **Taksit takvimi Yaklaşanlar'da değil**, Ayarlar → Taksitler'de. | İlke 6: tek liste. | Kart satırının altında "bu ay X taksit" bilgisi. |
| B7 | **Başkasının ödediği ortak hesap yok.** Paylaştır yalnız "ben ödedim". | "Arkadaş ödedi, benim payım var" sık bir durum. | Borç → Aldım'a "harcama için" seçeneği ya da Paylaştır'da "ödeyen" alanı. Karar gerekli. |
| B8 | **Kartten banka hesabına nakit avans** sıradan transfer sayılır; komisyon sorulmaz. | Nakit avans yalnız kart → Nakit'te tanınır. | Kart → herhangi bir kendi hesabım = nakit avans. |
| B9 | **Kredi erken kapama ve vade farkı (taksit) için giriş yok.** | Karar var (Fark), ekran yok. | Kredi satırında "Erken kapattım": ödenen tutar, kalan borç maliyetten düşer. |
| B10 | **Yazım hatası yeni Rehber kaydı açar.** "Migros" / "Migroz" iki marka olur. | Rapor bölünür. | Rehber'de "Birleştir". |
| B11 | **Terim çatışması:** Hızlı Kayıt "Transfer", İşlemler listesi "Aktarım" yazıyor. | Bir kavram iki terim. | Her yerde "Transfer" (sözlük). |
| B12 | **ATM ilk ekrandan kalktı;** artık Transfer + kısayol = iki dokunuş. | ATM sık işlemlerdendi (Anlatım 8). | Kısayol ilk çip olarak kalsın; sık kullanılırsa Transfer açılınca seçili gelsin. |

## 7. Karar durumu

**Kesin ve uygulandı:** Hızlı Kayıt dört tür (Gider · Gelir · Transfer · Borç) · ATM, kart ödemesi, nakit avans, vadeli açılış Transfer içinde · kredi Borç → Aldım → Bankadan kredi · Borç tek düğme (Aldım/Verdim/Ödeşme), ödeşmede yön kişinin bakiyesinden · taksit, paylaştır, kalemler, döviz, not, etiket "Daha fazla" altında · paylaştırda varsayılan eşit, tutar/yüzde "Payları ayrı gir" ile, artan kuruş bende, benim payım 0 olabilir · Rehber üç tür, yeni isim giderde marka, borçta kişi; marka ilk kullanılan kategoriyi öğrenir · her üyeye "Nakit" cüzdan · Geri Al 8 sn, sonra Sil · Yaklaşanlar Ana sayfada · kart kesim/son ödeme günü kart başına bir kez · kredi: toplam geri ödeme kredi günü borç, maliyet o gün gider · vadeli: anapara + yıllık oran + gün + stopaj %, vadede gerçek tutar · terimler "getiri" / "maliyet" · emanet yatırım v1 sonrası.

**Tasarımı bekleten açık sorular** (ayrıntı [acik-sorular](acik-sorular.md)):
1. **İade** nasıl girilsin? (B1)
2. **Kart son ödeme tutarı** taksitleri dışlasın mı? (B2)
3. **Alacaktan vazgeçme** kaydı: gider mi, yalnız kapanış mı? (B4)
4. **Başkasının ödediği ortak hesap** v1'de mi? (B7)
5. **Taksitte vade farkı:** kredideki kural (fark = maliyet gideri, alışveriş günü) burada da geçsin mi?
6. **Banka teyitleri** (nakit avans oranı/komisyonu, erken kapama, erken bozmada kâr payı, otomatik yenileme). Ürün sahibi sözleşmeden bakacak.

## 8. Uygulamayla bilinen uyumsuzluklar

| Konu | Durum |
|---|---|
| Kart son ödeme tutarı taksiti dışlamıyor | Açık (B2) |
| Sihirbazdaki kredi/kart: takvim ve süren taksit yok | Açık (B5) |
| Taksit takvimi yalnız Ayarlar → Taksitler'de | Açık (B6) |
| Kayıtta firma tutulmuyor (Anlatım 6: çok firmalı markada seçilebilir) | Onay bekliyor |
| Kredi ve vade sonu formunda etiket yok | Küçük |
| Borçta "son kullanılan yön öne çıksın" kararı uygulanmadı; hep "Aldım" seçili açılır | Açık |
| İlke 2 "son kart varsayılan" uygulanmadı; hesap çipi boşsa Nakit sayılır | Açık |
| Vadeli açılışta "vade sonunda hangi hesaba" sorulmuyor; vade günü sorulur | Kabul edilebilir (isteğe bağlı karardı) |

## 9. Bu belge nasıl güncellenir

İşleyiş: [README](README.md) (İşleyiş). Yeni istisna önce §5'teki kalıplara oturtulur; oturmuyorsa yeni kalıp önerilir.
