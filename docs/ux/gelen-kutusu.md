---
owner: interaction-designer
status: active
---

# Gelen Kutusu

Ham anlatımlar, tarih sırasıyla (yeniler en altta). Yorum/çözüm yok; akışa dönüşünce `→ AKS-NNN` ile bağlanır.

## 2026-10-07
- Çalışma başlatıldı.

## 2026-10-07 — Anlatım 1: Gündelik para senaryoları
> Kullanıcının sözleri, özetlenmiş.

**Genel:** İnsanlar çoğunlukla kredi kartıyla alışveriş yapıyor. En sık işlem: mağaza/siteden ürün/hizmet alımı. Birden fazla kredi kartı var. Bu en kolay süreç; banka verileri saklıyor, teyit ve veri girişi kolay. Her şey bu kadar kolay değil; aşağıdaki senaryolar:

1. ATM'den para çekme (cüzdana otomatik işlenmeli)
2. ATM'ye para yatırma (cüzdana otomatik işlenmeli)
3. Arkadaşlarla yemek; hesabın tamamını ben öderim, sonra bölüşürüz. Eşit (2 kişi, yarı yarıya) ya da eşit olmayan (647,50 TL benim, 185,78 TL arkadaşın; hepsi benim kartımla).
4. Arkadaştan anlık borç almak
5. Arkadaşa anlık borç vermek
6. Kredi kartıyla taksitli alışveriş
7. Nakit avans çekmek
8. Kredi kullanmak
9. Vadeli hesap kullanıp günlük faiz almak
10. Vadesiz hesap kullanımı
11. Hesaplar arası para transferi
12. Döviz alım/satım
13. Yabancı hisse, kripto alım/satım
14. **Emanet parayla yatırım** (babam yatırımdan anlamıyor; parasını emaneten alıp yatırım yapıyorum, günlük takip edip rapor sunuyorum). Para benim değil ama hesaplarımda görünür. **ÇOK SIKINTILI / ZOR KONU.**

**Ek bilgi (tasarım yönü):**
- **Hızlı Kayıt** uygulamanın kalbi: en az tıklama/bilgiyle tüm senaryolar. **Oyunlaştırılmış**, çok hızlı, animasyonlu; "oyun oynuyormuş" hissi.
- **Renk dili:** Gelir=yeşil, Gider=kırmızı, Net varlık=mavi, Borç=turuncu. Her ekranda/raporda sabit ve sistematik.

→ akış indeksi: [_indeks](akislar/_indeks.md)

## 2026-10-07 — Anlatım 2: Sorulara cevaplar
- **Emanet, baba:** Parayı veren uygulamayı **kullanmayacak**. Tek ihtiyacı günlük/aylık **ne kadar kâr/zarar** edildiği bilgisi.
- **Emanet, karışıklık:** Emanet para kendi yatırımlarımla **karışık** duruyor.
- **En sık işlemler (Hızlı Kayıt ilk ekranı):** Gelir, Gider, Transfer, Borç Alma, Borç Verme, ATM.

## 2026-10-07 — Anlatım 3: Sorulara cevaplar
- **Emanet para girişi/çıkışı:** Zaman içinde sürekli giriyor ve çıkıyor.
- **Babaya kâr/zarar şimdi nasıl hesaplanıyor:** İlgili aracı kurum uygulamalarından **manuel** hesaplıyorum. "Fon yönetimi gibi düşün."
- **Döviz/yatırım vb. nerede:** Hızlı Kayıt'ta **"Diğer"** bölümünde.

## 2026-10-07 — Anlatım 4: Kişiler/Kurumlar sayfası ve marka
- Yeni bir sayfa: **Kişiler/Kurumlar** (isimden emin değil). İçinde **Bireysel** ve **Kurumsal** kişiler.
- **Bireysel bilgiler:** İsim, Soyisim, Avatar/Fotoğraf, İletişim bilgileri, Banka hesapları (Banka adı, IBAN).
- **Kurumsal sorun:** Bir firmanın birden fazla **markası** olabiliyor. Ekstre ve fişte hep aynı **ticari unvan** görünüyor, ama ben "X markasından aldım" bilgisini görmek istiyorum. "**Kime ödeme yaptım?**" sorusunu **marka** bazında cevaplamak istiyorum; arka planda sistem hangi **kurumsal firmaya** ödeme gittiğini bilsin.
→ AKS-016

## 2026-10-07 — Anlatım 5: Rehber cevapları + ek kararlar
- Sayfa adı: **Rehber**.
- Firması bilinmeyen marka ilk başta **sadece marka** olarak kaydedilir.
- IBAN: hem **kopyalamak** (çoğunlukla) hem kayıtta eşleşme için.
- Bir marka **birden fazla firmaya** ait olabilir (franchise/bayi).
- Bir **kişi de marka** olabilir (esnaf, serbest meslek).
- Kurumsal için asıl bilgi **ticari unvan**; vergi no, iletişim "göz doldurmak için", ek bilgi.
- **Kategori marka üzerinden otomatik** gelsin.
- **Cüzdan tek bir nakit hesabı**; ATM çekme/yatırma onu **sormadan otomatik** etkilemeli.
- **Vadeli/faizli hesap, iki tür:**
  - *Günlük faizli:* her gün faiz otomatik hesaba yatar; vergi ve diğer kesintiler (stopaj vb.) görünür.
  - *30-90 gün vadeli:* sözleşme gibi; vade sonunda alınacak tutar baştan kesin. Oran belli olduğundan günlük faizi şimdi Excel'le hesaplıyorum.
- **Nakit avans ve kredi ilk sürümde gerekli**; son zamanlarda çok sık kullanıyorum.

## 2026-10-07 — Anlatım 6: Açık sorulara cevaplar (kararlar)
- Taksitli alışveriş, **Gider'in bir seçeneği** (→ AKS-007).
- Bölüşme, gider akışının içinde bir **"paylaştır" adımı** olsun (→ AKS-004).
- Bölüşmede **+3 kişi** veya **yüzdeli paylar** gerekebilir.
- **Hatırlatma isteniyor**: "kişi/kurum ödemedi" şeklinde (→ AKS-017).
- Borç tek renk olmak zorunda değil. **Şimdilik es geçilsin**, renklere çok takılmayalım; ileride düzenlenir.
- Marka çok firmaya bağlıysa kayıt esnasında kullanıcı **seçebilir**; seçmezse **belirsiz** kalsın. Sonra **düzenlenebilir** olsun (→ AKS-016).
- Aynı markanın **farklı kategorileri** olabilir. Kategori otomatik gelse bile kullanıcı **değiştirebilsin**.
- Mevcut **kişiler Rehber ile birleşecek**.
- ATM'den başka bankanın ATM'si komisyon keserse **masraf olarak işlenebilir**. **Ancak bu adım şimdilik es geçilsin, hiç dokunulmasın**; çünkü varsayılan kategoriler ve hesaplar henüz tam yapılmadı.
- **Günlük faiz kaydı elle girilecek.** **İşlem esas alınmalı**, tahmini kayıt girilmemeli. İleride belki tahmini hesaplama **gösterilebilir** (→ AKS-010).
- **Vadeli hesapta beklenen getiri** uygulamada gösterilsin. **Vade sonu hatırlatma bildirimi** de uygulanabilir (→ AKS-018).
- **Vade bitince vadesize döner.** Hangi vadesiz hesaba döneceğini **kullanıcı seçsin** (birden fazla vadesiz hesap ve farklı banka olabilir) (→ AKS-018).

## 2026-10-07 — Anlatım 7: Kararlar (ürün sahibi, ham)
1. Üşengeç kullanıcı şu an kriter değil: kullanıcılar her gün kayıt girmek zorunda (aksi halde muhasebenin anlamı yok); ileride entegrasyon gelecek. Önce her şey elle girilen sağlam bir sistem; sadeleştirme/üşengeçlik sonraki aşamada düşünülecek. Mutabakat (bakiye düzeltme) yalnız bütünlük kontrolü olarak kalsın, öncelik düşük, entegrasyon gelince önem kazanır.
2. Tüm kayıtlar gerçekleşen esaslı. Gerçekleşmemiş hiçbir işlem kayıt olmaz. Örnek: X mağazasından 10.000 TL ürün, 10 taksit, vade farksız → alışverişte 10.000 TL gider + 10.000 TL kredi kartı borcu oluşur. Banka her ay taksit tutarını ekstreye yansıtır ama bunlar yeni gider değil; kayıt değil, sadece gösterim/hatırlatma (ekstre taksit takvimi). Kart borcu azalması = gerçekleşen kart ödemesi. Plan = kayıt değil, gösterim/hatırlatma. AKS-007 buna göre yeniden yazılsın (iade, erken kapama, vade farklı taksit, ekstre kesim/son ödeme tarihi istisnaları dahil). Mevcut kodda installment-create/pay ve Taksitler sayfası var; ilkeyle uyumu "kontrol edilecek" notu olsun.
3. Vadeli hesap: otomatik yenileme, rollover ve erken bozma senaryoları AKS-018'e tam akış olarak eklensin (vade sonu: yenilendi / vadesize döndü / kısmi; rollover'da anapara+faiz mi sadece anapara mı yenilendi; yeni oran/vade; erken bozma: faiz kaybı/ceza, gerçek yatan tutar elle girilir; hedef hesap kapalı vb.).
4. Bildirim yalnız uygulama içi liste ("Yaklaşanlar"); native/telefon bildirimi YOK. AKS-017 ve AKS-018 buna göre düzeltilsin.
5. Bölüşmede yüzde/tutar seçenekleri gizli kalsın (varsayılan eşit; ayrıntı "daha fazla" altında). AKS-004 güncellensin.
6. Renk tek başına yetmez: gelir/gider/borç yönü için ikon + (+/−) işareti zorunlu. Hızlı Kayıt ilkelerine ve analize işlensin.
7. Nakit avans/kredi İLK SÜRÜMDE VAR (başta kapsam dışıydı, karar değişti). Nakit avans ve kredi için yeni AKS akışları eklensin; istisnalar (faiz/komisyon, taksitli geri ödeme, erken kapama, gecikme, kısmi ödeme, kredi iptali/yapılandırma) matrise işlensin. Henüz anlatılmadı: akışlar "taslak, ürün sahibi anlatımı bekleniyor"; açık sorular acik-sorular.md'ye yazılsın.
8. Eleştiri belgesindeki "Ürün sahibine sorulacaklar" güncellensin: cevaplananlar (bildirim, nakit avans/kredi kapsamı, vadeli yenileme/erken bozma) kararlara taşınsın, kalanlar kalsın.

## 2026-10-07 — Anlatım 8: Kararlar + Türkiye Finans araştırması (ürün sahibi, ham)
> Not: aşağıdaki metin, ürün sahibinin görevlendirmesidir (ham). Araştırma bölümü web aramasından geldi; çoğu doğrulanmadı.

KARARLAR:
1. Rehber katmanı (bireysel kişi / firma / marka) VE Rehber sayfası v1'de OLACAK. Önceki "tek kayıt öner" eleştirisi karşılanmadı ama karar ürün sahibinin; kararı işle, firma katmanını isteğe bağlı/gizli-varsayılanla sade sunma yollarını (kullanıcı marka yazar, firma arka planda) analizde not et.
2. İlk ekranda "Borç" TEK düğme (aldım/verdim ikinci dokunuş) → ilk ekran 5 seçenek: Gelir · Gider · Transfer · Borç · ATM. Hızlı Kayıt ilkelerini ve ilgili akışları (borç al/ver) güncelle.
3. Vade farkı muhasebesi: karar YOK, "sonra karar verilecek" olarak açık sorularda dursun.
4. "Geri Al" ilk sürümde VAR. Tüm akışlar için ortak ilke olarak analiz ve istisna matrisine işle; kapsamını (süre, hangi kayıtlar, iade/silme farkı) açık soru olarak yaz.
5. Nakit avans (AKS-008) ve kredi (AKS-009): ürün sahibi "varsayımsal ve Türkiye Finans Banka standartlarını araştırarak ilerle" dedi. Akışları bu araştırmaya göre güncelle, her varsayımı "varsayım" etiketiyle, kaynağıyla yaz.

ARAŞTIRMA (Türkiye Finans Katılım Bankası; web aramasından, çoğu doğrulanmadı):
- Katılım bankası: "faiz" yerine "kâr payı" kullanılır. Kullanıcı arayüzü için terim kararı gerekli (kullanıcının bankası katılım bankası ise "kâr payı", genel için "faiz/getiri"); açık soru olarak yaz.
- İhtiyaç finansmanı: banka ürünü peşin alıp vadeli satar (murabaha); fiyat farkı = kâr payı. Dolayısıyla toplam geri ödeme sözleşmede baştan sabit (değişken faiz modeli değil; KMH/değişken faiz varsayımı bu üründe geçersiz olabilir). Taksitler sabit, genelde aylık. Masraflar: tahsis ücreti, sigorta (hayat/ferdi kaza), KKDF ve BSMV vergileri; ödenen tahsis ücreti/sigorta kredi tutarından düşülebilir veya ayrı ödenebilir (kullanıcıya net ele geçen tutar ile toplam geri ödeme farkı oluşur). Örnek oran aralıkları (aylık ~%3,9–5,8, 12–36 ay) karşılaştırma sitelerinden, güvenilmez, kesin kabul edilmesin. Erken kapama masrafı/tazminatı bilgisi BULUNAMADI: ön bilgilendirme formu/sözleşmeden ürün sahibi teyit etmeli. Bulunan tek ilgili ifade: karz yöntemi formunda erken ödemede kâr payı erken ödeme tarihine göre hesaplanır (kâr payı indirimi).
- Kredi kartı nakit avansı: TCMB aylık azami akdi faiz tavanı uygulanır (haberlerde 2026 öncesi %4,42→%5'e çıkarıldığı yazıyor, güncel oran doğrulanmadı); Türkiye Finans'a özgü oran/komisyon bulunamadı → ürün sahibi kart sözleşmesi/ücret tarifesinden teyit etsin. Bankalar dönemsel faizsiz nakit avans kampanyası yapabiliyor. Nakit avans genellikle çekim anından itibaren günlük faiz işler (ekstre kesimi beklenmez) — bu genel bilgi, doğrulanmadı.
- Katılma hesabı (vadeli): hesap vadesinde yenilenmeyeceği yazılı bildirilmezse vade bitiminden itibaren AYNI SÜREYLE kendiliğinden uzar (otomatik yenileme varsayılan davranış!); yenilemede yenileme tarihindeki güncel kâra katılma oranı uygulanır (oran değişir; beklenen getiri yenilemede önceden bilinemez); banka vade sonunda oranları değiştirebilir. Vadeden önce çekim: genel sözleşmede çekim yapılınca hesabın TAMAMI için vade bozulmuş sayılır, kalan bakiye yeni bir katılma hesabına dönüşür (kısmi bozma = tamamen bozma + kalan yeniden açılış); kalan bakiye en düşük limitin altındaysa özel cari hesaba döner. Kur korumalı hesaplarda vadeden önce kısmi çekim yok, kapatma bankanın iznine bağlı, yenileme müşteri talebine bağlı. Erken bozmada kâr payı ödenir mi/ne kadar: BULUNAMADI, teyit gerekli. Önemli: bu AKS-018'deki "vade sonunda vadesize döner" varsayımını değiştiriyor: Türkiye Finans standardında varsayılan = otomatik yenileme; "vadesize dönüş" ancak kullanıcı yenilememe talimatı verdiyse olur. AKS-018'i buna göre düzelt (varsayılan sonuç yenileme; kullanıcı vade sonunda gerçekte ne olduğunu elle kaydeder, çünkü kayıt = gerçekleşen) ve hedef hesap sorusunu yenilememe senaryosuna bağla.
- Kaynaklar: Türkiye Finans Bankacılık İşlemleri Sözleşmesi Bireysel (madde 4.9, 5, 6) ve Kur Korumalı Katılma Hesabı ön bilgilendirme formları (turkiyefinans.com.tr sözleşmeler ve formlar sayfası, bazıları "arşivde"), hesapkurdu/teklifimgelsin/hesap.com karşılaştırma sayfaları, haber siteleri (TCMB nakit avans tavanı).

Ayrıca acik-sorular.md'ye "Ürün sahibinin teyit edeceği banka bilgileri" listesi ekle (nakit avans oranı/komisyonu, erken kapama koşulu, erken bozmada kâr payı, otomatik yenileme ayarı).

## 2026-10-08 — Kararlar ve uygulama (anlatım değil; [ROADMAP](../ROADMAP.md) ve commit kayıtlarından aktarıldı)
> Ürün sahibinin 2026-10-07/08 kararları ROADMAP'te. Burada yalnız özet ve bağlantı var.

KARARLAR (ROADMAP "Decisions"):
- harita §7'deki bütün öneriler kabul: emanet yatırım v1 sonrası; kart ödemesi = Transfer → kart; kesim/son ödeme günü kart başına bir kez; Geri Al = son kayıt hemen, sonra Düzelt/Sil, çok satırlı kayıt tek adımda; terimler "getiri" / "maliyet".
- acik-sorular'daki bütün "(Öneri: …)" maddeleri karar sayıldı.
- harita §6 kabul ("Diğer" yalnız döviz, yatırım, emanet).
- Kredi: kredi günü toplam geri ödeme borç olur; toplam − anlaşılan = maliyet gideri; anlaşılan − yatan = masraf gideri; her taksit kredi hesabına transfer; erken kapama indirimi = Fark.
- Vadeli: kullanıcı anapara + oran + gün girer; beklenen net getiri türetilir (stopaj oranı hesapta). Vadede gerçek tutar girilir; fark gelir ya da gider.
- Hesap şablonu: 2 seviyeli kategori ağacı; "Sadece grup" kategori elle ayarlanır; her üyeye "Nakit"; başlangıç sihirbazı banka, kart, kredi sorar; üyeler arası harçlık = verende gider, alanda gelir (iki kayıt); "Kupon & Hediye Çeki" gelir; marka → kategori varsayılanları şablonda.

UYGULANANLAR (sırayla):
1. Hızlı Kayıt v2: 5 düğme + ATM otomatik cüzdan + Geri Al bildirimi + yön işaretleri.
2. Gider seçenekleri: taksit, paylaştır (eşit, 3+ kişi, artan kuruş bende), not; kendi kaydını silme.
3. Rehber: kişi / marka / firma, IBAN, marka varsayılan kategori.
4. Plan ve Yaklaşanlar: kart son ödeme, borç vadesi, önceden doldurulmuş ödeme, taksit takvimi gösterim.
5. Nakit avans (isteğe bağlı komisyon); banka kredisi.
6. Vadeli hesap: Transfer'den açılış, vade sonu, erken bozma; Geri Al önceki dönemi geri getirir.
7. Defter bütünlüğü: "Sadece grup" kategoriler, çok kategorili fiş (kalemler).
8. Hesap şablonu ve `/baslangic` sihirbazı.
9. Hızlı Kayıt v3: dört tür (Gider · Gelir · Transfer · Borç); tutar en üstte; çip satırı (hesap · tarih · Daha fazla); seyrek seçenekler "Daha fazla" altında; Kaydet sabit. ATM, kart ödemesi, nakit avans Transfer kısayolu oldu. Etiketler (#etiket, filtre, toplam).
