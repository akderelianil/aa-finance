---
owner: product-designer
status: active
---

# Gelir

Kullanıcıya para yattı. Amaç: en az girişle doğru Yevmiye kaydı. Gider ile aynı form, ters yön. Form ve bölme mantığı: [gider](gider.md).

## Kapsam
- Yalnız **tahsil edilmiş** gelir. Para hesaba yattı veya nakit alındı.
- Maaş **net** tutarla girilir. Brüt ve kesinti ayrımı sonra.
- Henüz tahsil edilmemiş gelecek ödeme gelir değildir. Varlık (alacak) veya Borç akışıdır, bu akışta yok.

## Senaryolar
| Senaryo | Alınan hesap | Kayıt etkisi |
|---|---|---|
| Maaş, serbest iş, faiz, satış, hediye (banka) | Banka hesabı (Varlık) | Varlık artar |
| Nakit alınan gelir | Nakit (Varlık) | Varlık artar |

Tek form. Tek fark: gelir hesabı seçilir, para varlık hesabına girer.

## Form
| Alan | Zorunlu | Varsayılan |
|---|---|---|
| Tutar (toplam) | evet | boş |
| Hesap (alınan) | evet | Cüzdan (Nakit grubundaki ilk hesap) |
| Gelir hesabı | evet | boş (tek satır, tutarın tamamı) |
| Açıklama | hayır | boş |
| Tarih | hayır | bugün |

## Bölme
- Önce toplam yazılır. **Satır ekle** ile gelir satırlarına bölünür.
- Kalan tutar ilk satıra düşer.
- Satırlar toplamı ≠ Tutar ise **Fark** görünür, Kaydet kapalıdır.

Örnek: Maaş 100 TL, o ay hesaba 150 TL yattı (50 TL prim).
| Hesap | Borç | Alacak |
|---|---|---|
| Banka | 150 | |
| Maaş | | 100 |
| Prim | | 50 |

## Kurallar
- Her kayıt: ≥2 satır, toplam Borç = toplam Alacak.
- Alınan hesap Borç, gelir satırları Alacak.
- Gelir hesabı Grup hesabı olamaz.
- Alınan hesabın para birimi ana para biriminden farklıysa Kur sorulur; boşsa sunucu getirir.
- Alınan hesap yalnız Varlık hesabı olabilir. Kredi kartı seçilemez (gelir değil, iade/ödeme olur).

## Henüz yok
Brüt/net kesintisi, alacak (tahsil edilmemiş gelir), düzenli tekrar, iade, döviz ayrıntısı, etiket, not.
