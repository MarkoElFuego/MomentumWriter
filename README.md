# Momentum (radni naziv)

> AI writing software koji ne pokušava da napiše knjigu — nego da natera autora da je završi.

## Šta je u ovom folderu

| Fajl | Za koga | Čemu služi |
|---|---|---|
| `AGENTS.md` | Codex / GPT / Cursor / svi agenti | Glavna pravila projekta (izvor istine) |
| `CLAUDE.md` | Claude Code | Uvozi `AGENTS.md` + Claude-specifična pravila |
| `docs/PRODUCT.md` | ti + agent | Vizija, principi, šta NE radimo |
| `docs/ARCHITECTURE.md` | agent | Stack, struktura foldera, model podataka |
| `docs/AI_PROMPTS.md` | agent | Sistem promptovi za 4 AI alata + JSON formati |
| `docs/PLAN.md` | ti | Vibe coding plan po fazama + promptovi za copy-paste |
| `docs/PROGRESS.md` | agent (ažurira ga) | Checklist — gde smo stali |
| `.claude/commands/next.md` | Claude Code | `/next` — uradi sledeći zadatak iz PROGRESS |
| `.claude/commands/review.md` | Claude Code | `/review` — proveri kod protiv principa proizvoda |
| `.env.example` | ti | Primer promenljivih okruženja |

## Kako da kreneš

1. Napravi prazan folder, ubaci sve ove fajlove u njegov koren.
2. `git init && git add . && git commit -m "docs: project brief"`
3. Otvori Claude Code (`claude`) ili Codex u tom folderu.
4. Otvori `docs/PLAN.md` i nalepi prompt iz **Faze 0**.
5. Posle svake faze: proveri „Gotovo kada” listu, pa commit.

Zlatno pravilo: **jedna faza = jedan razgovor = jedan commit.**
