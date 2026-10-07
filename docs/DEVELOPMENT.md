# Geliştirme Notları

Hızlı başlangıç ve tekrar eden hataları önleyen pratik bilgiler. Mimari kararlar: `ARCHITECTURE.md`.

## Komutlar
| İş | Komut |
|---|---|
| Frontend dev | `cd web && npm run dev` |
| Derleme (tip kontrolü + build) | `cd web && npm run build` |
| Lint (oxlint) | `cd web && npm run lint` |
| Supabase CLI | `npx supabase ...` (pnpm engelli) |

Değişiklik sonrası asgari doğrulama: `npm run lint && npm run build` (şu an lint: 1 uyarı, build: temiz).

## Makine tuzakları (Windows)
- **pnpm yok:** Application Control engelliyor; npm kullan.
- **PowerShell 5.1 UTF-8'i bozar** (BOM, mojibake). Dosyaları Write/Edit araçlarıyla yaz; `Set-Content`/`Get-Content` ile Türkçe içerik dokunma.
- **`setx` ile verilen `SUPABASE_ACCESS_TOKEN` Claude oturumunda görünmez.** Oku: `[Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User')`. Token'ı dosyaya/repoya yazma.
- **Supabase MCP "Unauthorized" dönebilir** (`.mcp.json` token'ı görmüyor). Çözüm: token'ı User ortam değişkenine koyup Claude Code'u yeniden başlat; olmazsa CLI kullan. MCP zaten salt okunur; şema değişikliği her zaman migration + CLI.
- Dev DB şifresi bilerek değiştirilmedi (geliştirme aşaması); hiçbir dosyaya yazılmaz.

## Gizli bilgiler (.env)
- Kök `.env` (gitignore'da) token ve gizli anahtarları tutar; şablon `.env.example` commit edilir, değer içermez. Frontend değişkenleri ayrı: `web/.env.local` (yalnız `VITE_*`, gizli değil).
- Claude/CLI için `.env` otomatik yüklenmez; komuttan önce oku, **değeri asla ekrana basma/loglama**:
  - bash: `set -a; . ./.env; set +a; npx supabase ...`
  - PowerShell: `Get-Content .env | ? { $_ -match '^\s*[^#]\S*=' } | % { $k,$v = $_ -split '=',2; Set-Item "env:$($k.Trim())" $v.Trim() }`
- `SUPABASE_DB_URL` direct bağlantısı (`db.<ref>.supabase.co`) yalnız IPv6; bu makinede çalışmaz. CLI'ye gerek yok: `.env` yükleyip `npx supabase migration list --linked` / `db push --linked` yalnız `SUPABASE_ACCESS_TOKEN` ile çalışır (2026-10-07 doğrulandı). Doğrudan SQL gerekirse shared pooler URL'si kullan.
- Değer okumak yerine yalnız varlık kontrolü: `[ -n "$SUPABASE_ACCESS_TOKEN" ] && echo set`.
- `.mcp.json` `${SUPABASE_ACCESS_TOKEN}` ile süreç ortamından okur, `.env`'den değil; MCP için token User ortam değişkeninde de olmalı ve Claude Code yeniden başlatılmalı.
- `.env` içeriğini Read/cat ile görüntüleme; anahtar adı görmek için `sed -E 's/=.*/=<hidden>/' .env`.

## Çalışma kuralları (tekrarlanan hataları önlemek için)
1. Uygulanmış migration düzenlenmez; yeni dosya ekle (`supabase/migrations/YYYYMMDDHHMMSS_ad.sql`).
2. Şema değiştikten sonra Supabase advisor'larını (security + performance) çalıştır; eksik RLS'yi yakalar.
3. Para her yerde `bigint`/string; kur/adet `numeric` → string. Float yok.
4. Yeni Edge Function: `_shared/` (db, http, accounts, uuid) yardımcılarını kullan; yazma = tek transaction + ilgili hesap satırlarında `FOR UPDATE`.
5. Kütüphane sözdizimi emin değilse context7 ile güncel dokümana bak (react-router 8, tailwind 4, vite 8, i18next 26 gibi yeni sürümler eğitim verisinden farklı olabilir).
6. UI değişikliğini playwright MCP ile gerçekten aç ve ekran görüntüsü al; ekran görüntüleri `.playwright-mcp/` altında (gitignore'da).

## Bilinen borçlar
- `api/openapi.yaml` Go dönemi taslağı, güncel değil (bkz. ARCHITECTURE). Edge Function uçları oturunca üretilen tiplerle değiştir ya da sil.
- `web` JS paketi tek parça ~737 kB (gzip 225 kB); rota bazlı `import()` ile bölünebilir.
- Lint uyarısı: `src/components/ui/button.tsx:57` (shadcn dosyası, `only-export-components`), zararsız.
- Sıradaki iş: account-create + transaction-create Edge Function'ları, hızlı gider/gelir ekranı, kategoriler, PWA ikonları, CORS kısıtlaması, davet kodu rate limit, özel SMTP (yerleşik e-posta saatte 2).
