---
owner: interaction-designer
status: active
---

# Transfer

Para bir hesaptan diğerine geçti. Gelir ya da gider değil, yalnız yer değiştirme. Terimler: [GLOSSARY](../GLOSSARY.md). Form mantığı: [gider](gider.md).

## Senaryolar
| Senaryo | Nereden | Nereye |
|---|---|---|
| Hesaplar arası transfer | Banka A | Banka B |
| ATM para çekme | Banka | Nakit |
| ATM para yatırma | Nakit | Banka |

Üç senaryo **aynı form**. ATM ayrı ekran değil; "Nakit" bir hesaptır.

## Form
| Alan | Zorunlu | Varsayılan |
|---|---|---|
| Tutar | evet | boş |
| Nereden | evet | son kullanılan |
| Nereye | evet | boş |
| Tarih | hayır | bugün |

- Rehber yok, bölme yok. Transfer tek tutar, iki hesap.
- Nereden ve Nereye aynı hesap olamaz.

## Kayıt
Örnek: ATM'den 1.000 TL çekildi.
| Hesap | Borç | Alacak |
|---|---|---|
| Nakit | 1.000 | |
| Banka | | 1.000 |

## Kurallar
- Her kayıt: 2 satır, Borç = Alacak.
- Nereye Borç, Nereden Alacak.
- Her iki hesap Varlık olabilir. Grup hesabı seçilemez.
- Hesapların para birimi farklıysa iki tutar sorulur: çıkan ve giren. Kur bunlardan çıkar.

## Henüz yok
Transfer/ATM masrafı, kredi kartı ödemesi, kartla nakit avans, düzenli transfer, etiket, not.
