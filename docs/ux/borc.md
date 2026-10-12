---
owner: interaction-designer
status: active
---

# Borç

Kişilerarası borç: Borç Verme, Borç Alma, Tahsilat, Ödeme. Kredi bu akışta yok. Terimler: [GLOSSARY](../GLOSSARY.md). Form mantığı: [transfer](transfer.md).

## Senaryolar
| İşlem | Para hesabı | Borç hesabı | Etki |
|---|---|---|---|
| Borç Verme | Para çıkar | Kişilerden Alacaklar | Alacağım artar |
| Borç Alma | Para girer | Kişilere Borçlar | Borcum artar |
| Tahsilat | Para girer | Kişilerden Alacaklar | Alacağım azalır |
| Ödeme | Para çıkar | Kişilere Borçlar | Borcum azalır |

Dört işlem **aynı form**. Üstteki seçim yalnız yönü ve borç hesabını değiştirir. Tahsilat verilen borcun geri gelmesi, Ödeme alınan borcun geri verilmesidir.

## Form
| Alan | Zorunlu | Varsayılan |
|---|---|---|
| Kişi | evet | boş |
| Para hesabı | evet | boş |
| Tutar | evet | boş |
| Tarih | hayır | bugün |
| Açıklama | hayır | boş |

- Kişi zorunlu. Kişi, Kişilerden Alacaklar ya da Kişilere Borçlar altındaki bir alt hesaptır (karar 2026-10-12, yerel sürüm; Rehber v1'de yok). Yeni bir ad yazılırsa kayıtla birlikte doğru grubun altında hesabı açılır.
- Borç grubu sorulmaz; işlem türü seçer.
- Para hesabı yalnız Varlık olur (Nakit, Banka). Kart ve alacak hesabı seçilemez.
- Kişi seçilince formda açık bakiye görünür: alacak işlemlerinde "Açık alacağımız", borç işlemlerinde "Açık borcumuz" (kişi hesabının para biriminde).
- Kısmi tahsilat/ödeme serbesttir. Tahsilat/Ödeme tutarı açık bakiyeyi aşarsa uyarı çıkar; Kaydet kapanmaz.
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

Örnek 3: Ayşe 500 TL geri verdi (Tahsilat), Nakit girdi.
| Hesap | Borç | Alacak |
|---|---|---|
| Nakit | 500 | |
| Kişilerden Alacaklar (Ayşe) | | 500 |

Örnek 4: Ahmet'e 1.000 TL ödendi (Ödeme), Bankadan çıktı.
| Hesap | Borç | Alacak |
|---|---|---|
| Kişilere Borçlar (Ahmet) | 1.000 | |
| Banka | | 1.000 |

## Henüz yok
Vade, faiz, taksit planı, kredi (banka kredisi), borç silme / bağışlama.
