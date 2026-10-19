# Implement spec

`/implement-spec` kuralları: bir spec'in tüm GitHub ticket'ları, tek Conductor workspace'inde, tek integration branch üzerinde, paralel subagent'larla uygulanır. Sıralamayı skill tanımlar; bu rehber onun ihtiyaç duyduğu repository gerçeklerini sabitler. Her bölüm **Done when** satırıyla biter.

## Girdi

Kullanıcı spec yolunu (`docs/specs/<phase>/spec.md`) ve ticket numaralarını verir. Conductor bu modda seçili issue taşımaz; kapsam kullanıcının listesidir.

1. Her ticket'ı `gh issue view <number> --comments` ile oku. `docs/specs/<phase>/issues/` altındaki yerel taslaklar yalnız kaynaktır; kayıt, yayımlanmış issue'dur ([issue tracker](issue-tracker.md#read-or-update-an-issue)).
2. Her ticket'ın `ready-for-agent` etiketini taşıdığını doğrula ([triage labels](triage-labels.md)).
3. Native blocker'ları `gh api repos/UnderprotectionDev/sprite-anvil/issues/<number>/dependencies/blocked_by` ile oku. Native kenarı olmayan bir ticket'ın gövdesinde yine de `Blocked by: #<number>` yazabilir; ikisine de uy.
4. Bir blocker, integration branch'e merge edildiğinde veya GitHub'da kapalı olduğunda çözülmüş sayılır. GitHub'da issue'lar PR merge olana kadar açık kalır; bu yüzden bu çalışmanın ticket'ları için GitHub durumuna değil integration branch'e bak. **Frontier**, bu çalışmanın blocker'larının hepsi çözülmüş ve henüz başlatılmamış ticket'larıdır.
5. Spec'te daha önce teslim edilmiş iş varsa onu genişlet: mevcut kodu oku ve spec'in `Testing Decisions` seam'ini izle.
6. Başlamadan önce kural dosyalarını commit'le. Subagent worktree'leri `HEAD`'den açılır; commit'lenmemiş bir kural dosyası onlara ulaşmaz. Temiz workspace ile başla (`git status --short` boş).

**Done when** her ticket yorumlarıyla okunmuş, her birinin etiketi ve blocker listesi doğrulanmış, frontier adlandırılmış ve workspace temiz olup kurallar commit'lenmiş.

## Branch ve worktree

- Workspace'in mevcut branch'i integration branch'tir. Adını koru; onun için yeni branch açma.
- Her implementer kendi worktree'sinde, kendi branch'inde çalışır ve bitti demeden önce integration tip'i o branch'e merge eder.
- Integration branch workspace dizininde checkout edilmiştir; merge'ü merger orada yapar.
- Yeni worktree'ye `bun install --frozen-lockfile` uygulanır. Gitignore'daki `.env` dosyaları (`.env`, `apps/server/.env`, `packages/db/.env`, `apps/web/.env`) onda yoktur; implementer'lar bunlarsız çalışır, DB'ye bağlı çalıştırmaları workspace'e bırakır.
- Keşif notları workspace'in mutlak yolu altındaki `.context/` dizinine yazılır; böylece her worktree aynı dosyaları okur.
- Her implementer kendi ticket'ı için [AGENTS.md](../../AGENTS.md) sürecini izler (Orient'ten Close'a).

**Done when** bu çalışmanın açtığı her implementer worktree'si kaldırılmış ve integration branch adı değişmemiştir. Conductor workspace'i de bir worktree olduğundan `git worktree list` onu ve diğer workspace'leri göstermeye devam eder.

## Veritabanı

Tüm workspace'ler tek geliştirme veritabanını paylaşır ([shared development database operations](../development-database.md)). Subagent'lar ona hiç bağlanmaz. `db:generate` de applied history'yi ondan okur; bu yüzden workspace'e aittir.

- Bir subagent başlatmadan önce ticket'ın şemaya dokunup dokunmadığını ticket gövdesinden ve owning spec'ten belirle.
- Şemaya dokunan ticket'lar bağımlılık sırasıyla tek tek çalışır; sonraki şema ticket'ı, öncekinin migration'ı incelenip integration branch'e merge edilmeden başlamaz. Diğer tüm ticket'lar paralel çalışır.
- Şema ticket'ının implementer'ı yalnız şema kaynağını değiştirir. Ticket merge edildikten sonra workspace, integration branch'te `bun run db:generate` çalıştırır, migration SQL'ini ve snapshot'ı inceler ve owning ticket'ın işi olarak commit'ler. Subagent'lar hiçbir `db:*` komutu çalıştırmaz.
- Son ticket merge edildikten sonra workspace, [parallel migration workflow](issue-tracker.md#schema-migrations-across-parallel-issues)'u bir kez çalıştırır: `db:doctor`, integration branch'in draft PR ile yayımlanması, `db:prepare`, etkilenen testler, `db:ready`.
- `db:prepare` tam `HEAD`'in yayımlanmış olmasını ister; bu yüzden draft PR çalıştırmadan önce açılmış ve push edilmiş olmalıdır.

**Done when** `bun run db:ready` merge edilmiş integration branch'te geçer veya kesin engel close-out için kaydedilmiştir; hiçbir subagent ortak veritabanına bağlanmamıştır.

## Pull request

Draft PR ilk merge'den sonra workspace'ten açılır:

`gh pr create --base main --draft`

Conductor'ın `Create PR` eylemini kullanma: seçili issue olmadığında `Closes` satırlarını siler.

- Başlığı ve gövdeyi `pr` skill'iyle yaz.
- Gövde ticket başına bir bağımsız satır taşır: `Closes #<number>`.
- `gh pr view --json body,closingIssuesReferences` ile doğrula; her ticket numarası `closingIssuesReferences` içinde görünmeli.
- PR'ı yalnız close-out kontrolleri geçtikten sonra hazır işaretle (`gh pr ready`).

**Done when** `closingIssuesReferences` çalışmanın her ticket'ını listeler ve PR `main`'i hedefler.

## Close-out

[implement-close-out](implement-close-out.md)'u ticket başına değil, tüm spec için bir kez uygula.

- **Ne eklendi:** ticket başına bir alt başlık.
- **İnceleme:** tüm integration branch üzerinde tek `code-review`, `## Standards` ve `## Spec` ile. `code-review` tüm ticket'lar merge edildikten sonra bir kez çalışır; bulgular tek fix turunda düzeltilir, ardından yalnız düzeltilen bulgular kontrol edilir ve ikinci geniş review başlatılmaz.
- **Nasıl test edilir:** spec'in teslim edilen ekranları boyunca tek uçtan uca yolculuk; `Veri hazırlığı` kayıtları UI üzerinden oluşturulur.
- DB sonucunu (`db:ready`) ve çalıştırılmayan her kontrolü yaz.

**Done when** rapor üç bölümün hepsini içerir, her ticket **Ne eklendi** altında görünür ve yolculuk görünür davranışı olan her ticket'ı kapsar.
