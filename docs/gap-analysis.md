# AI trends gap analysis

*As of 23 Nov 2026.* This compares the Atlas's 98 pages against where AI stands now. It lists what's missing, what's thin, and what needs a factual update.

## Status: v23 update (23 Nov 2026)

Everything below is closed except where noted. Changes are in `source/atlas.html`, applied by `scripts/content/2026-11-trends.py`, and listed in the site's changelog as v23.

| Item | Where it went |
|---|---|
| 1.1 A2A version and governance | `a2a`: new "Version & governance" section |
| 1.2 MCP's home in AAIF | `mcp`: new "Governance" section |
| 1.3 UCP, AP2 governance, multi-protocol gateways | `agent-payments`: UCP row, "What moved in 2026" |
| 1.4 Agent identity standards | `agent-runtime`: "Agent identity: emerging standards" table |
| 1.5 GPAI Code of Practice, Article 50 dates | `ai-compliance`: three timeline rows (10 Jul 2025, 2 Aug 2026, 2 Dec 2026) |
| 2.1 Agentic coding | New page `agentic-coding` (Build & ship) |
| 2.2 Computer-use and browser agents | New page `computer-use` (Agents) |
| 2.3 Reasoning models | New page `reasoning-models` (Models & ML) |
| 2.4 Infrastructure economics and sovereignty | New page `ai-infrastructure` (CAIO) |
| 2.5 Agent evaluation | New page `agent-evals` (Build & ship) |
| 2.6 Speech-to-speech voice | `voice`: "Cascaded vs speech-to-speech" |
| 2.7 Agent supply-chain security, shadow AI | `ai-security`: "Attacks on agent tools & MCP", "Shadow AI & agent sprawl" |
| 2.8 Small and on-device models | `model-selection`: "Small & on-device models" |
| 2.9 Frontier safety | `model-selection`: "Frontier safety: what to ask a model provider" |
| 2.10 AI search visibility | `applied-ml`: "AI search & answer engines" |
| 2.11 Generative UI | `agent-runtime`: "Agent front-ends & generative UI" |
| Watch list: new architectures, video and world models | `nn-arch`: "Beyond the Transformer"; `gen-media`: "Video, world models & physical AI" |
| Watch list: workforce and adoption statistics | **Not added.** The figures found came from single vendor or VC surveys; worth adding once there's a source you trust. |
| Section 3: keeping it current | Review tracker entries for the new pages and refreshed topics; 12 new glossary terms; the new pages added to the learning paths |

Also fixed while doing this: the "Sources & review" box on every page showed "Concept page" even for time-sensitive pages, because it couldn't see the review dates. That bug was in the original file too.

## How this was done

- **Coverage scan.** The rendered text of all 98 pages (`public/search-index.json`, about 535,000 characters) was searched for about 80 trend terms. Mentions were counted per page.
- **Glossary-only topics count as gaps.** A topic that appears only in the glossary (`glossary`, `acumen`) has a definition but no explanation.
- **Recent facts were checked against the web.** The sources are listed at the end. Several are vendor blogs, so treat the newest details as leads to confirm, not settled facts.
- **This is analysis only. No page content was changed.** New material goes into `source/atlas.html`, followed by `npm run extract` and the parity test (see README).

## What's already current

Most of the fast-changing pages were reviewed on 20–21 Nov 2026, and they hold up:

| Area | Page | What it already covers |
|---|---|---|
| MCP | `mcp-protocol` | The 2026-07-28 spec: stateless core, MCP Apps, deprecation of Sampling/Roots/Logging. |
| Regulation | `ai-compliance` | EU AI Act dates after the digital omnibus (high-risk Annex III on 2 Dec 2027, Annex I on 2 Aug 2028); California SB 53; Colorado SB 26-189; NY RAISE; EO 14365. |
| Security | `ai-security` | OWASP Top 10 for LLM Applications 2026 and the Top 10 for Agentic Applications. |
| Observability | `fde-observability`, `llmops` | OpenTelemetry GenAI semantic conventions. |
| Payments | `agent-payments` | AP2, ACP, x402 and card-network agent programs. |
| Serving | `optimization` | vLLM/SGLang, speculative decoding, quantization, prompt caching, LoRA. |

Model names are deliberately rare (only 3 pages name any), so model launches don't date the content. Keep it that way.

## 1. Factual updates to existing pages (small, high value)

| # | Page | What's missing | Evidence |
|---|---|---|---|
| 1.1 | `a2a` | No protocol version and no governance info. A2A **v1.0** (the first stable release) was frozen on 12 Mar 2026. The project moved to the **Agentic AI Foundation (AAIF)** in Aug 2026, alongside MCP, AGENTS.md and goose. Over 150 organizations support it. | Google Open Source Blog, AAIF, Axios, Linux Foundation |
| 1.2 | `mcp`, `mcp-protocol` | No mention of MCP's home in AAIF. | AAIF |
| 1.3 | `agent-payments` | **UCP (Universal Commerce Protocol)** is missing. Google launched it in Jan 2026 with Shopify, covering discovery plus checkout. AP2 governance moved to the **FIDO Alliance** (Apr 2026). Reports say OpenAI dropped in-chat Instant Checkout (Mar 2026). Multi-protocol gateways exist (e.g. Adyen, Jun 2026). | checkout.com, REAP, Digital Applied, Rework |
| 1.4 | `agent-runtime` | The identity section recommends OAuth token exchange, which is good, but it doesn't name the emerging standards. These are the IETF WIMSE **AIMS** draft (Sep 2026; agents as workloads, SPIFFE IDs) and the OpenID **agent identity** profile draft. A note that OAuth lacks multi-hop delegation would also help. | IETF Datatracker, arXiv 2604.23280 |
| 1.5 | `ai-compliance` | The **GPAI Code of Practice** isn't mentioned. Also check the timing of the **Article 50 transparency/watermarking** duties for generative output. Providers are already switching on watermarks for the EU (e.g. xAI, Nov 2026). Confirm the exact dates after the omnibus before writing them. | moststarred launch log, EU AI Act |

## 2. Missing or thin topics

Ranked by how much the Atlas's audience (architects, FDEs, CAIOs, CX leaders) needs each topic, and how far the current coverage falls short.

### High priority

**2.1 Agentic coding and software-engineering agents.** *Thin: mentions on 5 pages, none that explain it.*
This is the most widely adopted kind of agent in 2026. It's missing:
- the coding-agent loop: plan, edit, test, review
- background and asynchronous agents that open pull requests
- spec-driven development and repo instruction files (`AGENTS.md`, now an AAIF project)
- sandboxing
- code review by agents
- SWE-bench-style evaluation
- team adoption patterns

*Suggestion:* a new page under **Build & ship**, linked from `agent-kit` and `llmops`.

**2.2 Computer-use and browser agents.** *Thin: `agent-runtime` has a paragraph; the term "agentic browser" appears nowhere.*
It's missing:
- how GUI agents see and act (screenshots, accessibility tree, DOM)
- reliability limits
- when to prefer an API or MCP instead
- agentic browsers
- prompt injection from web content
- human checkpoints

*Suggestion:* a section in `agents` or `tool-call`, with security linked from `ai-security`.

**2.3 Reasoning models and test-time compute.** *Thin: one row in `llm-types`, one line in `post-training`, plus the glossary.*
It's missing:
- how thinking models differ
- adaptive thinking and effort controls
- the cost and latency trade-off
- when reasoning helps or hurts (extraction vs planning)
- prompting differences (less step-by-step scaffolding)
- RL with verifiable rewards (RLVR/GRPO) as the training story

*Suggestion:* a section in `how-llms-work`, and a "reasoning on/off" factor in `model-selection` and `cost`.

**2.4 AI infrastructure economics: compute, energy, sovereignty.** *Missing: "sovereign" 0 pages, energy/data-centre 2 passing mentions.*
CAIOs are being asked about:
- sovereign AI and data residency
- on-prem "AI factories" versus API
- GPU capacity and pricing
- power constraints
- falling cost per token

*Suggestion:* a section in `ai-budget` (TCO: build/host/API) and `ai-strategy`; possibly a new **CAIO** page.

**2.5 Agent evaluation.** *Thin: `evalhub` and `llm-judge` cover output evals; agent-specific evaluation shows up only in passing.*
It's missing:
- trajectory and tool-call evaluation
- task success over multiple attempts (pass^k)
- simulated users
- regression suites for agents
- long-horizon measures (e.g. METR-style task time horizons)
- benchmark contamination and saturation

`fde-testing` covers conversation regression for CX, which is a good start to generalize.

*Suggestion:* a section in `evalhub`.

**2.6 Realtime speech-to-speech voice.** *Thin: `voice` describes a cascaded STT → LLM → TTS stack; native speech-to-speech appears only in the glossary.*
For a site with a whole CX section, it's missing:
- native audio models
- full-duplex turn-taking and barge-in
- latency budgets for each approach
- when to keep the cascade (compliance, control, cost)

*Suggestion:* a section in `voice` and `cx-arch`.

### Medium priority

**2.7 Agent supply-chain security.** *Missing: "tool poisoning" and "shadow AI" appear nowhere.*
It's missing:
- MCP tool-description poisoning and "rug-pull" server updates
- confused-deputy risks
- server allow-lists and registries
- shadow AI and agent sprawl (`agent-catalog` touches on inventory)

*Suggestion:* sections in `ai-security` and `agent-governance`.

**2.8 Open-weight and small/on-device models.** *Thin: `model-selection` and `optimization` mention them.*
It's missing:
- the open-weight landscape and licences
- distillation into small models
- on-device/NPU deployment
- when self-hosting beats an API

*Suggestion:* a section in `model-selection`.

**2.9 Frontier safety and interpretability.** *Glossary-only in practice.*
It's missing:
- frontier safety frameworks (responsible scaling, preparedness)
- dangerous-capability evals
- system cards
- what interpretability can and can't tell a buyer

Relevant for CAIO vendor due diligence (`vendors`) and SB 53 / RAISE obligations.

**2.10 AI search visibility (GEO / answer engines).** *Missing: 0 pages.*
How brands and content show up in AI answers and assistants.

*Suggestion:* a short section in `applied-ml` or `industry`. It also applies to the Atlas itself (structured data is already in place).

**2.11 Generative UI and agent front-ends.** *Thin: `mcp-protocol` only.*
It's missing:
- MCP Apps as a pattern
- agent-to-UI protocols (AG-UI, A2UI)
- streaming UX
- human-in-the-loop approval screens

### Lower priority (watch list)

- **Video generation, world models and physical AI.** `gen-media` and `applied-ml` mention them briefly. Add when there's an enterprise use case.
- **New architectures.** There's no mention of diffusion LLMs or hybrid SSM-Transformer models beyond the glossary. Worth a line in `nn-arch`.
- **Continual learning and self-improving agents.** Glossary, `post-training`, `agent-catalog`. Keep an eye on it.
- **Workforce impact data.** `ai-operating-model` covers the operating model. Adoption and pilot-to-production statistics (e.g. Menlo Ventures 2026: 32% running multiple agents together) could support `ai-value` and `caio`.

## 3. Keeping it current

- **Track review dates for the new topics.** The `changes` page tracks 19 review topics, and a monthly check flags them. Add review entries for anything new above, especially A2A version, commerce protocols, agent identity drafts and Article 50.
- **Keep naming roles, not models.** The model-neutral style should stay. Where a page needs examples (e.g. `ai-landscape`), use a dated "as of" note.

## Suggested order

1. **Quick fixes:** section 1 (one editing pass, mostly table rows and a paragraph each).
2. **New pages:** 2.1 agentic coding, 2.2 computer use.
3. **Sections:** 2.3 reasoning models, 2.5 agent evaluation, 2.6 realtime voice.
4. **CAIO sections:** 2.4 infrastructure economics and 2.9 frontier safety.
5. **Everything else** as time allows.

## Sources

- [A2A v1.0 builder's guide (AAIF)](https://aaif.io/blog/a2a-v1-0-a-builder-s-guide-part-1-discovery-tasks-and-clients)
- [A year of A2A (Google Open Source Blog)](https://opensource.googleblog.com/2026/04/a-year-of-open-collaboration-celebrating-the-anniversary-of-a2a.html)
- [A2A gets a new home (Axios)](https://axios.com/2026/08/17/a2a-agentic-ai-foundation-open-ai-standards)
- [A2A passes 150 organizations (Linux Foundation)](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [IETF WIMSE AIMS draft](https://datatracker.ietf.org/doc/html/draft-ietf-wimse-aims)
- [OpenID agent identity draft](https://datatracker.ietf.org/doc/draft-sharif-openid-agent-identity/)
- [AI Identity: standards and gaps (arXiv)](https://arxiv.org/pdf/2604.23280)
- [ACP vs UCP (Checkout.com)](https://www.checkout.com/blog/openai-acp-google-ucp-difference)
- [Agentic commerce protocols (REAP)](https://reap.global/blog/agentic-commerce-protocols)
- [UCP, ACP, AP2 merchant guide (Digital Applied)](https://www.digitalapplied.com/blog/agentic-commerce-standards-ucp-acp-ap2-2026-merchant-guide)
- [Agentic commerce platforms 2026 (Rework)](https://resources.rework.com/tools/ai-agents/best-agentic-commerce-platforms-2026)
- [2026: The State of Enterprise AI (Menlo Ventures)](https://menlovc.com/perspective/2026-the-state-of-enterprise-ai/)
- [Enterprise AI 2026 trends (Spectro Cloud)](https://www.spectrocloud.com/blog/enterprise-ai-2026-trends)
- [November 2026 AI model launches](https://moststarred.com/learn/ai-models/launches-2026-11)
