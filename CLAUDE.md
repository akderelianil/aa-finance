# aa-finance

Aile odaklı kişisel finans uygulaması (çift taraflı muhasebe). Mimari kararlar: `docs/ARCHITECTURE.md`.

## Yığın
- Supabase (PostgreSQL + Auth + RLS + Storage), proje ref `ckwigjohcdsfqglmmzdq` (eu-central-1). Sadece geliştirme projesi.
- İş mantığı: TypeScript Supabase Edge Functions. Yazma işlemleri direkt Postgres bağlantısıyla tek transaction'da, ilgili hesap satırları `SELECT ... FOR UPDATE` ile kilitlenerek yapılır (ortalama maliyet yarış durumu).
- Frontend: React + Vite + TypeScript + shadcn/ui + Tailwind, mobil öncelikli PWA, Cloudflare'de yayınlanır.
- Paket yöneticisi: npm (pnpm.exe makinede Application Control ile engelli). Supabase CLI: `npx supabase`. Windows/PowerShell.

## Kurallar
- Her kayıt çift taraflı: ≥2 satır, toplam borç = toplam alacak (`base_amount`). DB trigger zaten zorlar; Edge Function da doğrular.
- Para: int64 minor unit (TS'te `bigint`/string; asla float). Kur/adet `numeric` → string.
- Uygulanmış migration dosyası ASLA düzenlenmez; yeni migration eklenir (`supabase/migrations`).
- Türetilebilen her değer (kur, TRY karşılığı, kâr/zarar, hesap açma) sunucuda otomatik hesaplanır; istekte opsiyoneldir, kullanıcı verirse o kullanılır.
- Yetki: grupta herkes görür; sadece `journal_entries.member_id` sahibi düzenler/siler (RLS + fonksiyon).
- Supabase MCP salt okunurdur; şema değişikliği migration + CLI ile yapılır. Secret/service_role anahtarı frontend'e ve repoya girmez.
- Arayüz: üşengeç, teknolojiye uzak kullanıcılar için; minimum alan, muhasebe terimi yok.
- Kapsam dışı: AI/otomatik doldurma, banka içe aktarma, kredi modülü, fatura/abonelik (sonra).
