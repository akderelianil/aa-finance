---
owner: product-designer
status: active
---

# Kurulum

Uygulama ilk kez açıldı, defter dosyası yok. Amaç: birkaç adımda kullanılabilir bir defter.

## Temel kurallar
| Konu | Kural |
|---|---|
| Defter | Bir defter dosyası = bir aile/topluluk. İçinde birden çok Üye olur. |
| İlk kişi | Kurulumu yapan kişi Yönetici olur. |
| Oturum | Hesap, sunucu yok. Uygulama yereldir. Her Üyenin 6 haneli PIN'i var ([pin](pin.md)). |
| Güvenlik | PIN bir uygulama kapısıdır; defter dosyası şifreli değildir. Biyometri yok. |
| Kaydetme | Adımlarda hiçbir şey kaydedilmez. Son adımda hepsi tek seferde kaydedilir. |
| Yevmiye | Kurulum Yevmiye kaydı oluşturmaz. |

## Açılış: kullanıcı seçimi
- Her açılışta ilk ekran. Defter kuruluysa Üyeler listelenir (avatar, ad, rol). Son kullanılan Üye işaretli ve odaklı gelir. Üye seçilince PIN ekranı açılır; doğru PIN ile çalışılır. Ayrıntı: [pin](pin.md).
- Üye değiştir: kenar çubuğundaki Üye menüsünde. Kilitler ve bu ekrana döner; veri silinmez.
- Defterde kimse yoksa (kurulum yapılmamış): "Kayıt ol" düğmesi. Basınca Kurulum başlar.
- Kurulumda sol üstte ok düğmesi ("Kullanıcı seçimine dön") kullanıcı seçimine döner. 1. adımda Esc veya Alt+← aynı işi yapar. Kaydedilmiş bir şey olmadığı için veri kaybı yok.
- Kurulum bitince seçim ve PIN ekranı atlanır: kurulumu yapan kişi olarak açılır (PIN'ini 3. adımda belirledi).

## Adımlar
| # | Adım | Alanlar | Zorunlu | Varsayılan |
|---|---|---|---|---|
| 1 | Ülke | Ülke (aranabilir liste) | evet | işletim sisteminin bölgesi |
| 2 | Dil ve Ana para birimi | Dil, Ana para birimi | evet | 1. adımdan gelir |
| 3 | Sen | Ad, profil rengi, PIN, PIN tekrar | Ad, PIN: evet | renk: otomatik |
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
- PIN: 6 rakam, ardından "PIN tekrar". Altında tek satır: "PIN bir uygulama kapısıdır; defter dosyası şifreli değildir."
- PIN, Kur'a kadar yalnız bellekte durur; geri dönünce alanlar dolu kalır.

### 4. Aile/Topluluk
- Aile/topluluk adı önerilir: adın son kelimesi + "Ailesi" (örnek: Akdereli Ailesi). English: "<Soyad> Family". Kullanıcı değiştirebilir.
- Soru: "Üye eklemek ister misin?" Atlanabilir.
- Her Üye için yalnız ad yazılır. Renk otomatik verilir.
- Üye adı yazılıp Enter'a basılınca altta yeni boş satır açılır.
- Üyeler PIN'i burada vermez; ilk girişte kendileri belirler.

### 5. Hesap Planı
| Kart | İçerik |
|---|---|
| Temel | Kilitli çekirdek hesaplar + Cüzdan. |
| Önerilen | Kilitli çekirdek hesaplar + Cüzdan + hazır gelir ve gider hesapları. |

- Kartta 3–5 örnek hesap adı görünür. Kullanıcı neyi seçtiğini görür.
- Sonra yeni şablonlar yeni kart olarak eklenir.

### 6. Özet
- Seçimler liste olarak görünür: ülke, dil, Ana para birimi, ad, PIN ("belirlendi", rakamlar gösterilmez), aile/topluluk adı, Üyeler, Hesap Planı.
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
| 3. Sen | Ad | Renklerde ←→ seçer. Adda Enter PIN'e geçer. PIN'in 6. rakamı odağı PIN tekrar'a taşır, adım değiştirmez. PIN tekrar dolu ve eşitse Enter ilerler. |
| 4. Aile/Topluluk | Aile/topluluk adı | Dolu Üye satırında Enter yeni satır açar. Boş Üye satırında Enter ilerler. |
| 5. Hesap Planı | Seçili kart | ←→ veya 1–9 kart seçer. Enter ilerler. |
| 6. Özet | Kur butonu | Enter kurar. Esc geri döner. |

## Uç durumlar
| Durum | Davranış |
|---|---|
| Geri dönme | Girilen tüm değerler kalır. |
| Ülke değişti (geri dönüp) | Dil ve Ana para birimi yeni ülkeye göre dolar. Kullanıcının elle değiştirdiği değer kalır. |
| Ad boş | Enter ilerlemez. Alan altında: "Ad gerekli." |
| PIN eksik (6 rakamdan az) | Enter ilerlemez. Alan altında: "PIN 6 rakam olmalı." |
| PIN tekrar farklı | Enter ilerlemez. Alan altında: "PIN'ler aynı değil." Tekrar alanı boşalır. |
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
| Biyometri | Yok. |
| PIN değiştirme, sıfırlama, unutma | [pin](pin.md). |

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
| Kendi PIN'ini değiştirme | evet | evet |
| Başkasının PIN'ini sıfırlama | evet | hayır |

- En az bir Yönetici her zaman kalır. Son Yönetici Üye yapılamaz.

### Üye değiştirme
- Uygulama her açılışta Üye seçimiyle başlar; son kullanılan Üye yalnız önceden seçili gelir (cihazda tutulur). PIN'siz giriş yoktur.
- Kayıtlı Üye bulunamazsa listedeki ilk Üye (Yönetici) seçili gelir.
- Üye, kenar çubuğundaki Üye menüsünden (**Üye değiştir**) değiştirilir: kilitler, PIN yeniden sorulur. Ayrıntı: [pin](pin.md).

### Ayarlar
| Kart | İçerik | Kim |
|---|---|---|
| Üyeler | Kendi adını ve rengini değiştir, kendi PIN'ini değiştir | herkes |
| Üyeler | Üye ekle, başkasının adını değiştir, rol değiştir, başkasının PIN'ini sıfırla (onaylı) | Yönetici |
| Aile/Topluluk | Aile/topluluk adını değiştir | Yönetici |

## Henüz yok (sonra, gerekirse)
Üye silme, defter dosyasının yerini seçme, birden çok defter, kullanıcı profiline göre şablon önerisi.
