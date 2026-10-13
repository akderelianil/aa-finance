---
owner: product-designer
status: active
---

# Rehber

Borç verilen ya da alınan Kişi, Marka ve Firmaların listesi. Kullanımı: [borc](borc.md).

## Sayfa
- Tablo yok, kişi listesi: her satırda baş harf, Ad, altında "Tür · bağlı Firma/Markalar", sağda açık bakiye ("Alacağımız 1.200 TRY", "Borcumuz 300 TRY"; para birimi başına bir satır). Bakiye yoksa "Açık bakiye yok".
- Üstte özet: Toplam alacağımız ve Toplam borcumuz (para birimi başına). Hiç açık bakiye yoksa gösterilmez.
- Satıra tıklamak düzenleme formunu açar; sil ve düzenle satırın "⋯" menüsünde.
- Üstte tür sekmeleri (Tümü, Kişi, Marka, Firma) ve ada göre arama. Liste kısa olduğu için sayfalama yok.
- Tek ana eylem sağ üstte: **Yeni kayıt**.
- Boş Rehber: kısa açıklama ve **Yeni kayıt**.

## Kayıt formu
| Alan | Zorunlu | Not |
|---|---|---|
| Tür | evet | Kişi, Marka, Firma. Sonradan değişmez. |
| Ad | evet | Rehber'de tek. Aynı ad ikinci kez girilemez. |
| Bağlı Firmalar / Markalar | hayır | Yalnız Marka ve Firma. Marka birden çok Firmaya, Firma birden çok Markaya bağlanır. Kişi hiçbir şeye bağlanmaz. |
| Gelir hesabı, Gider hesabı | hayır | Bu kayıt için önerilen hesaplar (kayıt alan Gelir ve Gider hesapları). |

## Silme
- Kayıt silinince bağları da gider ve adı boşalır.
- Yevmiye satırı olan kayıt silinemez (`contact_has_lines`). Önce o kayıtlar silinir.

## Henüz yok
Gider ve Gelir satırlarına Rehber bağı, kişi bazlı ekstre.
