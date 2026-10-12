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
Hızlı Kayıt tek ekrandır: Gider · Gelir · Transfer · Borç sekmeleri, Gider ilk açılandır. Serbest kayıt alt çubukta.
| Alan | Zorunlu | Varsayılan |
|---|---|---|
| Tutar (toplam) | evet | boş; altında seçili hesabın bakiyesi görünür |
| Hesap (ödeme) | evet | Cüzdan (Nakit grubundaki ilk hesap) |
| Gider hesabı | evet | boş; yazılan yeni ad Gider altında hesap olarak açılır |
| Tarih | hayır | bugün |
| Açıklama | hayır | boş |

- Hesap ve Gider hesabı alanlarının altında son 180 günde en çok kullanılan 4 hesap tek tıkla seçilir.
- Kaydet: Ctrl+Enter. Kaydet ve yeni: Ctrl+Shift+Enter (tür, tarih ve hesap kalır).
- Kaydetmeden önce tek satır özet görünür ("Cüzdan −500,00 → Market +500,00"); Yevmiye satırları bir tık altındadır.

## Bölme (çok kalemli)
- Önce toplam yazılır. **Birden fazla kaleme böl** ile satırlara bölünür.
- Her satırda Hesap, Gider hesabı ve Tutar vardır. Hesap üstteki Hesap ile gelir; satır için değiştirilebilir (aynı para birimi).
- Yeni satır, toplamdan **Kalan** tutarla açılır. Satırlar toplamı ≠ Tutar ise Kalan/Fazla görünür ve Kaydet hata verir.

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
