---
owner: interaction-designer
status: active
---

# Borç (alma / verme)

Kullanıcı bir kişiden borç aldı ya da bir kişiye borç verdi. Kredi bu akışta yok. Terimler: [GLOSSARY](../GLOSSARY.md). Form mantığı: [transfer](transfer.md).

## Senaryolar
| Senaryo | Para hesabı | Borç hesabı | Etki |
|---|---|---|---|
| Borç aldım | Para girer (Varlık) | Kişilere Borçlar (Yabancı Kaynak) | Borcum artar |
| Borç verdim | Para çıkar (Varlık) | Kişilerden Alacaklar (Varlık) | Alacağım artar |

İki senaryo **aynı form**. Üstteki seçim (Borç aldım / Borç verdim) yalnız yönü değiştirir.

## Form
| Alan | Zorunlu | Varsayılan |
|---|---|---|
| Kişi (Rehber) | evet | boş |
| Para hesabı | evet | boş |
| Tutar | evet | boş |
| Tarih | hayır | bugün |
| Açıklama | hayır | boş |

- Kişi zorunlu: kime borçlu olduğumuz ya da kimin bize borçlu olduğu Rehber bakiyesinden izlenir.
- Borç hesabı sorulmaz. Tek hesaptır (Kişilere Borçlar ya da Kişilerden Alacaklar), sistem seçer.
- Para hesabı yalnız Varlık olur (Nakit, Banka). Kart ve alacak hesabı seçilemez.
- Para hesabı ile borç hesabının para birimi farklıysa ikinci tutar sorulur. Boşsa gün kuruyla önerilir.

## Kayıt
Örnek 1: Ahmet'ten 5.000 TL borç alındı, Bankaya girdi.
| Hesap | Borç | Alacak |
|---|---|---|
| Banka | 5.000 | |
| Kişilere Borçlar (Ahmet) | | 5.000 |

Örnek 2: Ayşe'ye 2.000 TL borç verildi, Nakit çıktı.
| Hesap | Borç | Alacak |
|---|---|---|
| Kişilerden Alacaklar (Ayşe) | 2.000 | |
| Nakit | | 2.000 |

## Geri ödeme / tahsilat
Ayrı ekran yok: [Transfer](transfer.md) kullanılır (Nereden Banka, Nereye Kişilere Borçlar; tahsilatta tersi). Kişi seçilir, böylece Rehber bakiyesi düşer.

## Henüz yok
Vade, faiz, taksitli geri ödeme, kredi (banka kredisi), borç silme / bağışlama.
