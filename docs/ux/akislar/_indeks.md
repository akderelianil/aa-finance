---
owner: interaction-designer
status: active
---

# Akış İndeksi

Durum: 📥 yalnız gelen kutusunda · ✏️ akış yazıldı · ✅ uygulandı (2026-10-08 kodla karşılaştırıldı)

| Kod | Süreç | Giriş yolu | Sıklık (tahmin) | Durum |
|-----|-------|-----------|-----------------|-------|
| [AKS-001](AKS-001-kartla-alisveris.md) | Kartla alışveriş; taksit, paylaştır, kalemler seçenek | Gider | çok sık | ✅ (Düzelt'te hesap yok, iade yok) |
| AKS-002 / 003 | ATM çekme / yatırma | → [AKS-012](AKS-012-transfer.md) ile birleşti | - | birleşti |
| [AKS-004](AKS-004-hesap-bolusme.md) | Paylaştır (eşit / tutar / yüzde, 3+ kişi) | Gider → Daha fazla | orta | ✅ ("başkası ödedi" yok) |
| [AKS-005](AKS-005-borc.md) | Borç: Borç aldım / Borç verdim / Tahsil ettim / Borcumu ödedim | Borç | düşük-orta | ✅ (borcu bağışlama yok) |
| AKS-006 | ([AKS-005](AKS-005-borc.md) ile birleşti) | - | - | birleşti |
| [AKS-007](AKS-007-taksitli-alisveris.md) | Taksitli alışveriş (tek gider + kart borcu, takvim gösterim) | Gider → Daha fazla | orta | ✅ (vade farkı, iade, erken kapama yok) |
| [AKS-008](AKS-008-nakit-avans.md) | Nakit avans (masraf isteğe bağlı) | Transfer: kart → Nakit | son zamanlarda sık | ✅ giriş; banka davranışı varsayım |
| [AKS-009](AKS-009-kredi.md) | Banka kredisi (toplam geri ödeme borç) | Borç → Borç aldım → Bankadan kredi | son zamanlarda sık | ✅ (erken kapama yok) |
| [AKS-010](AKS-010-gunluk-faizli-hesap.md) | Günlük faiz (elle, net) | Gelir | günlük | ✅ (stopaj ayrı değil) |
| AKS-011 | Vadesiz hesap kullanımı | Gider / Gelir / Transfer | çok sık | 📥 (ayrı akış gerekmez) |
| [AKS-012](AKS-012-transfer.md) | Transfer: hesaplar arası, ATM, kart ödemesi | Transfer + kısayollar | orta | ✅ |
| AKS-013 | Döviz alım/satım | Transfer → Diğer → Döviz | düşük | 📥 eski ekran |
| AKS-014 | Yabancı hisse / kripto | Transfer → Diğer → Yatırım | düşük-orta | 📥 eski ekran |
| [AKS-015](AKS-015-emanet-yatirim.md) | Emanet parayla yatırım | — | sürekli | ✏️ v1 sonrası (karar) |
| [AKS-016](AKS-016-kime-odeme-yaptim.md) | "Kime ödedim?" ve Rehber | Her işlemde "Kime?" + Rehber sayfası | her gider | ✅ (birleştirme, firma raporu yok) |
| [AKS-017](AKS-017-hatirlatma.md) | Yaklaşanlar | Ana sayfa | her açılış | ✅ |
| [AKS-018](AKS-018-vadeli-hesap.md) | Vadeli hesap: açılış, vade sonu, yenileme, erken bozma | Transfer → Yeni vadeli; Yaklaşanlar | nadir | ✅ |
| [AKS-019](AKS-019-baslangic.md) | Başlangıç: bugünkü bakiye ve borçlar | `/baslangic` | üye başına bir kez | ✅ (süren taksit/kredi takvimi yok) |

Yatay konular (akış değil): Hızlı işlem düzeni, yön işaretleri, etiketler, Geri Al / Düzelt / İade → [harita](../harita.md) §3, §5, §6.
