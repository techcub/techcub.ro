# Tech cu Bogdan

Site-ul oficial [techcub.ro](https://techcub.ro), construit cu Astro, Tailwind CSS si TypeScript.

![Astro 7.2](https://img.shields.io/badge/Astro-7.2-BC52EE)
![Tailwind 4.3](https://img.shields.io/badge/Tailwind-4.3-38BDF8)
![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6)

## Cerinte

- **Node.js 22.12.0+**
- **pnpm 10.33.0**

## Dezvoltare locala

```bash
corepack pnpm install
corepack pnpm dev --host
```

## Verificari

| Comanda         | Rol                             |
| --------------- | ------------------------------- |
| `pnpm lint`     | Verifica regulile ESLint        |
| `pnpm check`    | Verifica Astro si TypeScript    |
| `pnpm test:run` | Ruleaza testele                 |
| `pnpm build`    | Genereaza build-ul de productie |
| `pnpm verify`   | Verifica fisierele generate     |

## Configurare

Datele companiei sunt centralizate in `src/config/business.config.ts`.
Navigatia se afla in `src/config/nav.config.ts`, iar textele publice RO si EN in `src/i18n/`.

Variabilele necesare pentru formulare, newsletter, analytics si verificarea motoarelor de cautare sunt documentate in `.env.example`.

## Publicare

Domeniul de productie este `https://techcub.ro`. Build-ul Cloudflare foloseste:

```bash
DEPLOY_TARGET=cloudflare pnpm build
```

Proiectul necesita Linux x64 pentru build-ul Cloudflare deoarece runtime-ul local Cloudflare nu este disponibil pe Windows ARM.
