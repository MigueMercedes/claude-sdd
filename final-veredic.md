# Veredicto final: claude-sdd vs spec-kit

> Documento de referencia para decidir qué herramienta SDD usar.
> Fecha: 2026-04-29.

## TL;DR

**Para mi caso (Miguel, trabajo solo o equipo chico, Claude Code, mix de bugs/features/typos): claude-sdd.**

No por chauvinismo de proyecto propio, sino porque la filosofía de claude-sdd se ajusta a la realidad del trabajo diario: el 80% de las tareas no merecen un pipeline de 7 fases. Spec-kit asume lo contrario.

---

## Qué es cada uno

### spec-kit (GitHub)

- 91.5k stars, 7.9k forks, 8 meses en el mercado, respaldado por GitHub.
- Python CLI (`specify init`), soporta 30+ agentes (Claude, Gemini, Cursor, Codex, etc.).
- Pipeline rígido de 7 fases: `/speckit.constitution` → `specify` → `clarify` → `plan` → `tasks` → `implement` → `analyze`.
- Genera 6 artefactos por feature: `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `api-spec.json`, `research.md`.
- **Tesis**: *"specs become executable"* — la spec ES la fuente de verdad que genera código.

### claude-sdd

- Pre-1.0, sin npm, distribuido por git URL, Claude Code only.
- ~750 líneas totales entre código + skill + templates.
- 3 modos: **FULL / FAST / SHORT-CIRCUIT** clasificados por una skill.
- 1 spec por feature (11 secciones) + 6 extensiones opt-in + ADRs separados.
- **Tesis**: *"la disciplina rígida se rompe en una semana, mete escape hatches".*

---

## Matriz de decisión

| Situación | Herramienta | Razón |
|---|---|---|
| Trabajo solo o equipo chico (1-4 personas) | **claude-sdd** | Spec-kit con 7 fases es overhead que no se amortiza |
| Equipo grande (5+) con onboarding constante | **spec-kit** | Artefactos separados (research, data-model, api-spec) ayudan a alinear |
| Uso solo Claude Code | **claude-sdd** | Es Claude-native, su skill explota la integración |
| Alterno entre Claude, Cursor, Codex | **spec-kit** | Soporta 30+ agentes, claude-sdd solo Claude Code |
| Mix realista de tareas (typos, bugs, features) | **claude-sdd** | SHORT-CIRCUIT/FAST/FULL clasifica y ahorra ceremonia |
| Mayoría features grandes, casi nada de bugs | **spec-kit** | El pipeline completo paga, no estorba |
| Quiero probar TDD selectivo (test-first solo donde aporta) | **claude-sdd** | Lo trae explícito; spec-kit es agnóstico |
| Quiero spec ejecutable que genere implementación auto | **spec-kit** | Es su tesis central; claude-sdd no apunta a eso |
| Necesito ADRs separados de specs con criterio claro | **claude-sdd** | Spec-vs-ADR explícito; spec-kit no diferencia |
| Quiero "constitution" del proyecto antes de empezar | **spec-kit** | Tiene `/speckit.constitution`; claude-sdd no |

---

## Las diferencias filosóficas que importan

### 1. Ceremonia obligatoria vs. clasificación por overhead

- **spec-kit**: toda feature pasa por las 7 fases. Sin escape hatches.
- **claude-sdd**: una skill clasifica la tarea y elige modo. Un typo va por SHORT-CIRCUIT (2 minutos), un bug por FAST (~20 min), una feature externa por FULL (medio día).

**Implicación**: si tu día tiene mezcla, spec-kit te va a frustrar y vas a abandonarlo. Si tu día es 100% features grandes, su rigor paga.

### 2. Un artefacto vs. múltiples

- **spec-kit**: 6 archivos por feature (`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `api-spec.json`, `research.md`).
- **claude-sdd**: 1 archivo (`<slug>.spec.md`) con 11 secciones universales + extensiones opt-in. ADR aparte.

**Implicación**: más granularidad ayuda en equipos grandes y dominios complejos. Un solo archivo gana en velocidad de revisión y mantenimiento para proyectos chicos.

### 3. Tesis sobre la spec

- **spec-kit**: la spec es ejecutable, genera el código.
- **claude-sdd**: la spec es contrato + design doc + test plan en un solo lugar; el agente la usa como guía, no como compilador.

**Implicación**: si confías en que el agente pueda derivar implementación correcta de una spec rica, spec-kit. Si prefieres que la spec sea una guía y el agente trabaje con criterio, claude-sdd.

### 4. Soporte de agentes

- **spec-kit**: 30+ agentes (Claude, Gemini, Cursor, Codex, Qwen, Goose, OpenCode, etc.).
- **claude-sdd**: solo Claude Code.

**Implicación**: si tu stack de agentes va a diversificar, spec-kit es portable. Si vives en Claude Code, claude-sdd lo aprovecha mejor.

---

## Cuándo SÍ migrar a spec-kit (revisar cada 6 meses)

Tres trigger conditions claras. Si llega alguna, reevaluar.

1. **Equipo crece a 5+ personas** que no son yo y necesitan onboarding consistente.
2. **Mi trabajo se vuelve mayormente features grandes** (sin bugs, sin typos, sin ajustes chicos).
3. **Empiezo a alternar** entre Claude, Cursor y Codex para distintas tareas.

Hoy (2026-04-29) ninguna aplica.

---

## Lo que vale la pena robar de spec-kit (sin migrar)

Dos ideas concretas a integrar a claude-sdd cuando sea oportuno (no urgente):

1. **Step `/clarify` opcional dentro del modo FULL.**
   Preguntas dirigidas para resolver ambigüedades antes de comprometer la estructura de la spec. La skill ya hace algo parecido en first-time setup; faltaría como sub-paso explícito en FULL.

2. **`plan.md` separado de `spec.md` para tareas grandes.**
   La spec define el QUÉ, el plan define el CÓMO con secuencia de tareas. Hoy claude-sdd los mezcla. Para features de varios días de trabajo, separar puede ayudar.

**Cómo validarlas**: dedicar 2 horas un sábado a probar spec-kit en un side-project descartable. No para migrar, para sentir si esos pasos aportan en la práctica. Si convencen, integrarlos como mejoras incrementales a claude-sdd.

---

## Por qué este veredicto NO es chauvinismo

Tres datos honestos que ponen el veredicto en su sitio:

- **No voy a "ganar" en distribución.** Spec-kit tiene 91k stars y el peso de GitHub. Matemáticamente imposible alcanzarlo. Si la meta era "construir el framework SDD popular", llegué tarde.
- **Hay cosas donde spec-kit es mejor**: multi-stage refinement explícito, separación plan/tasks/spec, soporte multi-agente, artefactos especializados (research, data-model).
- **Hay cosas donde claude-sdd no aporta**: el concepto base de spec-driven con templates ya está mejor hecho por ellos. El scaffolding CLI es genérico. El ADR template es estándar.

**Donde claude-sdd sí aporta**, y por lo que vale la pena seguirlo usando:

- El **mode classifier** (FULL/FAST/SHORT-CIRCUIT). Esto no existe en spec-kit y resuelve un problema real.
- **Selective TDD opinionado** (test-first para services, code-first para UI).
- **Spec vs ADR explícito** con criterio claro de cuándo usar cada uno.
- **Una skill orquestadora** integrada a Claude Code en lugar de 7 slash commands.

---

## Decisión

**Sigo con claude-sdd. Sin cambios al repo hoy.**

Próximo paso útil (cuando haya tiempo, no urgente): probar spec-kit 2 horas en un side-project para validar empíricamente las dos ideas robables (`/clarify`, `plan.md` separado). Si después de probarlas convencen, integrarlas a claude-sdd. Si no, queda confirmado por evidencia que lo actual es lo correcto.
