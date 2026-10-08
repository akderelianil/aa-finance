---
owner: interaction-designer
status: active
---

# Kullanıcı Deneyimi & Bilgi Mimarisi

Amaç: gündelik para işlerinin **tümünü** toplamak, tek akışa damıtmak, uygulamaya uyarlamak. Sahibi: [interaction-designer](../../.claude/agents/interaction-designer.md). Terimler: [GLOSSARY](../GLOSSARY.md).

**Önce oku: [harita](harita.md).** Şu an geçerli olan her şey orada: ilkeler, ana döngü, süreç tablosu, istisna kalıpları, uygulamaya bakarak bulgular, açık sorular.

## Dosyalar
| Dosya | Rol | Güncellenir mi |
|---|---|---|
| [harita](harita.md) | **Tek doğru kaynak** | Her anlatımdan sonra |
| [gelen-kutusu](gelen-kutusu.md) | Ham anlatımlar ve ROADMAP karar özetleri, tarih sırası | Her anlatımda (ekleme) |
| [akislar/](akislar/_indeks.md) | Süreç başına akış ve istisnalar | Gerektiğinde |
| [acik-sorular](acik-sorular.md) | Tüm soruların ayrıntılı listesi | Gerektiğinde |
| [personalar/](personalar/README.md) | Kullanıcı tipleri | Henüz boş |
| [arsiv/](arsiv/analiz.md) | Karar tarihçesi (Anlatım 1-8) | **Dondu**. Ajanlar okumaz. |

## İşleyiş
```mermaid
flowchart LR
  A[Anlatım] --> G[gelen-kutusu] --> H[harita] --> K{Ayrıntı gerekli mi?}
  K -- evet --> S[akislar/AKS-NNN]
  K -- soru var --> Q[acik-sorular]
```
Olgunluk ve geliştirme sırası kararı ürün sahibindedir.

## Aşamalar
| # | Aşama | Durum |
|---|-------|-------|
| 1 | Toplama (anlatımlar) | Aktif |
| 2 | Damıtma ([harita](harita.md)) | Aktif |
| 3 | Uyarlama (ekran/navigasyon, mevcut uygulamayla fark) | Aktif: harita §6 bulgular, §8 uyumsuzluklar |
| 4 | Geliştirme sırası | Onaylandı: [ROADMAP](../ROADMAP.md) (durduruldu 2026-10-08; çekirdek yol haritası ROADMAP.md) |
