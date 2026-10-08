---
owner: interaction-designer
status: active
---

# Gider

Kullanıcı bir harcama yaptı. Amaç: en az girişle doğru Yevmiye kaydı. Terimler: [GLOSSARY](../GLOSSARY.md).

## Senaryolar
| Senaryo | Ödeme hesabı | Kayıt etkisi |
|---|---|---|
| Nakit (peşin) | Nakit (Varlık) | Varlık azalır |
| Banka kartı (peşin) | Banka hesabı (Varlık) | Varlık azalır |
| Kredi kartı (vadeli) | Kart (Yabancı Kaynak) | Kart borcu artar |

Üç senaryo **aynı form**. Fark yalnız seçilen hesabın türüdür. Ayrı mod, ayrı ekran yok.

## Form
| Alan | Zorunlu | Varsayılan |
|---|---|---|
| Tutar (toplam) | evet | boş |
| Ödeme hesabı | evet | son kullanılan |
| Gider hesabı | evet | boş (tek satır, tutarın tamamı) |
| Rehber | hayır | boş |
| Tarih | hayır | bugün |

- Rehber boş kalabilir. Seyyar satıcı, büfe gibi anonim alışveriş için Rehber seçmek gerekmez.
- Tek kalemli harcama: Tutar + Ödeme hesabı + Gider hesabı + Kaydet.

## Bölme (çok kalemli)
- Önce toplam yazılır. **Satır ekle** ile gider satırlarına bölünür.
- Kalan tutar ilk satıra düşer. Satır eklenince ilk satır küçülür.
- Satırlar toplamı ≠ Tutar ise **Fark** görünür, Kaydet kapalıdır.

Örnek: Migros, 500 TL, Kredi Kartı.
| Hesap | Borç | Alacak |
|---|---|---|
| Market | 300 | |
| Sigara | 100 | |
| Alkol | 100 | |
| Kredi Kartı | | 500 |

## Kurallar
- Her kayıt: ≥2 satır, toplam Borç = toplam Alacak ([CLAUDE.md](../../CLAUDE.md)).
- Gider satırı Borç, ödeme hesabı Alacak.
- Gider hesabı Grup hesabı olamaz (Grup hesabı satır almaz).
- Ödeme hesabının para birimi ana para biriminden farklıysa Kur sorulur; boşsa sunucu getirir.

## Henüz yok (sonra, gerekirse)
İade, taksit, paylaştırma, döviz ayrıntısı, etiket, not.
