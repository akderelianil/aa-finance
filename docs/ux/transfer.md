---
owner: interaction-designer
status: active
---

# Transfer

Para bir hesaptan diğerine geçti. Gelir ya da gider değil, yalnız yer değiştirme. İsteğe bağlı masraf gider olur. Terimler: [GLOSSARY](../GLOSSARY.md). Form mantığı: [gider](gider.md).

## Senaryolar
| Senaryo | Nereden | Nereye |
|---|---|---|
| Hesaplar arası transfer | Banka A | Banka B |
| ATM para çekme | Banka | Nakit |
| ATM para yatırma | Nakit | Banka |
| Kredi kartı ödemesi | Banka veya Nakit | Kart (Yabancı Kaynak) |

Dört senaryo **aynı form**. ATM ayrı ekran değil; "Nakit" bir hesaptır. Kart ödemesinde Nereye kart seçilir, kart borcu azalır.

## Form
| Alan | Zorunlu | Varsayılan |
|---|---|---|
| Tutar | evet | boş |
| Nereden | evet | son kullanılan |
| Nereye | evet | boş |
| Masraf | hayır | boş |
| Tarih | hayır | bugün |

- Rehber yok, bölme yok. Transfer tek tutar, iki hesap.
- Nereden ve Nereye aynı hesap olamaz.
- **Masraf** (ATM, havale/EFT ücreti) boş bırakılabilir. Yazılırsa Nereden hesabından ek düşer ve Gider olur.
- Masraf hesabı varsayılan "Banka Ücreti" gider hesabıdır. Kullanıcı değiştirebilir.

## Kayıt
Örnek 1: ATM'den 1.000 TL çekildi, 5 TL masraf.
| Hesap | Borç | Alacak |
|---|---|---|
| Nakit | 1.000 | |
| Banka Ücreti | 5 | |
| Banka | | 1.005 |

Örnek 2: Bankadan karta 2.000 TL ödeme, masraf yok.
| Hesap | Borç | Alacak |
|---|---|---|
| Kredi Kartı | 2.000 | |
| Banka | | 2.000 |

## Kurallar
- Her kayıt: ≥2 satır, Borç = Alacak.
- Nereye Borç, Nereden Alacak. Masraf varsa ek Borç satırı, Nereden Alacak tutarı masraf kadar artar.
- Nereden yalnız Varlık olabilir. Nereye Varlık veya kart (Yabancı Kaynak) olabilir. Grup hesabı seçilemez.
- Nereden kart seçilemez. Kartla nakit çekmek (nakit avans) bu akışta yok.
- Hesapların para birimi farklıysa iki tutar sorulur: çıkan ve giren. Kur bunlardan çıkar. Masraf Nereden hesabının para birimindedir.

## Henüz yok
Kartla nakit avans, düzenli transfer, etiket, not.
