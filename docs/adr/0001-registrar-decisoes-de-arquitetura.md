# 1. Registrar decisões de arquitetura

- **Status:** Aceito
- **Data:** 2026-06-01

## Contexto

Decisões estruturais (escolha de backend, modelo de auth, estratégia de tipos)
têm impacto duradouro e costumam ser esquecidas ou questionadas meses depois.
Sem registro, o "porquê" se perde e o time repete discussões já resolvidas.

## Decisão

Manter ADRs curtos em `docs/adr/`, no formato Nygard (Contexto / Decisão /
Consequências). Um arquivo por decisão, numerado e imutável. Mudanças geram um
novo ADR que marca o anterior como *Substituído*.

## Consequências

- ✅ Onboarding mais rápido; o "porquê" fica versionado junto do código.
- ✅ Discussões convergem para um documento, não para a memória de alguém.
- ⚠️ Exige disciplina de criar o ADR no momento da decisão.
