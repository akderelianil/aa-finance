---
owner: interaction-designer
status: active
---

# Açık Sorular

İşaretler: ✔ karar verildi (uygulandıysa "uygulandı") · ⏸ bilinçli ertelendi · [ ] açık. Kararların kaynağı: [gelen-kutusu](gelen-kutusu.md) ve [ROADMAP](../ROADMAP.md). 2026-10-07'de bütün "(Öneri: …)" maddeleri karar sayıldı.

## Önce cevaplanmalı (tasarımı bekletenler)
- [ ] **İade nasıl girilsin?** (harita B1) Bugün yolu yok. Öneri: Gider → Daha fazla → "İade"; aynı kategori ve hesapta ters kayıt, harcama düşer. Seçenekler: (a) öneri · (b) İşlemler'de kaydın üstünde "İade geldi" düğmesi (ilk kayda bağlı) · (c) v1'de yok, Gelir olarak gir.
- [ ] **Kart son ödeme tutarı** (harita B2): taksitli alışverişin ekstreye düşmemiş taksitleri tutardan düşülsün mü? Öneri: evet. Seçenek: hayır, kullanıcı "Öde" ekranında tutarı elle düzeltsin.
- [ ] **Alacaktan / borçtan vazgeçme** (harita B4): bakiye kapansın mı, nasıl sayılsın? Öneri: "Borcu sildim" seçeneği; verdiğim borç silinirse gider, aldığım borç silinirse gelir. Seçenek: gelir/gider yazmadan yalnız kapat (raporda görünmez).
- [ ] **Başkası ödedi, benim payım var** (harita B7) v1'de mi? Öneri: evet; Paylaştır'a "Kim ödedi?" alanı (varsayılan ben). Seçenek: Borç → Aldım + ayrı Gider (iki kayıt, bugün mümkün değil çünkü Aldım hesaba para girişi ister).
- ⏸→[ ] **Taksitte vade farkı:** kredide karar var (fark = maliyet gideri, kayıt günü). Taksite de aynı kural uygulansın mı? Öneri: evet; Taksitli'ye isteğe bağlı "Toplam ödenecek" alanı, fark "Kredi Maliyeti" benzeri gider.

## Genel
- [ ] Asıl kullanıcılar kimler (kişi sayısı, yaş, telefon alışkanlığı)? → `personalar/`
- ✔ İlk ekran: dört tür, Gider · Gelir · Transfer · Borç (uygulandı, 2026-10-08). ATM, kart ödemesi, nakit avans Transfer kısayolu.
- [ ] ATM artık iki dokunuş (Transfer + kısayol). Yeterli mi? Öneri: evet; ölçülmedi. Seçenek: Transfer açılınca son kullanılan kısayol seçili gelsin.
- ✔ Borç ikinci adımında son kullanılan yön öne çıksın (karar). **Uygulanmadı:** hep "Aldım" seçili açılır.
- ✔ Terim: "getiri" (kazanç), "maliyet" (borç). Banka türü ayarı yok.
- ✔ Geri Al: son kayıt hemen (8 sn bildirim), sonra Sil; çok satırlı kayıt tek adımda; kişi bakiyesi de geri döner; kilitli dönemde kapalı; ileri al yok (uygulandı).
- [ ] **Düzelt kapsamı:** bugün yalnız sade gider/gelir düzelir, hesap değişmez (harita B3). Öneri: hesap da düzelsin; transfer ve borç da düzelsin. Seçenek: v1'de Sil + yeniden gir yeterli.
- [ ] Bankadan teyit nasıl yapılıyor: ekstreye bakıp göz kontrolü mü, her harcamada anında mı?
- ⏸ Renk dili (borç rengi): "şimdilik es geç" (Anlatım 6).
- [ ] **Terim çatışması:** İşlemler listesi "Aktarım", Hızlı Kayıt "Transfer" yazıyor (harita B11). Öneri: her yerde "Transfer".

## Hızlı Kayıt
- ✔ "Diğer" yalnız döviz ve yatırım (Transfer formunun altında bağlantı); emanet v1 sonrası (uygulandı).
- ✔ Gider seçenekleri "Daha fazla" altında: Taksitli · Paylaştır · Kalemler · Döviz · Not · Etiket (uygulandı). Kalemler taksit ve paylaştırla birlikte kullanılmaz.
- [ ] Kalemli (çok kategorili) giderde paylaştır ve taksit kapalı. Gerçek hayatta "market fişi, kartla taksitli" olur mu? Öneri: v1'de gerek yok.
- [ ] Etiket yalnız Gider, Gelir, Transfer ve Borç'ta var; kredi ve vade sonunda yok. Öneri: her yerde olsun.

## Taksitli alışveriş ([AKS-007](akislar/AKS-007-taksitli-alisveris.md))
- ✔ Tek gider + kart borcu (tutarın tamamı); takvim yalnız gösterim (uygulandı).
- ✔ Kart başına kesim ve son ödeme günü bir kez girilir (uygulandı; Hesaplar ve sihirbaz).
- ✔ İadede gerçek yatan yer ve tutar elle girilir (karar). İade akışı olmadığı için **uygulanamıyor** (yukarıda).
- ✔ Erken kapamada banka indirimi ayrı düzeltme (karar). **Ekranı yok.**
- [ ] Taksit takvimi Yaklaşanlar'da da görünsün mü (harita B6)? Öneri: kart satırının altında "bu ay X taksit".
- [ ] Ödenmiş taksiti olan eski alışveriş silinemiyor. Yanlış girilmiş taksitli alışveriş nasıl düzeltilsin? Öneri: Düzelt'te tutar ve taksit sayısı değişsin, takvim yeniden türesin.

## Bölüşme / borç
- ✔ Paylaştır: eşit varsayılan; kişi başı tutar ya da yüzde "Payları ayrı gir" ile; türler karışabilir; boş kalanlar ve ben kalanı eşit böleriz; artan kuruş bende; benim payım 0 olabilir; paylar toplamı aşarsa hata (uygulandı).
- ✔ Ödeşmede yön kişinin bakiyesinden gelir, kullanıcı değiştirebilir (uygulandı).
- [ ] Arkadaş ödeyince ödeşme kaydında hesap boşsa Nakit sayılıyor. Havale çoğunlukta mı? Öneri: son kullanılan hesap gelsin.
- [ ] Aynı kişiyle hem alacak hem borç: bugün tek net bakiye görünür. Yeterli mi? Öneri: evet.
- ⏸ Borç rengi, borç devri, faizli kişi borcu, yabancı para borç.

## Yaklaşanlar ([AKS-017](akislar/AKS-017-hatirlatma.md))
- ✔ Uygulama içi liste, Ana sayfada; tarihe göre, gecikmiş kırmızı, tarihsiz bakiyeler altta (uygulandı).
- ✔ Borçta vade isteğe bağlı; tarih yoksa bakiye tarihsiz satır olur (uygulandı).
- ✔ Satırdan "Öde" / "Ödeşme" / "Bankada ne oldu?" önceden doldurulmuş formu açar (uygulandı).
- [ ] "Ertele" hep 7 gün. Öneri: yeterli. Seçenek: tarih seçilsin.
- [ ] "Kurum ödemedi": kurum bana borçlu (iade, alacak) mı, ben kuruma ödemedim (fatura, sonraki aşama) mı?
- [ ] Liste yalnız giren üyenin kendi planlarını gösteriyor. Aile üyesinin kart son ödemesi de görünsün mü? Öneri: hayır, v1'de yalnız kendi.

## Rehber ([AKS-016](akislar/AKS-016-kime-odeme-yaptim.md))
- ✔ Kayıtta firma sorulmaz; firma marka ile Rehber'de bağlanır (uygulandı).
- ✔ Yeni isim: giderde/gelirde marka, borçta/paylaştırda kişi (uygulandı).
- ✔ Kayıtta kategori değişirse yalnız o kayıt değişir; marka ilk kullanılan kategoriyi öğrenir; varsayılan Rehber'den değişir (uygulandı).
- ✔ Eski kişiler Rehber'e "kişi" olarak taşındı (uygulandı).
- [ ] Yazım hatası yeni kayıt açıyor (harita B10). Rehber'de "Birleştir" olsun mu? Öneri: evet.
- [ ] Bakiyesi olan kişi arşivlenirse ne olsun? Öneri: önce uyar; bakiye Yaklaşanlar'da kalsın.
- [ ] Firma bazlı rapor (aynı unvana giden toplam) v1'de mi? Öneri: hayır.
- [ ] Anlatım 6 kararı "çok firmalı markada kayıtta firma seçilebilir" idi; uygulamada kayıt yalnız markaya bağlı, firma kayıtta tutulmuyor. Franchise'da kayıt başına firma gerekli mi? Öneri: v1'de hayır; gerekirse Düzelt'e "firma" eklenir.

## Transfer, ATM, nakit ([AKS-012](akislar/AKS-012-transfer.md))
- ✔ Cüzdan tek nakit hesabı; ATM kısayolu cüzdanı kendiliğinden seçer (uygulandı).
- ✔ Kart ödemesi = Transfer → kart (uygulandı).
- [ ] Karttan banka hesabına para (nakit avans virmanı) bugün sıradan transfer (harita B8). Öneri: kart → kendi herhangi hesabım = nakit avans, komisyon sorulsun.
- [ ] Kartta fazla ödeme (borçtan çok yatırma): kart artıya geçer. Uyarı gösterilsin mi? Öneri: evet, engellemeden.
- ⏸ ATM başka banka komisyonu.

## Faizli hesaplar ([AKS-010](akislar/AKS-010-gunluk-faizli-hesap.md), [AKS-018](akislar/AKS-018-vadeli-hesap.md))
- ✔ Günlük faiz elle, gerçekleşen esas.
- ✔ Vadeli açılış: anapara + yıllık oran + gün + stopaj %; beklenen net getiri gösterilir (uygulandı).
- ✔ Vade günü uygulama varsaymaz; kullanıcı "Yenilendi / Hesaba döndü / Erken bozdum" seçer; yenilemede varsayılan anapara + getiri; yeni oran boş başlar, eski oran yalnız bilgi; kısmi çekim "Bir kısmını çektim" ile (uygulandı).
- ✔ Kur korumalı hesap v1'de değil.
- [ ] Günlük faizde kesinti (stopaj) ayrı görünsün mü, yoksa yalnız net yatan mı? Bugün yalnız net.
- [ ] Atlanan günler için toplu faiz girişi (öncelik düşük).
- [ ] Erken bozmada kalan tutar yeni vadeli hesap olarak açılıyor mu (Anlatım 8 varsayımı)? Bugün erken bozma tam kapanış; kalan için yeni vadeli ayrıca açılır.

## Nakit avans ve kredi ([AKS-008](akislar/AKS-008-nakit-avans.md), [AKS-009](akislar/AKS-009-kredi.md))
- ✔ İkisi de v1'de (uygulandı).
- ✔ Nakit avans: kart → Nakit; komisyon isteğe bağlı, gider olur ve kart borcuna eklenir (uygulandı).
- ✔ Kredi: hesaba yatan + taksit sayısı + taksit tutarı; anlaşılan tutar, toplam, ilk taksit tarihi "Daha fazla" altında; toplam geri ödeme borç, maliyet ve masraf kredi günü gider; taksit = Transfer → kredi hesabı (uygulandı).
- [ ] Nakit avans taksitlendiriliyor mu, yoksa tek ekstrede mi ödeniyor?
- [ ] Kredi türleri: ihtiyaç kredisi, KMH, kart borcu yapılandırma; hangileri kullanılıyor?
- [ ] Kredi erken kapama, kısmi erken ödeme, gecikme bedeli, cayma, yapılandırma: hangileri yaşanıyor? Öneri: erken kapama ilk (harita B9).
- [ ] Kredi silinirken taksit ödemesi varsa engelleniyor. Yanlış girilmiş kredi nasıl düzeltilsin? Öneri: Düzelt'te taksit tutarı ve sayısı değişsin.

## Başlangıç ([AKS-019](akislar/AKS-019-baslangic.md))
- ✔ Sihirbaz: Nakit ve kategoriler hazır; banka, kart, kredi sorulur; her adım boş geçilebilir (uygulandı).
- [ ] Sihirbazdaki krediye kalan taksit sayısı ve tutarı sorulsun mu (harita B5)? Öneri: evet, isteğe bağlı.
- [ ] Süren taksitli alışverişler başlangıçta nasıl girilsin? Öneri: kart ekranında "süren taksitler" (kalan sayı + aylık tutar); gider yazılmaz, yalnız takvim.
- [ ] Başlangıçta açık vadeli hesap nasıl girilsin? Bugün yalnız Transfer ile yeni açılış var. Öneri: anapara + oran + vade tarihi, para hareketi olmadan açılış.
- [ ] Başlangıçta kişilerle açık borç/alacak nasıl girilsin? Öneri: Borç → Aldım/Verdim, hesap "yok" seçeneğiyle (para hareketi olmadan).

## Ürün sahibinin teyit edeceği banka bilgileri (Anlatım 8)
Web aramasında bulunamadı veya doğrulanamadı; akışlar bunlara dayanmıyor. Kaynak: kart sözleşmesi/ücret tarifesi, ihtiyaç finansmanı ön bilgilendirme formu, katılma hesabı sözleşmesi.
- [ ] Nakit avans oranı ve komisyonu; faiz çekim gününden mi işliyor; faizsiz kampanya var mı?
- [ ] Kredide erken kapama masrafı ve kâr payı indirimi; kısmi erken ödeme.
- [ ] Erken bozmada kâr payı; kısmi çekimde hesabın tamamı bozuluyor mu.
- [ ] Otomatik yenileme ayarı; yenilemede anapara + kâr payı mı, yalnız anapara mı.
- [ ] Kredi masrafları: tahsis ücreti/sigorta tutardan mı düşülüyor; KKDF/BSMV taksite mi ekleniyor.
- [ ] Kullanıcının bankası katılım bankası mı?

## Emanet para (v1 sonrası, karar 2026-10-07)
- ✔ Baba kullanıcı değil; Rehber'de kişi. Karışık portföy, sürekli giriş/çıkış.
- [ ] Rapor babaya hangi kanalla ve biçimde gidiyor?
- [ ] Hesaplama günlük mü aylık mı; dönem başlangıç değeri nasıl alınıyor?
- [ ] Yatırımlar birden fazla aracı kurumda mı? Fiyatlar elle mi?
- [ ] Kâr/zarar kur farkı ve komisyon dahil mi?
- [ ] Net varlık emanet payını hariç mi tutmalı?
