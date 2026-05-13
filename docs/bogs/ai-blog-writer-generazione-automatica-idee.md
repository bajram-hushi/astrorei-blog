# AI Blog Writer: generazione automatica di idee per ReiLabs

ReiLabs ora può scrivere i propri post.

Abbiamo aggiunto un endpoint che genera automaticamente nuove idee di prodotto da vibecodare, le scrive in italiano, le valuta con l'angel investor interno, e le pubblica sul blog — tutto in una chiamata API.

## Il problema

Scrivere post regolari richiede tempo:

- pensare a un'idea concreta e originale
- contestualizzarla rispetto a ciò che esiste già
- scrivere in modo coerente con lo stile del blog
- collegare progetti correlati
- attivare notifiche e valutazioni

Anche con AI-assist in editor, il processo è manuale e frammentato. Volevamo automatizzare l'intero workflow: dall'idea alla pubblicazione.

## Cosa abbiamo costruito

Un sistema che:

1. **Legge il contesto esistente** — recupera gli ultimi post e progetti da Supabase per capire cosa è già stato discusso
2. **Genera l'idea** — usa OpenAI per proporre un nuovo progetto digitale vibecodabile (SaaS tool, CLI, extension, automation, niche app)
3. **Scrive il post** — produce un articolo completo in italiano, seguendo lo stile e la struttura dei post esistenti
4. **Collega progetti correlati** — se l'idea è legata a progetti esistenti, crea automaticamente i link
5. **Converte markdown → HTML** — trasforma il testo generato in richtext per rendering nativo
6. **Esegue la pipeline standard** — invia email di notifica e valutazione angel investor, come per un post manuale

## Come funziona

### Lato backend

Endpoint `POST /api/blog-writer` con doppia autenticazione:

- **Da browser** — sessione Supabase standard (pulsante "Genera con AI" nella home)
- **Programmatically** — secret condiviso via header `x-blog-writer-secret` (per cron jobs o webhook)

Il post viene sempre attribuito all'utente specificato in `BLOG_WRITER_BOT_USER_ID`, non a chi chiama l'API.

### Prompt engineering

L'agent riceve:

- Gli ultimi 8 post (titolo + anteprima contenuto)
- Gli ultimi 20 progetti (id, titolo, summary, stato)
- I documenti `astrorei-internal-plan.md` e `productization-plan.md`

Istruzioni chiare:

- Idea concreta e buildable in giorni/settimane da un solo dev
- Non ripetere ciò che esiste già
- Può ispirarsi a post/progetti esistenti, ma deve aggiungere valore
- Scrivere in italiano, tono diretto e pratico
- Ritornare JSON con `title`, `content` (markdown), `related_project_ids`

### Tech stack

- **OpenAI GPT-4.1-mini** per generazione
- **marked** per conversione markdown → HTML
- **Supabase Admin Client** per scrivere nel DB bypassando RLS
- Stesso flow email + angel investor dei post manuali

## Cosa cambia

### Per il team

- Meno friction per pubblicare contenuti regolari
- Source continua di spunti per nuovi progetti
- Documentazione automatica di idee che altrimenti resterebbero nei DM o nei meeting notes

### Per il prodotto

- ReiLabs diventa self-sustaining: il blog genera contenuti che alimentano discussioni e progetti
- Migliore copertura di nicchie e angoli non esplorati manualmente
- Signal su quali idee l'angel investor valuta bene (pattern riconoscibili nel tempo)

## Uso pratico

### Da browser

Clicca "Genera con AI" nella home → attendi 10-15 secondi → vieni reindirizzato al post appena creato.

### Da CLI o cron

```bash
curl -X POST https://reilabs.astrorei.io/api/blog-writer \
  -H "x-blog-writer-secret: $SECRET" | jq .
```

Ritorna `{ "id": "uuid", "title": "..." }` se va a buon fine.

## Prossimi passi

Questa è la v1 — funziona, ma può migliorare:

1. **Parametri opzionali** — specificare tema, lunghezza, o progetto da cui partire
2. **Scheduling** — cron job giornaliero o settimanale per pubblicazione automatica
3. **Review flow** — salvare come draft e richiedere approvazione prima di pubblicare
4. **Multi-lingua** — supporto per generare in inglese se necessario
5. **Fine-tuning** — addestrare un modello custom sul corpus ReiLabs per maggiore coerenza stilistica

## Note tecniche

Alcune scelte di design:

- **Admin client obbligatorio** — RLS policies impedirebbero l'insert senza session utente valida. Abbiamo aggiunto grant a `service_role` nello schema `blog`.
- **Markdown → richtext** — generare direttamente HTML da OpenAI sarebbe rischioso (injection, formatting inconsistente). Meglio generare markdown pulito e convertire server-side.
- **Linking intelligente** — l'agent ritorna array di UUID progetto. Validazione server-side contro progetti effettivi previene linking a ID inventati.

## Conclusione

AI Blog Writer è il primo caso in cui ReiLabs usa AI non come assistente, ma come contributor autonomo.

Non sostituisce la scrittura manuale — quella resta più ricca, personale e situata. Ma rimuove l'attrito per idee rapide, esperimenti, e flussi regolari di contenuti.

Risultato: più post, più discussioni, più progetti. ReiLabs diventa più vivo.
