# Notificări pentru proiecte și articole

Formularul este pregătit pentru confirmare prin e-mail, dezabonare și notificări automate. Implicit, înscrierile și trimiterile sunt oprite. Nu sunt necesare articole terminate pentru configurarea serviciului.

## Componente

Site-ul Astro primește formularul la `/api/newsletter` și transmite solicitările autentificate către Worker-ul separat `techcub-newsletter`. Folosim HTTP autentificat pentru a păstra compatibilitatea site-ului cu toate cele trei adaptoare existente. Tokenul serviciului rămâne pe server.

Cloudflare D1 păstrează abonările, acordurile și starea notificărilor. Resend livrează mesajele prin API; nu folosim vechiul segment de contacte și nu importăm automat adresele existente. Confirmarea este obligatorie. Adresele folosite în formularul de contact nu devin abonați.

La fiecare 10 minute Worker-ul citește exclusiv `https://techcub.ro/notifications.json` și verifică în HTML identificatorul materialului. Build-urile locale, preview-urile și simplul push în GitHub nu trimit mesaje. Prima rulare înregistrează materialele deja publicate ca punct de pornire, fără notificări retroactive. Verifică inițializarea înainte de publicarea primului material care trebuie anunțat.

## Configurare și activare

1. Creează baza D1 în contul Cloudflare folosit de site:

   ```bash
   pnpm exec wrangler d1 create techcub-newsletter --jurisdiction eu
   ```

   Adaugă `database_id` în intrarea `d1_databases` din `workers/newsletter/wrangler.jsonc`. Nu modifica DNS, MX sau domeniile de e-mail pentru acest pas.

2. Aplică migrarea în baza dedicată:

   ```bash
   pnpm exec wrangler d1 migrations apply techcub-newsletter --remote --config workers/newsletter/wrangler.jsonc
   ```

3. Alege o adresă de expeditor de pe un domeniu deja verificat în Resend. Completează `RESEND_FROM_EMAIL` cu adresa simplă (fără nume sau paranteze) și `RESEND_DOMAIN_ID` cu identificatorul domeniului, în configurația Worker-ului. Dezactivează **Open tracking** și **Click tracking** pentru acel domeniu. Serviciul verifică setările înainte de confirmări și înainte de fiecare rundă de notificări și refuză să trimită dacă ele nu sunt ambele `false`. Cheia Resend trebuie să poată citi domeniul și trimite e-mailuri. Nu modifica domeniul de trimitere fără a verifica dependențele existente.

4. Configurează secretele, cu două valori aleatoare independente de minimum 32 de caractere:

   ```bash
   pnpm exec wrangler secret put RESEND_API_KEY --config workers/newsletter/wrangler.jsonc
   pnpm exec wrangler secret put NEWSLETTER_SERVICE_TOKEN --config workers/newsletter/wrangler.jsonc
   pnpm exec wrangler secret put NEWSLETTER_TOKEN_SECRET --config workers/newsletter/wrangler.jsonc
   ```

   Nu pune valorile în Git sau în documentație. `NEWSLETTER_TOKEN_SECRET` semnează linkurile; schimbarea lui invalidează linkurile deja trimise, inclusiv dezabonările. Rotația cere un mecanism de tranziție, nu simpla înlocuire a cheii.

5. Publică Worker-ul cu `NEWSLETTER_ENABLED: "false"`:

   ```bash
   pnpm exec wrangler deploy --config workers/newsletter/wrangler.jsonc
   ```

   În mediul server al site-ului configurează `NEWSLETTER_SERVICE_URL` cu URL-ul Worker-ului și `NEWSLETTER_SERVICE_TOKEN` cu aceeași valoare ca mai sus. Acestea trebuie disponibile la runtime; `PUBLIC_NEWSLETTER_ENABLED=false` este configurat la build. Publică site-ul pentru a face disponibile manifestul, paginile și endpointurile noi.

6. Setează `NEWSLETTER_ENABLED: "true"` și republică Worker-ul. Așteaptă prima rulare reușită și verifică `state.initialized` și `state.last_success` în D1. Baza inițială poate avea zero materiale. Testează folosind exclusiv o adresă proprie autorizată: solicitare, confirmare, o notificare de test și dezabonare. O notificare reală de test necesită un material public pe domeniul configurat; testele automate folosesc pagini și e-mailuri simulate.

7. După verificare, setează `PUBLIC_NEWSLETTER_ENABLED=true` și reconstruiește site-ul. Acesta este ultimul pas care deschide înscrierile publice. Pentru testarea fluxului înaintea activării publice poți folosi local site-ul cu această variabilă activată și cu serviciul deja configurat. Linkurile trimise duc la domeniul live.

Nu declara integrarea activă până când un e-mail real a fost primit și dezabonarea a fost verificată. Înainte de activare, verifică acordurile de prelucrare și perioadele de retenție din conturile Cloudflare și Resend, apoi aliniază politica dacă setările conturilor diferă.

## Publicarea unui material

În frontmatter-ul unui proiect sau articol pe care vrei să îl anunți adaugă:

```yaml
notification:
  id: intune-configurare-dispozitive
  publishedAt: 2026-10-01T09:00:00Z
draft: false
```

Alege data reală a publicării, cu fus orar. Proiectele trebuie să aibă și `placeholder: false`. Un material fără `notification` nu generează e-mail: astfel paginile demonstrative și conținutul nefinalizat rămân excluse. Data notificării nu programează publicarea paginii; ea stabilește cel mai devreme moment permis pentru trimitere.

Păstrează `notification.id` neschimbat la corecturi, schimbări de titlu, mutări de URL sau redeploy. Pentru traduceri folosește același ID: limba este adăugată automat, iar destinatarii primesc numai materialele în limba abonării. Nu recicla ID-uri pentru alte materiale.

După publicarea efectivă, serviciul înregistrează destinatarii confirmați la descoperirea materialului și trimite titlul, rezumatul și linkul. Abonații noi nu primesc restanțe. Retragerea unui material din manifest oprește notificările încă netrimise; nu poate retrage mesaje deja acceptate de Resend.

## Erori, limite și verificări

Sunt permise maximum 100 de solicitări de abonare pe zi și cel mult o confirmare per adresă în 24 de ore. O eroare de livrare a confirmării nu activează adresa; utilizatorul poate solicita un nou link după 24 de ore. Linkurile expiră în 24 de ore. Pentru notificări există o limită proprie de 80 de încercări de livrare pe zi și 20 pe rundă. Aceste valori sunt protecții ale aplicației, nu limite garantate ale planului Resend. Monitorizează cota contului, inclusiv mesajele formularului de contact, și dimensionează limitele când lista crește.

Trimiterile folosesc o evidență persistentă și chei de idempotență. La o eroare ambiguă se reia același mesaj cu aceeași cheie, maximum 23 de ore de la prima încercare. Apoi livrarea devine `uncertain`, fără retrimitere automată. Verifică Resend înainte de orice intervenție: API-ul păstrează idempotența numai 24 de ore. Nu reseta starea livrărilor sau a publicațiilor ca metodă de retry.

Worker-ul emite evenimente fără adrese și tokenuri: `confirmation_send_failed`, `delivery_send_failed`, `delivery_needs_review`, `newsletter_schedule_failed`. Verifică erorile în Cloudflare și stările `uncertain` în D1. Configurează alerte pentru eșecurile Worker-ului și verifică `last_success` dacă nu apar notificări. Serviciul nu trimite alerte de administrare prin e-mail.

Pentru pauză, setează `NEWSLETTER_ENABLED=false`; dezabonarea și curățarea datelor continuă să funcționeze. Păstrează Worker-ul disponibil pentru linkurile din mesajele deja trimise. Setează și `PUBLIC_NEWSLETTER_ENABLED=false` la următorul build al site-ului.

## Date și confidențialitate

Păstrăm adresa, limba, momentele solicitării/confirmării și textul exact al acordului, cu versiunea `CONSENT_VERSION`. Când schimbi scopul acordului, actualizează versiunea și fluxul de reconsimțire; nu extinde automat scopul abonărilor existente.

La dezabonare sunt șterse abonarea și livrările asociate. Linkurile vechi nu pot reactiva adresa; o nouă abonare cere o nouă confirmare. Cererile neconfirmate sunt șterse după 48 de ore, la următorul cron. Evidențele de livrare finalizate sunt curățate după 30 de zile. ID-urile publicațiilor sunt păstrate pentru prevenirea duplicatelor și nu conțin adrese.

Nu stocăm IP-uri în baza aplicației. Contoarele anti-abuz sunt globale și expiră. Resend procesează adresa, mesajul și metadatele de livrare; jurnalele și copiile de siguranță ale furnizorilor au retenție separată. Nu restaurăm o copie veche a listei fără reconcilierea dezabonărilor, deoarece restaurarea ar putea reactiva adrese șterse.

Paginile de confirmare/dezabonare nu încarcă analytics și primesc tokenul în fragmentul URL, care nu ajunge în cererea HTTP. Confirmarea cere apăsarea unui buton, astfel încât simpla scanare a linkului de către un serviciu de securitate nu activează abonarea. Dezabonarea standard din clientul de e-mail folosește un POST cu token semnat și nu cere autentificarea utilizatorului.

## Teste locale

```bash
pnpm test:run
pnpm newsletter:check
pnpm newsletter:build
```

Testele rulează SQL-ul real al migrării într-o bază D1 locală temporară prin Wrangler. Resend și site-ul live sunt simulate; nu se trimit e-mailuri și nu se accesează baza de producție. Generarea tipurilor folosește `wrangler types`; la regenerare, fișierul local `.dev.vars` trebuie să conțină numele secretelor din `.dev.vars.example`.
