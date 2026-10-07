---
owner: interaction-designer
status: active
---

# Açık Sorular

(✔ = cevaplandı/karar verildi, ayrıntı [gelen-kutusu](gelen-kutusu.md)'de · ⏸ = bilinçli ertelendi)

## Genel
- [ ] Asıl kullanıcılar kimler (kişi sayısı, yaş, telefon alışkanlığı)? → `personalar/`
- ✔ En sık işlemler: Gelir, Gider, Transfer, Borç Alma, Borç Verme, ATM → **Anlatım 8: ilk ekran 5 seçenek, Borç tek düğme (Aldım / Verdim / Ödeşme ikinci dokunuş)**
- [ ] Borç ikinci adımında "Aldım / Verdim / Ödeşme" sırası ve varsayılan: son kullanılan yön öne çıksın mı? (Öneri: evet; gerçek sıklık verisi yok, doğrulanmadı.)
- [ ] **Terim kararı:** katılım bankasında "faiz" yerine "kâr payı" kullanılır. Arayüzde ne yazsın? (Öneri: nötr "getiri" (kazanç) ve "maliyet" (borç); banka türü ayarı eklemeden. Seçenek: kullanıcı banka türünü seçsin, etiket değişsin.)
- [ ] **Geri Al kapsamı (karar: ilk sürümde VAR):** (a) Süre: yalnız son kayıt mı, oturum boyunca mı, 10 dakika mı, süresiz mi? (Öneri: son kayıt için hemen "Geri Al" + sonra her zaman Düzelt/Sil.) (b) Hangi kayıtlar: taksit, bölüşme, kredi gibi çok satırlı kayıtlar tek adımda mı? (Öneri: evet.) (c) Başkasının payı olan kayıtta (bölüşme) kişi bakiyesi de geri döner mi? (d) Mağaza iadesi/ banka iadesi "Geri Al" değil ters hareket; fark kullanıcıya nasıl anlatılsın? (Öneri: Geri Al = "yanlış girdim", İade = "gerçekten geri geldi".) (e) Kilitli dönemde Geri Al kapalı mı? (Öneri: evet.) (f) Geri alınanı tekrar uygulama (ileri al) olsun mu? (Öneri: hayır, v1'de.)
- [ ] Bankadan teyit nasıl yapılıyor: ekstreye bakıp göz kontrolü mü, her harcamada anında mı?
- ⏸ Renk dili (borç tek renk mi, "benim borcum" / "bana borçlu" ayrımı): kullanıcı "şimdilik es geç, ileride düzenleriz" dedi (Anlatım 6). Renklere takılma.

## Hızlı Kayıt
- ✔ Döviz, yatırım vb. "Diğer" altında
- [ ] "Diğer"in içinde hangileri var ve hangi sırayla (döviz, yatırım, emanet, nakit avans, kredi, faiz…)? (Taksit artık Gider içinde, listeden çıktı.)
- ✔ Taksitli alışveriş **Gider'in bir seçeneği** (Anlatım 6)
- ✔ Bölüşme Gider akışı içinde **"paylaştır" adımı** (Anlatım 6)
- [ ] Gider içindeki seçenekler (taksit, paylaştır, fiş/not) hangi sırada ve nasıl görünür? (Ekran önerisi değil; yalnız hangilerinin "seçenek" olduğu listesi.)

## Taksitli alışveriş (AKS-007, Anlatım 7'de yeniden yazıldı)
- ✔ Taksitli alışveriş = tek gider + kart borcu (tutarın tamamı). Aylık taksit yeni gider değil; ekstre taksit takvimi yalnız gösterim/hatırlatma (Anlatım 7).
- ⏸ **Vade farkı muhasebesi: karar YOK, sonra karar verilecek (Anlatım 8).** Soru: banka toplamı baştan kart borcuna yazıyor mu, yoksa taksit taksit mi; vade farkı alışverişte ayrı gider mi, taksitte mi? (Önceki öneri: baştan yazıyorsa alışverişte gider + ayrı "faiz/vade farkı" gideri; taksit taksit yansıyorsa yansıdığı ekstrede.) Aynı soru ailesi: kredi/ihtiyaç finansmanında kâr payı farkı (AKS-009).
- [ ] Kartlar için ekstre kesim günü ve son ödeme günü girilsin mi (takvim ve Yaklaşanlar buradan türer)? (Öneri: evet, kart başına bir kez.)
- [ ] İadede ödenmiş taksitlerin karşılığı karta mı hesaba mı yatıyor; kullanıcı gerçek yatan yeri elle girsin mi? (Öneri: evet.)
- [ ] Erken kapamada banka kalan faizi siliyor mu; fark nasıl görünsün? (Öneri: "banka indirimi" olarak ayrı düzeltme.)

## Bölüşme / borç
- ✔ 3+ kişi ve yüzdeli paylar gerekebilir (Anlatım 6)
- [ ] 3+ kişide paylaşım türleri: eşit, tutar, yüzde. Aynı bölüşmede türler karışabilir mi (biri tutar, kalanlar eşit)? Yüzdelerin toplamı %100 değilse ne olsun?
- [ ] Yuvarlama: kuruş artarsa (ör. 100 TL / 3) fazla kuruş kimde kalsın (bende mi)?
- [ ] "Paylaştır" adımında kendi payım her zaman var mı, yoksa tamamını başkası için ödediğim durum da (benim payım 0) olabilir mi?
- ✔ Hatırlatma isteniyor: "kişi/kurum ödemedi" şeklinde (Anlatım 6, bkz. AKS-017)
- ⏸ Borç rengi (bkz. Genel)

## Hatırlatma / Yaklaşanlar (AKS-017)
- ✔ Bildirim yalnız uygulama içi liste ("Yaklaşanlar"); telefon bildirimi yok (Anlatım 7). Kişiye mesaj gitmesi de bu sürümde yok.
- [ ] Yaklaşanlar'da hangi kayıtlar görünsün ve hangi sırayla (vade günü, kart son ödeme, kredi taksiti, alacaklar)? Öneri: tarihe göre tek liste, gecikmiş olanlar üstte.
- [ ] "Kurum ödemedi" ne demek: kurum bana borçlu (iade, alacak) mı, yoksa ben kuruma ödemedim (fatura vb., sonraki aşama) mi?
- [ ] Ne zaman hatırlatılsın: borç kaydedilirken tarih mi seçilir, yoksa belli bir süre sonra otomatik mi (ör. 7 gün)? Üşengeç kullanıcı için varsayılan ne olsun?

## Rehber
- ✔ **Rehber katmanı (bireysel kişi / firma / marka) ve Rehber sayfası v1'de OLACAK (Anlatım 8, ürün sahibi kararı).** Sade sunum önerileri: [analiz](arsiv/analiz.md) Anlatım 8 bölümü.
- [ ] Kayıt anında firma hiç sorulmasın, yalnız marka/kişi yazılsın; firma Rehber'de "ayrıntı" altında mı eklensin? (Öneri: evet; firma varsayılan kapalı/boş. Doğrulanmadı.)
- [ ] Yeni isim yazılınca varsayılan tür ne olsun (gider akışında marka, borç akışında kişi)? (Öneri: bağlama göre, sonradan değiştirilebilir.)
- ✔ Ad: Rehber · Firması bilinmeyen marka tek başına kaydedilir · IBAN çoğunlukla kopyalama için · Marka çok firmaya bağlanabilir · Kişi de marka olabilir · Kategori marka üzerinden gelir · Ticari unvan esas, vergi no/iletişim ek bilgi
- ✔ Marka çok firmaya bağlıysa kayıt anında kullanıcı **seçebilir**; seçmezse **belirsiz** kalır; sonradan düzenlenebilir (Anlatım 6)
- ✔ Aynı markanın farklı kategorileri olabilir; kategori otomatik gelir, kullanıcı **değiştirebilir** (Anlatım 6)
- ✔ Mevcut kişiler **Rehber ile birleşecek** (Anlatım 6)
- [ ] Belirsiz firma sonradan seçilince, geçmiş kayıtlar da yeni firmaya mı bağlanır (hepsi), yoksa yalnız seçilen kayıt mı? Franchise'da aynı marka farklı firmalara ödeme yapılmış olabileceği için bu önemli.
- [ ] Kategori değiştirme kapsamı: "yalnız bu kayıt" mı, "bu markanın varsayılanı da değişsin" mi? (Öneri: varsayılan olarak yalnız bu kayıt; markanın varsayılanı Rehber'den değişir.)
- [ ] Belirsiz firmalı harcamalar firma bazlı raporda nerede görünür ("Belirsiz" grubu)?
- [ ] Mevcut borç/alacak kişilerinin Rehber'e taşınması: hepsi "bireysel" olarak mı gelir? (Mevcut `contacts` yapısıyla uyum, bkz. analiz.md uyumsuzluklar.)

## Nakit
- ✔ Cüzdan tek nakit hesabı; ATM çekme/yatırma sormadan etkiler.
- ⏸ ATM'de başka bankanın komisyonu: masraf olarak işlenebilir ama **şimdilik hiç dokunma**; varsayılan kategoriler ve hesaplar tam yapılmadan karar verilmeyecek. İleride yeniden açılır.

## Faizli hesaplar
- ✔ İki tür: günlük faizli (her gün otomatik yatar, vergi/kesinti görünür) ve 30-90 gün vadeli (sözleşme; vade sonu tutar kesin)
- ✔ Günlük faiz kaydı **elle** girilir; **gerçekleşen işlem esas**, tahmini kayıt girilmez; ileride tahmini hesaplama yalnız **gösterilebilir** (Anlatım 6)
- ✔ Vadeli hesapta **beklenen getiri gösterilir**; vade sonu hatırlatması **yalnız uygulama içi (Yaklaşanlar)** (Anlatım 6-7)
- ✔ Otomatik yenileme, rollover, erken bozma kapsamda; akış AKS-018'de (Anlatım 7)
- [ ] Yenilemede varsayılan: anapara+faiz mi yoksa yalnız anapara mı yenilenir? Hesap açılırken "vade sonunda ne olsun" tercihi kaydedilsin mi? (Öneri: evet, vadede değiştirilebilir.)
- [ ] Yenilemede yeni oran/vade girişinde eski oran öneri olarak gösterilsin mi (oran genelde değişir)? (Öneri: göster ama boş geçmeye izin verme.)
- [ ] Beklenen getiri brüt mü net mi gösterilsin (stopaj)? (Öneri: net, stopaj oranı hesap ayarı.)
- [ ] Erken bozmada kısmi çekim yaşanıyor mu? (Anlatım 8 varsayımı: genel sözleşmede kısmi çekim = tam bozma + kalan tutarla yeni hesap; kalan en düşük limitin altındaysa özel cari. Ürün sahibi kendi deneyimiyle teyit etsin.)
- ✔→düzeltildi (Anlatım 8): "Vade bitince vadesize döner" artık **varsayılan değil**. Türkiye Finans standardında (varsayım, doğrulanmadı) varsayılan sonuç **otomatik yenileme**; vadesize dönüş yalnız yenilememe talimatı varsa. Hedef vadesiz hesabı kullanıcı seçer, ama bu **yenilememe senaryosuna bağlı**.
- [ ] Hesap açarken "vade sonunda: yenilensin / şu vadesize dönsün" talimatı kaydedilsin mi? Yoksa uygulama hiçbir şey varsaymasın, vade günü hep "bankaya bak, ne oldu?" mu sorsun? (Öneri: talimat isteğe bağlı kaydedilsin, ama sonuç yine elle onaylansın: kayıt = gerçekleşen.)
- [ ] Yenilemede yeni oran girişi: banka oranı değiştirdiği için eski oranı öneri gösterme (Anlatım 8); "yeni oranı gir" boş mu başlasın? (Öneri: evet, eski oran yalnız bilgi.)
- [ ] Kur korumalı katılma hesabı ayrı tür mü (vadeden önce kısmi çekim yok, yenileme müşteri talebine bağlı)? (Öneri: v1'de değil, düşük öncelik.)
- [ ] Günlük faiz kaydı: günlük elle giriş zorunlu (Anlatım 7: kullanıcı zaten her gün kayıt girer; üşengeçlik şu an kriter değil). Atlanan günler için toplu giriş isteğe bağlı, öncelik düşük.
- [ ] Günlük faizde kayıtta ne yazılır: yalnız "net yatan" mı, brüt faiz + kesinti (stopaj vb.) ayrı mı? (Vergi/kesinti görünür olmalı demiştin; ayrı alan mı, tek tutarın ayrıntısı mı?)
- [ ] Vadeli hesabı açarken kullanıcı ne girer: anapara + oran + gün sayısı (beklenen getiri otomatik), yoksa doğrudan "vade sonunda alacağım tutar" mı? Hangisi sözleşme belgesine daha yakın?
- [ ] Vade sonu hatırlatma ne zaman: vade günü mü, birkaç gün önce mi?
- [ ] Vade günü hedef vadesiz hesap kayıtta mı seçilir (hesabı açarken) yoksa vade bitince mi sorulur? (Öneri: açarken seçilir, vadede değiştirilebilir.)
- [ ] Vade sonu para vadesize **gelmezse** (banka yenilediyse/geciktiyse) kayıt nasıl düzeltilir? Erken bozma ve yenileme (yeniden vadeli açma) yaşanıyor mu?

## Ürün sahibinin teyit edeceği banka bilgileri (Anlatım 8)
Aşağıdakiler web aramasında **bulunamadı veya doğrulanamadı**; akışlar bunlara dayanmıyor, varsayım etiketli. Kaynak önerisi: kart sözleşmesi/ücret tarifesi, ihtiyaç finansmanı ön bilgilendirme formu, katılma hesabı sözleşmesi (Türkiye Finans, Bankacılık İşlemleri Sözleşmesi Bireysel madde 4.9/5/6).
- [ ] **Nakit avans oranı ve komisyonu** (Türkiye Finans kartı): güncel aylık oran (TCMB tavanı haberlerde %4,42 → %5, güncel değer doğrulanmadı), komisyon yüzdesi/asgari tutar, faiz çekim gününden mi işliyor (V3), faizsiz kampanya var mı?
- [ ] **Erken kapama koşulu** (ihtiyaç finansmanı): masraf/tazminat var mı, kalan kâr payı indiriliyor mu (yalnız karz formunda "erken ödeme tarihine göre hesaplanır" ifadesi bulundu)? Kısmi erken ödeme mümkün mü, taksit takvimi nasıl yeniden hesaplanıyor?
- [ ] **Erken bozmada kâr payı** (katılma hesabı): ödeniyor mu, ne kadar; kısmi çekimde hesabın tamamı mı bozuluyor, kalan limit altında mı özel cariye dönüyor?
- [ ] **Otomatik yenileme ayarı:** yenilememe bildirimi nasıl veriliyor (yazılı, şube, mobil); varsayılan yenileme gerçekten uygulanıyor mu; yenilemede hangi oran; anapara+kâr payı mı yoksa yalnız anapara mı yenileniyor?
- [ ] **İhtiyaç finansmanı masrafları:** tahsis ücreti/sigorta kredi tutarından mı düşülüyor yoksa ayrı mı ödeniyor; KKDF/BSMV taksite mi ekleniyor?
- [ ] **Kullanıcının kendi bankası katılım bankası mı?** (Terim kararını belirler.)

## Nakit avans ve kredi (ilk sürümde VAR, Anlatım 7; AKS-008, AKS-009 varsayımsal taslak, Anlatım 8)
- ✔ Kullanıcı: ilk sürümde gerekli, son zamanlarda çok sık kullanıyor. Kapsam kararı kesin.
- [ ] Nakit avans nasıl işliyor: kartla ATM'den mi çekiliyor, nakit cüzdana mı hesaba mı gidiyor? Komisyon çekimde mi, faiz günlük mü işliyor, ekstrede ayrı kalem mi?
- [ ] Nakit avans taksitlendiriliyor mu, yoksa tek ekstrede mi ödeniyor?
- [ ] Kredi türleri: ihtiyaç kredisi? KMH (ek hesap)? Kart borcunu yapılandırma? Hangileri kullanılıyor? (Anlatım 8 varsayımı: Türkiye Finans'ta ihtiyaç finansmanı = murabaha, sabit toplam geri ödeme, değişken faiz yok; KMH/değişken faiz bu üründe geçersiz olabilir. Doğrulanmadı.)
- [ ] Kredi kaydında iki tutar girilsin mi: "anlaşılan tutar" ve "hesaba yatan net tutar" (tahsis/sigorta düşülmüşse fark gider)? (Öneri: evet, ikincisi boşsa ilkine eşit.)
- [ ] Kredi borcu baştan toplam geri ödeme (anapara + kâr payı) mı yazılsın, yoksa yalnız ele geçen tutar mı? (Vade farkı kararıyla aynı aile; karar YOK, sonra.)
- [ ] Kredi taksitini öderken anapara/faiz/vergi bölümünü bankanın planından elle mi gireceksin, yoksa tek tutar mı (uygulama bölsün)? (Öneri: tek tutar girilsin, bölüm isteğe bağlı "daha fazla" altında.)
- [ ] Kredi için neyi görmek istiyorsun: kalan borç, taksit takvimi, toplam faiz maliyeti, hepsi?
- [ ] Erken kapama, gecikme, kısmi ödeme, kredi iptali (cayma), yapılandırma: hangileri yaşanıyor?

## Emanet para (kritik)
- ✔ Baba kullanıcı değil; kâr/zarar bilgisi alır · karışık portföy · giriş/çıkış sürekli · şimdi aracı kurum uygulamalarından elle hesaplanıyor
- ✔ Baba, Rehber'deki **bireysel kişi** olur (kişiler Rehber ile birleştiği için) (Anlatım 6 sonucu)
- [ ] Rapor babaya hangi kanalla ve biçimde gidiyor (mesaj, ekran görüntüsü, sözlü)?
- [ ] Hesaplama günlük mü, aylık mı; dönem başlangıç değeri nasıl alınıyor?
- [ ] Yatırımlar birden fazla aracı kurumda mı? Fiyatlar elle girilebilir mi?
- [ ] Kâr/zarar yalnız yatırım değer değişimi mi, kur farkı/komisyon dahil mi? Komisyon alıyor musun?
- [ ] Net varlık (mavi) emanet payını hariç mi tutmalı? İki görünüm gerekir mi?
