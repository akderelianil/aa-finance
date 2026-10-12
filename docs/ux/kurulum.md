---
owner: interaction-designer
status: active
---

# Kurulum

Uygulama ilk kez açıldı, defter dosyası yok. Amaç: birkaç adımda kullanılabilir bir defter. Terimler: [GLOSSARY](../GLOSSARY.md).

## Temel kurallar
| Konu | Kural |
|---|---|
| Defter | Bir defter dosyası = bir aile/topluluk. İçinde birden çok Üye olur. |
| İlk kişi | Kurulumu yapan kişi Yönetici olur. |
| Oturum | Hesap, şifre, sunucu yok. Uygulama yereldir. |
| Güvenlik | PIN ve biyometri yok. Güvenliği işletim sistemi sağlar (kullanıcı hesabı, disk şifreleme). |
| Kaydetme | Adımlarda hiçbir şey kaydedilmez. Son adımda hepsi tek seferde kaydedilir. |
| Yevmiye | Kurulum Yevmiye kaydı oluşturmaz. |

## Açılış: kullanıcı seçimi
- Her oturumda ilk ekran. Defter kuruluysa Üyeler listelenir (avatar, ad, rol). Son kullanılan Üye işaretli ve odaklı gelir. Birine basmak o Üye olarak çalışmaktır (PIN yok).
- Defterde kimse yoksa (kurulum yapılmamış): "Kayıt ol" düğmesi. Basınca Kurulum başlar.
- Kurulumda sol üstte ok düğmesi ("Kullanıcı seçimine dön") kullanıcı seçimine döner. 1. adımda Esc veya Alt+← aynı işi yapar. Kaydedilmiş bir şey olmadığı için veri kaybı yok.
- Kurulum bitince seçim ekranı atlanır: kurulumu yapan kişi olarak açılır.

## Adımlar
| # | Adım | Alanlar | Zorunlu | Varsayılan |
|---|---|---|---|---|
| 1 | Ülke | Ülke (aranabilir liste) | evet | işletim sisteminin bölgesi |
| 2 | Dil ve Ana para birimi | Dil, Ana para birimi | evet | 1. adımdan gelir |
| 3 | Sen | Ad, profil rengi | Ad: evet | renk: otomatik |
| 4 | Aile/Topluluk | Aile/topluluk adı, Üye adları | ad: evet; Üye: hayır | "<Soyad> Ailesi" |
| 5 | Hesap Planı | Temel veya Önerilen kartı | evet | Önerilen |
| 6 | Özet | yok | - | - |

### 1. Ülke
- Ülke seçimi şunları doldurur: dil, Ana para birimi, tarih ve sayı biçimi.
- Türkiye ve KKTC → Türkçe. Diğer ülkeler → English.
- Liste arama ile süzülür. İşletim sisteminin bölgesi seçili gelir.

### 2. Dil ve Ana para birimi
- İki alan 1. adımdan dolu gelir. Kullanıcı onaylar veya değiştirir.
- Uyarı (alanın altında, sabit): "Ana para birimi sonra değişmez."
- Dil, Önerilen hesapların adlarını da belirler (5. adım). Dil sonra değişirse hesap adları değişmez.

### 3. Sen
- Ad yazılır. Profil rengi otomatik seçilir, değiştirilebilir.
- Adın yanında **Yönetici** rozeti görünür (değiştirilemez).

### 4. Aile/Topluluk
- Aile/topluluk adı önerilir: adın son kelimesi + "Ailesi" (örnek: Akdereli Ailesi). English: "<Soyad> Family". Kullanıcı değiştirebilir.
- Soru: "Üye eklemek ister misin?" Atlanabilir.
- Her Üye için yalnız ad yazılır. Renk otomatik verilir.
- Üye adı yazılıp Enter'a basılınca altta yeni boş satır açılır.

### 5. Hesap Planı
| Kart | İçerik |
|---|---|
| Temel | Kilitli çekirdek hesaplar + Cüzdan. |
| Önerilen | Kilitli çekirdek hesaplar + Cüzdan + hazır gelir ve gider hesapları. |

- Kartta 3–5 örnek hesap adı görünür. Kullanıcı neyi seçtiğini görür.
- Sonra yeni şablonlar yeni kart olarak eklenir.

### 6. Özet
- Seçimler liste olarak görünür: ülke, dil, Ana para birimi, ad, aile/topluluk adı, Üyeler, Hesap Planı.
- Buton: **Kur**. Enter de kurar.
- Kayıt bitince kısa "Tamamlandı" anı görünür (≈1 sn). Sonra Hesaplar ekranı açılır.
- Hesaplar ekranında yapılacaklar listesi yok.

## Görünüm
| Öğe | Kural |
|---|---|
| Adım çubuğu | Üstte. Biten adımlar işaretli. Biten adıma tıklanınca o adım açılır. |
| Görsel | Her adımda bir ikon veya çizim. |
| Geçiş | Adımlar arası 150–200 ms. |
| Bekleme | Seçimden sonra bekleme yok. Sonraki adım hemen açılır. |
| Oyunlaştırma | Hafif: adım çubuğu ve "Tamamlandı" anı. Puan ve rozet yok. |

## Klavye
Kurulum yalnız klavye ile tamamlanabilir. Her adımda odak ilk alana gider.

| Tuş | Etki (her adımda) |
|---|---|
| Enter | Sonraki adım (alan geçerliyse). |
| Esc veya Alt+← | Önceki adım. 1. adımda etkisi yok. |
| Tab / Shift+Tab | Sonraki / önceki alan. Adım değiştirmez. |

| Adım | İlk odak | Ek tuşlar |
|---|---|---|
| 1. Ülke | Arama kutusu | Yazınca liste süzülür. ↑↓ ülke seçer. Enter seçer ve ilerler. Esc arama doluysa önce aramayı temizler. |
| 2. Dil ve Ana para birimi | Dil | ↑↓ açık listede seçer. Enter ilerler. |
| 3. Sen | Ad | Renklerde ←→ seçer. |
| 4. Aile/Topluluk | Aile/topluluk adı | Dolu Üye satırında Enter yeni satır açar. Boş Üye satırında Enter ilerler. |
| 5. Hesap Planı | Seçili kart | ←→ veya 1–9 kart seçer. Enter ilerler. |
| 6. Özet | Kur butonu | Enter kurar. Esc geri döner. |

## Uç durumlar
| Durum | Davranış |
|---|---|
| Geri dönme | Girilen tüm değerler kalır. |
| Ülke değişti (geri dönüp) | Dil ve Ana para birimi yeni ülkeye göre dolar. Kullanıcının elle değiştirdiği değer kalır. |
| Ad boş | Enter ilerlemez. Alan altında: "Ad gerekli." |
| Aile/topluluk adı boş | Enter ilerlemez. Alan altında: "Ad gerekli." |
| Üye satırı boş | Yok sayılır. Hata yok. |
| Üye adı tekrar (Sen dahil) | Satır altında: "Bu ad zaten var." Enter ilerlemez. Büyük/küçük harf ve baştaki/sondaki boşluk fark etmez. |
| Ad tek kelime | Öneri: "<Ad> Ailesi". |
| Uygulama kurulum ortasında kapandı | Hiçbir şey kaydedilmez. Sonraki açılışta kurulum 1. adımdan başlar. |
| Kurulum kaydı başarısız | Özet adımı kalır. Mesaj: "Kurulum tamamlanamadı. Hiçbir şey kaydedilmedi." Buton: **Tekrar dene**. Değerler kalır. |

## Kurulumda olmayanlar
| Konu | Yeri |
|---|---|
| Açılış Bakiyeleri | Kurulumdan sonra, ayrı akış. |
| Yedekten geri yükleme | Ayarlar. |
| PIN, biyometri | Yok (bkz. Temel kurallar). |

## Kurulumdan sonra

### Roller
| Yetki | Yönetici | Üye |
|---|---|---|
| Tüm kayıtları okuma | evet | evet |
| Kendi kaydını düzenleme, silme | evet | evet |
| Başkasının kaydını düzenleme, silme | evet | hayır |
| Kendi adını ve rengini değiştirme | evet | evet |
| Üye ekleme | evet | hayır |
| Başkasının adını değiştirme | evet | hayır |
| Rol değiştirme | evet | hayır |

- En az bir Yönetici her zaman kalır. Son Yönetici Üye yapılamaz.

### Üye değiştirme
- Uygulama her açılışta son kullanılan Üye ile açılır. Bu bilgi cihazda tutulur.
- Kayıtlı Üye bulunamazsa uygulama Yönetici ile açılır.
- Üye, kenar çubuğundaki Üye menüsünden değiştirilir.

### Ayarlar
| Kart | İçerik | Kim |
|---|---|---|
| Üyeler | Kendi adını ve rengini değiştir | herkes |
| Üyeler | Üye ekle, başkasının adını değiştir, rol değiştir | Yönetici |
| Aile/Topluluk | Aile/topluluk adını değiştir | Yönetici |

## Henüz yok (sonra, gerekirse)
Üye silme, defter dosyasının yerini seçme, birden çok defter, kullanıcı profiline göre şablon önerisi.
