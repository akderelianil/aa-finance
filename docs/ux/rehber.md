---
owner: interaction-designer
status: active
---

# Rehber

Borç verilen ya da alınan Kişi, Marka ve Firmaların listesi. Kullanımı: [borc](borc.md).

## Sayfa
- Tablo: Ad, Tür (Kişi / Marka / Firma), Bağlı (bağlı Firma ya da Markalar), Alacağımız, Borcumuz, düzenle ve sil.
- Alacağımız ve Borcumuz: kaydın açık bakiyesi, para birimi başına bir satır; yoksa "–". Borç kayıtlarının satırlarından hesaplanır.
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
