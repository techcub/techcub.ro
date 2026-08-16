# Politica de securitate

## Raportarea unei vulnerabilitati

Problemele de securitate nu trebuie publicate intr-un issue public. Raportarea se face prin GitHub Security Advisories sau la `contact@techcub.ro`.

Include, daca este posibil:

- fisierul sau ruta afectata;
- impactul observat;
- pasii de reproducere;
- un exemplu minim sau un proof of concept.

## Reguli operationale

- Cheile API si credentialele raman exclusiv in variabile de mediu.
- Variabilele cu prefixul `PUBLIC_` nu contin secrete.
- Dependentele sunt actualizate si verificate inainte de publicare.
- Formularele si rutele API sunt testate in mediul de productie dupa fiecare schimbare de infrastructura.
