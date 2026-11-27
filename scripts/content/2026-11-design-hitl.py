"""
Content update v24 (2026-11-27): AI system design layers, human-in-the-loop controls,
the three-agent harness and community MCP servers.

Adapted from four infographics the site owner supplied, checked against their sources:
- The six layers of AI system design (a community learning map)
- Eight human-in-the-loop controls for agentic AI (aidigital.co.uk)
- Harness design: three agents around one prompt (Anthropic, "Harness design for
  long-running application development", 24 Mar 2026). Corrected: the $124.70 run built a
  different app (a browser audio workstation), not the same game.
- Eight community MCP servers (repositories, owners and licences checked on GitHub, 27 Nov 2026;
  star counts left out because they go stale within days)

Applies exact, counted edits to source/atlas.html, like scripts/content/2026-11-trends.py.
Refuses to run twice.

    python3 scripts/content/2026-11-design-hitl.py
"""
import re, sys, pathlib

SRC = pathlib.Path(__file__).resolve().parents[2] / 'source' / 'atlas.html'
s = SRC.read_text(encoding='utf-8')

if 'id="hitl-controls"' in s:
    sys.exit('already applied')

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'expected {count} match(es), found {n}: {old[:90]!r}')
    s = s.replace(old, new)

def after_section(page_id, html):
    global s
    i = s.index(f'<section id="{page_id}"')
    j = s.index('</section>', i) + len('</section>')
    s = s[:j] + '\n' + html.strip('\n') + s[j:]

def nav_after(page_id, new_id, color, label):
    global s
    m = re.search(r'<li><a href="#' + re.escape(page_id) + r'"[^\n]*?</a></li>', s)
    if not m:
        sys.exit('nav item not found: ' + page_id)
    li = f'<li><a href="#{new_id}" style="--c:var(--{color})" title="{label}"><i></i>{label}</a></li>'
    line_start = s.rfind('\n', 0, m.start()) + 1
    indent = s[line_start:m.start()]
    s = s[:m.end()] + '\n' + indent + li + s[m.end():]

# ---------------------------------------------------------------- new pages
PAGES = {}

PAGES['ai-system-design'] = ('reference-arch', 'purple', 'AI system design: six layers', '''
<section id="ai-system-design" hidden style="--accent:var(--purple)">
  <span class="kicker">Architecture · System design</span>
  <h1>AI system design: six layers</h1>
  <p class="lead">A production AI system is ordinary system design with a model inside it. Six layers, each resting on the one below: <b>scale and speed</b>, <b>data and retrieval</b>, <b>reliability</b>, <b>AI and agents</b>, <b>security and governance</b>, and <b>observability and evaluation</b>. Learn them in order. Walk the six layers and what each one buys you.</p>
  <div data-flow="sysdesign" data-theme="soft"></div>
  <h2>The six layers</h2>
  <div class="grid g2">
    <div class="card"><span class="tag" style="color:var(--blue)">Layer 1</span><h3>Scale &amp; speed</h3><p><b>Outcome:</b> stays fast as users grow.</p><p><b>Load balancing</b> spreads requests across servers. <b>Caching</b> keeps answers close to the user; with LLMs add prompt caching and caching of repeated answers. <b>Auto-scaling</b> adds capacity with demand. <b>Rate limiting</b> protects the system; for LLMs, limit tokens per minute as well as requests.</p></div>
    <div class="card"><span class="tag" style="color:var(--orange)">Layer 2</span><h3>Data &amp; retrieval</h3><p><b>Outcome:</b> stores and finds data fast.</p><p><b>SQL or NoSQL</b> depends on how the data is shaped and queried. <b>Sharding</b> splits large data across machines. <b>Vector databases</b> find text by meaning. <b>Hybrid search</b> combines keyword and vector search, and usually beats either alone. See <a href="#vector-search">Vector search</a>.</p></div>
    <div class="card"><span class="tag" style="color:var(--teal)">Layer 3</span><h3>Reliable systems</h3><p><b>Outcome:</b> survives failures and spikes.</p><p><b>Replication</b> keeps copies of data. <b>Queues</b> absorb bursts and run long jobs, including agent tasks, in the background. <b>Retry with backoff</b> handles brief failures; make tool calls that write data idempotent so a retry doesn't do the work twice. <b>Failover</b> switches to a standby, including a second model provider.</p></div>
    <div class="card"><span class="tag" style="color:var(--amber)">Layer 4</span><h3>AI &amp; agents</h3><p><b>Outcome:</b> AI that looks things up, acts, and works.</p><p><b>RAG</b> grounds answers in your documents. <b>MCP and tools</b> let the model act on other systems. <b>Agent memory</b> carries facts and progress across turns and sessions. <b>Model routing</b> sends each request to the cheapest model that can handle it. See <a href="#rag">RAG</a>, <a href="#mcp">MCP</a> and <a href="#agents">AI agents</a>.</p></div>
    <div class="card"><span class="tag" style="color:var(--purple)">Layer 5</span><h3>Security &amp; governance</h3><p><b>Outcome:</b> data stays safe and the AI can be audited.</p><p><b>OAuth and JWT</b> say who a user, or an agent acting for one, is and what it may do. <b>Zero trust</b> checks every call, including agent-to-tool calls. <b>Guardrails</b> filter what goes into and comes out of the model. <b>Audit logs</b> record every decision and action. See <a href="#guardrails">AI guardrails</a> and <a href="#hitl-controls">Human-in-the-loop controls</a>.</p></div>
    <div class="card"><span class="tag" style="color:var(--green)">Layer 6</span><h3>Observe &amp; evaluate</h3><p><b>Outcome:</b> quality, cost and speed are measured.</p><p><b>Tracing</b> follows one request through retrieval, model calls and tools. <b>SLOs</b> set targets such as time to first token and error rate. <b>LLM evals</b> score answer quality on a fixed test set. <b>Token cost</b> is tracked per feature and per user. See <a href="#llmops">ADLC &amp; LLMOps</a> and <a href="#evalhub">Eval Hub</a>.</p></div>
  </div>
  <h2>What changes when there's a model inside</h2>
  <div class="card tablewrap"><table>
    <tr><th>Building block</th><th>Classic system</th><th>With LLMs and agents</th></tr>
    <tr><td><b>Caching</b></td><td>Same request, same response</td><td>Prompt caching for long, repeated context; caching similar questions needs a quality check</td></tr>
    <tr><td><b>Rate limiting</b></td><td>Requests per second</td><td>Tokens per minute, per user and per model, plus a spend cap</td></tr>
    <tr><td><b>Queues</b></td><td>Jobs take seconds</td><td>Agent tasks can take minutes or hours; persist their state so they can resume</td></tr>
    <tr><td><b>Retries</b></td><td>Safe for reads</td><td>A retried tool call can send an email twice: use idempotency keys on writes</td></tr>
    <tr><td><b>Failover</b></td><td>A standby server</td><td>A fallback model, with prompts and evals tested against it beforehand</td></tr>
    <tr><td><b>Access control</b></td><td>Users and services</td><td>Agents get their own identity and the narrowest permissions for each task</td></tr>
    <tr><td><b>Testing</b></td><td>Same input, same output</td><td>Outputs vary: score them on a test set and watch the scores over time</td></tr>
    <tr><td><b>Cost</b></td><td>Mostly fixed infrastructure</td><td>Grows with every token: budget per request and per feature</td></tr>
  </table></div>
  <h2>Go deeper</h2>
  <div class="card tablewrap"><table>
    <tr><th>Layer</th><th>Pages</th></tr>
    <tr><td>Scale &amp; speed</td><td><a href="#optimization">LLM optimization &amp; serving</a> · <a href="#cost">LLM cost estimator</a></td></tr>
    <tr><td>Data &amp; retrieval</td><td><a href="#vector-search">Vector search</a> · <a href="#rag-variants">RAG variants</a> · <a href="#data-readiness">Data readiness</a></td></tr>
    <tr><td>Reliable systems</td><td><a href="#agent-runtime">Agents in production</a> · <a href="#workflows">Workflows &amp; patterns</a></td></tr>
    <tr><td>AI &amp; agents</td><td><a href="#rag">RAG</a> · <a href="#mcp">MCP</a> · <a href="#agents">AI agents</a> · <a href="#model-selection">Model selection</a></td></tr>
    <tr><td>Security &amp; governance</td><td><a href="#ai-security">AI security</a> · <a href="#guardrails">AI guardrails</a> · <a href="#hitl-controls">Human-in-the-loop controls</a></td></tr>
    <tr><td>Observe &amp; evaluate</td><td><a href="#llmops">ADLC &amp; LLMOps</a> · <a href="#evalhub">Eval Hub</a> · <a href="#agent-evals">Agent evaluation</a></td></tr>
  </table></div>
  <div class="callout">This is a learning order, not a build order. A first version needs a little of every layer: a rate limit, a fallback, an audit log, a small eval set. It doesn't need sharding or multi-region failover. Add depth to a layer when its outcome starts to fail. See <a href="#reference-arch">Reference architecture</a>.</div>
  <p class="muted" style="font-size:13px">Adapted from a community infographic, "The AI System Design Universe". The notes on what changes with LLMs are this site's.</p>
</section>''')

PAGES['hitl-controls'] = ('agent-governance', 'pink', 'Human-in-the-loop controls', '''
<section id="hitl-controls" hidden style="--accent:var(--pink)">
  <span class="kicker">Trust &amp; compliance · Human oversight</span>
  <h1>Human-in-the-loop controls for agents</h1>
  <p class="lead">Autonomy is earned, not granted. Eight ways to keep people in control as agents take on more work, from approving each action to a switch that stops everything. <b>Match the control to the risk, not to the technology.</b> Walk one agent action through the controls.</p>
  <div data-flow="hitl" data-theme="soft"></div>
  <h2>Eight controls</h2>
  <div class="grid g2">
    <div class="card"><span class="tag" style="color:var(--blue)">Before acting</span><h3>1 · Approval gate</h3><p>The agent proposes; a person approves before anything runs. A rejection goes back to the agent with the reason. Every decision is logged.</p><p><b>Best for:</b> payments, contracts, messages to customers.<br><b>Watch:</b> approval fatigue, where review turns into rubber-stamping.</p></div>
    <div class="card"><span class="tag" style="color:var(--purple)">Before acting</span><h3>2 · Confidence routing</h3><p>Only low-confidence outputs go to a person; the rest go straight through. Outcomes are logged and used to recalibrate the threshold.</p><p><b>Best for:</b> high-volume triage of claims, tickets and invoices.<br><b>Watch:</b> confidence scores that were never checked against real outcomes. A model's own confidence is often poorly calibrated.</p></div>
    <div class="card"><span class="tag" style="color:var(--green)">After acting</span><h3>3 · Sampled review</h3><p>Everything runs automatically. Reviewers check a random slice, say 5%, every week, score it, and feed the failures into the eval set and prompts.</p><p><b>Best for:</b> mature, low-risk flows that are already stable.<br><b>Watch:</b> samples too small to catch rare, costly errors. Sample more from high-value cases.</p></div>
    <div class="card"><span class="tag" style="color:var(--amber)">When stuck</span><h3>4 · Exception queue</h3><p>Rules catch what the agent can't handle, such as missing data or a policy flag, and park it for a person. Everything else goes straight through.</p><p><b>Best for:</b> rules-heavy operations: identity checks (KYC), invoices, onboarding.<br><b>Watch:</b> queue backlogs that quietly breach the service level.</p></div>
    <div class="card"><span class="tag" style="color:var(--orange)">When stuck</span><h3>5 · Escalation path</h3><p>Clear triggers (high value, an angry customer, an unknown intent) hand the case up a ladder: operations, then a specialist, then the risk owner. Each step gets the full context.</p><p><b>Best for:</b> customer service, complaints, claims disputes.<br><b>Watch:</b> handoffs that make the customer repeat everything.</p></div>
    <div class="card"><span class="tag" style="color:var(--blue)">Before acting</span><h3>6 · Dual control</h3><p>Two different people must sign off before a high-risk action runs: one prepares or reviews (maker), the other approves (checker). If either declines, the action is rejected.</p><p><b>Best for:</b> payments above a limit, regulated decisions.<br><b>Watch:</b> it's slow. Keep it for the top risk tier only.</p></div>
    <div class="card"><span class="tag" style="color:var(--teal)">After acting</span><h3>7 · Audit replay</h3><p>Every agent step (prompt, data, tool calls, output) goes into a tamper-proof, timestamped trace. A reviewer can replay any decision; a flawed one leads to a fix in the policy or prompt.</p><p><b>Best for:</b> regulated decisions and reviews after an incident.<br><b>Watch:</b> gaps in what's logged, especially tool calls and retrieved data.</p></div>
    <div class="card"><span class="tag" style="color:var(--pink)">Always on</span><h3>8 · Kill switch</h3><p>A monitor watches cost, error rate and drift. When a limit is breached, a circuit breaker pauses the agent and hands the work back to people; it resumes only after review.</p><p><b>Best for:</b> every production agent, without exception.<br><b>Watch:</b> a switch nobody has tested. Rehearse it.</p></div>
  </div>
  <h2>Match the control to the risk tier</h2>
  <div class="card tablewrap"><table>
    <tr><th>Risk tier</th><th>Examples</th><th>Controls</th></tr>
    <tr><td><b>Low</b></td><td>Drafting, summaries, internal search, tagging</td><td>Sampled review, audit log, kill switch</td></tr>
    <tr><td><b>Medium</b></td><td>Ticket triage, invoice coding, routine customer replies</td><td>Confidence routing, exception queue, escalation path, plus the low-tier controls</td></tr>
    <tr><td><b>High</b></td><td>Refunds, outbound messages at scale, changes to customer records</td><td>Approval gate, audit replay, plus the medium-tier controls</td></tr>
    <tr><td><b>Critical</b></td><td>Large payments, credit or claims decisions, production infrastructure</td><td>Dual control and every control above; consider not automating the final step at all</td></tr>
  </table></div>
  <h2>Making oversight real</h2>
  <div class="grid g2">
    <div class="card"><h3>Give reviewers what they need</h3><p>Show the proposed action, the evidence behind it, what the agent was unsure about and what happens if it's wrong. A bare "Approve?" button invites rubber-stamping.</p></div>
    <div class="card"><h3>Measure the reviewers too</h3><p>Track approval rate, time per review and how often reviewers overturn the agent. Approval near 100% with seconds per review means the gate has stopped working.</p></div>
    <div class="card"><h3>Earn autonomy with evidence</h3><p>Move a task down a tier only after a set number of clean runs, for example from approval gate to sampled review after 500 approvals with no corrections. Move it back up after an incident.</p></div>
    <div class="card"><h3>Human review alone won't scale</h3><p>At thousands of actions a day, use automated checks and evaluator agents for most of the work, and keep people for the decisions that matter. See <a href="#agent-governance">Agents watching agents</a> and its review-load calculator.</p></div>
  </div>
  <div class="callout">Regulation points the same way. For high-risk systems, the EU AI Act (Article 14) requires effective human oversight, including the ability to override the system's output and to stop it. See <a href="#ai-compliance">Responsible AI, regulation &amp; compliance</a> and <a href="#guardrails">AI guardrails</a>.</div>
  <p class="muted" style="font-size:13px">Adapted from "8 human-in-the-loop controls for agentic AI" (aidigital.co.uk). The risk tiers and the notes on calibration, sampling and earning autonomy are this site's.</p>
</section>''')

for pid, (after, color, label, html) in PAGES.items():
    after_section(after, html)
    nav_after(after, pid, color, label)

# ---------------------------------------------------------------- harness: three agents around one prompt
HARN3 = '''
  <h2>Three agents around one prompt</h2>
  <p>Asked to grade their own work, agents confidently praise it, even when the quality is obviously mediocre. Anthropic's Labs team fixed this by separating the jobs: a <b>planner</b> writes the spec, a <b>generator</b> builds it a piece at a time, and an <b>evaluator</b> uses the running app like a user would and fails anything below the bar. Walk the loop.</p>
  <div data-flow="harn3" data-theme="soft"></div>
  <div class="grid g3">
    <div class="card"><span class="tag" style="color:var(--purple)">Agent</span><h3>Planner</h3><p>Expands a 1–4 sentence prompt into a product spec: features, user stories, design. It stays at product level and leaves implementation to the generator. In the game run, one sentence became 16 features across ten sprints.</p></div>
    <div class="card"><span class="tag" style="color:var(--amber)">File</span><h3>Sprint contract</h3><p>Before any code is written, the generator and the evaluator agree what "done" means for the next piece of work and how it will be tested. The spec stays high level; the contract makes it testable.</p></div>
    <div class="card"><span class="tag" style="color:var(--green)">Agent</span><h3>Generator</h3><p>Builds one feature at a time against the contract, commits with git, checks its own work, then hands off to QA. It never signs off on its own work.</p></div>
    <div class="card"><span class="tag" style="color:var(--blue)">Agent</span><h3>Evaluator</h3><p>Clicks through the running app with Playwright (through an MCP server), testing the UI, the API and the database. It files every bug against the contract. One sprint alone had 27 criteria.</p></div>
    <div class="card"><span class="tag" style="color:var(--pink)">Rule</span><h3>Hard thresholds</h3><p>Each sprint is graded on product depth, functionality, visual design and code quality. A score below the bar on any one fails the sprint, and detailed feedback goes back to the generator.</p></div>
    <div class="card"><span class="tag" style="color:var(--teal)">Lesson</span><h3>Simplify as models improve</h3><p>Every part of a harness encodes an assumption about what the model can't do alone. With a stronger model, the team dropped sprints entirely and the generator built for over two hours in one go. Re-test each part when the model changes.</p></div>
  </div>
  <div class="card tablewrap"><table>
    <tr><th>Run</th><th>Time</th><th>Cost</th><th>Result</th></tr>
    <tr><td><b>Solo agent</b>, one-sentence prompt for a retro game maker</td><td>20 min</td><td>$9</td><td>Looked plausible; the game didn't respond to input</td></tr>
    <tr><td><b>Three-agent harness</b>, same prompt (sprints, Opus 4.5)</td><td>6 hr</td><td>$200</td><td>Playable game with far more features; the evaluator still missed some deeper bugs</td></tr>
    <tr><td><b>Simplified harness</b>, no sprints (Opus 4.6), a different prompt: an audio workstation in the browser</td><td>3 hr 50 min</td><td>$124.70</td><td>Working app; QA still caught real gaps in the first round</td></tr>
  </table></div>
  <p class="muted" style="font-size:13px">The harness costs far more than a solo run; it's worth it when a broken result costs more than the tokens. The third run built a different app, so don't read it as the same job done cheaper. Source: <a href="https://www.anthropic.com/research/harness-design-long-running-apps">Anthropic, Harness design for long-running application development</a> (March 2026).</p>
  <p>A prompt that sets up the same loop in a coding agent such as Claude Code. Fill in the three braces; the rest runs as written.</p>
  <pre class="code">THREE-AGENT HARNESS
{APP IN 1-4 SENTENCES} · {STACK} · {QUALITY BAR}

01 PLANNER
Expand {APP} into a product spec: features, user stories, design.
Stay at product level, no implementation details. Split into sprints.
02 CONTRACT
Before each sprint, write contract.md: what gets built, how it is tested.
The evaluator reviews it. Iterate until both agree on "done".
03 GENERATOR
Build one feature per sprint against the contract. Commit with git.
Self-check, then hand off to QA. Never sign off on your own work.
04 EVALUATOR
Click through the running app with Playwright, like a user would.
Test the UI, the API and the database. File every bug with file:line.
05 THRESHOLDS
Grade product depth, functionality, visual design, code quality.
Any score under {QUALITY BAR} fails the sprint. Feedback goes back.
06 LOOP
Fail, fix, retest. Update progress.md after every sprint.
Stop when every feature in the spec passes. Report cost and time.</pre>
'''
rep('''  <p class="muted" style="font-size:13px">As reported in the infographic, which rates its own confidence as medium for each case. Use them as directional, not as benchmarks.</p>
''', '''  <p class="muted" style="font-size:13px">As reported in the infographic, which rates its own confidence as medium for each case. Use them as directional, not as benchmarks. The Anthropic case is set out in full below.</p>
''' + HARN3)

# ---------------------------------------------------------------- MCP: community servers
MCPCOMM = '''  <h2>Community MCP servers worth a look</h2>
  <p>Each server below gives an agent one new skill. All are open source, published in October or November 2026, and young: treat them as experiments, not infrastructure.</p>
  <div class="card tablewrap"><table>
    <tr><th>Skill</th><th>Server</th><th>What it adds</th><th>Licence</th><th>Check first</th></tr>
    <tr><td>See</td><td><a href="https://github.com/anomalyco/browse"><b>browse</b></a> · anomalyco</td><td>The agent uses your real browser, through a Chromium extension</td><td>MIT</td><td>It acts in your signed-in sessions. Use a separate browser profile; read the install script before piping it to a shell</td></tr>
    <tr><td>Touch</td><td><a href="https://github.com/DIYgod/pinky"><b>Pinky</b></a> · DIYgod</td><td>The agent operates your iPhone or Android phone, with you in the loop</td><td>Apache-2.0</td><td>Phone access is broad. Approve each action and keep payment apps out of reach</td></tr>
    <tr><td>Remember</td><td><a href="https://github.com/finereli/whatsapp-mcp"><b>whatsapp-mcp</b></a> · finereli</td><td>Searches your own WhatsApp chats, read-only</td><td>MIT</td><td>Your messages, and other people's, go to the model. A hosted version exists; self-host for anything sensitive</td></tr>
    <tr><td>Plan</td><td><a href="https://github.com/emanuele-em/kanzo"><b>Kanzo</b></a> · emanuele-em</td><td>One self-hosted kanban board shared by you and your agents</td><td>AGPL-3.0</td><td>AGPL: modifying it and offering it as a service means sharing your changes</td></tr>
    <tr><td>Spot</td><td><a href="https://github.com/zhuyansen/new-term-radar"><b>new-term-radar</b></a> · zhuyansen</td><td>A daily radar for new AI model, product and repo names</td><td>MIT</td><td>Depends on scraping public sites; expect it to break when they change</td></tr>
    <tr><td>Study</td><td><a href="https://github.com/dansugc/reverse-engineer-marketing"><b>reverse-engineer-marketing</b></a> · dansugc</td><td>Paste a link, get the site's ads, SEO, social and funnel, with evidence</td><td>MIT</td><td>Use it on public information only and respect each site's terms</td></tr>
    <tr><td>Hear</td><td><a href="https://github.com/kanaworksai-hue/audio-studio-mcp"><b>audio-studio-mcp</b></a> · kanaworksai-hue</td><td>Songs, background music and sound effects made locally</td><td>MIT</td><td>Needs an Apple Silicon Mac or an NVIDIA GPU. Check each model's licence before commercial use</td></tr>
    <tr><td>Make</td><td><a href="https://github.com/GabrieleLozupone/kokon"><b>Kokon</b></a> · GabrieleLozupone</td><td>Edit photos by describing the change, on your own GPU</td><td>AGPL-3.0</td><td>A large local model download; AGPL applies as for Kanzo</td></tr>
  </table></div>
  <div class="callout"><b>Before installing any MCP server:</b> read its code or install script, run it with the fewest permissions and no production credentials, pin a version instead of tracking the latest, and check what data leaves your machine. A server's tool descriptions go straight into the model's context, so a malicious one can steer the agent. See <a href="#ai-security">attacks on agent tools &amp; MCP</a>.</div>
  <p class="muted" style="font-size:13px">From a community round-up ("8 free MCP servers"). Repositories, owners and licences were checked on GitHub on 27 Nov 2026; the "Check first" notes are this site's.</p>
  <h2>Governance</h2>'''
rep('''  <h2>Governance</h2>
  <div class="card"><p style="margin:0">MCP is an open standard.''', MCPCOMM + '''
  <div class="card"><p style="margin:0">MCP is an open standard.''')

# Cross-links
rep('''Measure merged pull requests and review time for a month before widening. See <a href="#llmops">ADLC &amp; LLMOps</a>.</div>''',
    '''Measure merged pull requests and review time for a month before widening. See <a href="#llmops">ADLC &amp; LLMOps</a>. For long, multi-hour builds, see the <a href="#harness">three-agent harness</a> (planner, generator, evaluator).</div>''')
rep('''check the original reports before quoting them. See also <a href="#guardrails">guardrails</a> and <a href="#jev">bounded evaluators</a>.</p>''',
    '''check the original reports before quoting them. See also <a href="#guardrails">guardrails</a>, <a href="#jev">bounded evaluators</a> and <a href="#hitl-controls">eight human-in-the-loop controls</a>.</p>''')
rep('''<a href="#agent-runtime">Agents in production</a> · <a href="#harness">Harness engineering</a></p>''',
    '''<a href="#agent-runtime">Agents in production</a> · <a href="#harness">Harness engineering</a> · <a href="#ai-system-design">AI system design: six layers</a></p>''')

# ---------------------------------------------------------------- diagrams
DEFS = r"""
DEFS.sysdesign={vb:[1000,320],title:'Six layers of AI system design',nodes:[Q('l1',10,30,'1 Scale & speed','cache · scale','blue','Load balancing, caching, auto-scaling and rate limiting.',150,70),
 Q('l2',175,30,'2 Data & retrieval','SQL · vectors','orange','Databases, sharding, vector databases and hybrid search.',150,70),
 Q('l3',340,30,'3 Reliable','queues · retry','teal','Replication, queues, retry with backoff and failover.',150,70),
 Q('l4',505,30,'4 AI & tools','RAG · agents','amber','RAG, MCP and tools, agent memory and model routing.',150,70),
 Q('l5',670,30,'5 Secure & govern','identity · audit','purple','OAuth and JWT, zero trust, guardrails and audit logs.',150,70),
 Q('l6',835,30,'6 Observe & evaluate','traces · evals','green','Tracing, SLOs, LLM evals and token cost.',155,70),
 Q('o1',10,215,'Stays fast','as users grow','blue','Outcome of layer 1.',150,62),
 Q('o2',175,215,'Finds data fast','store · retrieve','orange','Outcome of layer 2.',150,62),
 Q('o3',340,215,'Survives failures','and spikes','teal','Outcome of layer 3.',150,62),
 Q('o4',505,215,'AI that works','looks up · acts','amber','Outcome of layer 4.',150,62),
 Q('o5',670,215,'Safe & auditable','data · decisions','purple','Outcome of layer 5.',150,62),
 Q('o6',835,215,'Measured','quality · cost','green','Outcome of layer 6.',155,62)],
 edges:[E('l1','l2'),E('l2','l3'),E('l3','l4'),E('l4','l5'),E('l5','l6'),E('l1','o1',{dash:1}),E('l2','o2',{dash:1}),E('l3','o3',{dash:1}),E('l4','o4',{dash:1}),E('l5','o5',{dash:1}),E('l6','o6',{dash:1})],
 steps:[{title:'Scale & speed',n:['l1'],e:['l1>o1'],t:'Stay fast as users grow. Rate-limit tokens, not only requests.'},{title:'Data & retrieval',e:['l1>l2','l2>o2'],t:'Store and find data fast. Hybrid search usually beats vectors alone.'},{title:'Reliable systems',e:['l2>l3','l3>o3'],t:'Survive failures and spikes. Make tool writes idempotent before you retry them.'},{title:'AI & agents',e:['l3>l4','l4>o4'],t:'RAG, tools, memory and routing sit on the layers below.'},{title:'Security & governance',e:['l4>l5','l5>o5'],t:'Agents get their own identity, narrow permissions and an audit trail.'},{title:'Observe & evaluate',e:['l5>l6','l6>o6'],t:'Measure quality, cost and speed on every release.'}]};
DEFS.hitl={vb:[1000,330],title:'Human-in-the-loop controls on one agent action',nodes:[Q('ag',10,130,'Agent proposes','action + confidence','gray','The agent prepares an action, with its evidence and how sure it is.',150,70),
 Q('rt',185,130,'Route by risk','tier · confidence','purple','Risk tier, confidence and business rules decide which path the action takes.',160,70),
 Q('auto',375,20,'Straight through','low risk · confident','green','Low-risk, high-confidence actions run without waiting for a person.',160,62),
 Q('gate',375,134,'Approval gate','one or two people','blue','A person approves; for the top tier, two different people must (dual control).',160,62),
 Q('exq',375,248,'Exception queue','escalation ladder','amber','Rule failures and triggers park the case for a person, up a ladder with full context.',160,62),
 Q('ex',575,130,'Execute','within limits','teal','The action runs with the narrowest permissions it needs.',150,70),
 Q('samp',775,20,'Sampled review','weekly slice','green','Reviewers score a random slice of what ran and feed failures back into evals and prompts.',170,62),
 Q('log',775,134,'Audit replay','every step logged','orange','Prompt, data, tool calls and output in a tamper-proof trace that can be replayed.',170,62),
 Q('kill',775,248,'Kill switch','cost · errors · drift','pink','A breach of any limit pauses the agent and hands the work back to people.',170,62)],
 edges:[E('ag','rt'),E('rt','auto'),E('rt','gate'),E('rt','exq'),E('auto','ex'),E('gate','ex'),E('exq','ex',{dash:1,l:'resolved'}),E('ex','log'),E('log','samp'),E('kill','ex',{dash:1,l:'pause'})],
 steps:[{title:'Agent proposes',n:['ag'],t:'An action, the evidence behind it and a confidence score.'},{title:'Route by risk',e:['ag>rt'],t:'Match the control to the risk tier, not to the technology.'},{title:'Straight through',e:['rt>auto','auto>ex'],t:'Low risk and confident: no waiting. Calibrate the threshold on real outcomes.'},{title:'Approve first',e:['rt>gate','gate>ex'],t:'Payments, contracts, customer messages. Two people for the top tier.'},{title:'Exceptions and escalation',e:['rt>exq','exq>ex'],t:'Missing data, policy flags or an angry customer go to a person with full context.'},{title:'Log and replay',e:['ex>log'],t:'Every step in a tamper-proof trace, including tool calls and retrieved data.'},{title:'Review a sample',e:['log>samp'],t:'A random slice every week keeps straight-through honest.'},{title:'Kill switch',e:['kill>ex'],t:'Always on. Rehearse it before you need it.'}]};
DEFS.harn3={vb:[1000,320],title:'Three agents around one prompt',nodes:[Q('pr',15,125,'Prompt','1-4 sentences','gray','The app in a few sentences, the stack and the quality bar.',140,70),
 Q('pl',190,125,'Planner','product spec','purple','Expands the prompt into features, user stories and design, split into sprints.',150,70),
 Q('sp',375,125,'Spec','features · sprints','gray','A product-level spec: what to build, not how.',150,70),
 Q('gen',570,125,'Generator','one feature · git','green','Builds one feature at a time, commits, self-checks and hands off to QA.',160,70),
 Q('ct',570,245,'Sprint contract','what done means','amber','Generator and evaluator agree what gets built and how it is tested, before any code.',160,62),
 Q('ev',790,125,'Evaluator','uses the app','blue','Clicks through the app with Playwright and tests the UI, API and database.',180,70),
 Q('th',790,15,'Hard thresholds','four scores','pink','Any score below the bar fails the sprint.',180,62),
 Q('done',790,245,'Done','every feature passes','teal','Stop when the whole spec passes; report cost and time.',180,62)],
 edges:[E('pr','pl'),E('pl','sp'),E('sp','gen'),E('gen','ct',{bi:1}),E('ct','ev',{dash:1,l:'tests'}),E('gen','ev'),E('ev','th'),E('th','gen',{dash:1,l:'fail'}),E('ev','done')],
 steps:[{title:'Prompt',n:['pr'],t:'One to four sentences, a stack and a quality bar.'},{title:'Plan',e:['pr>pl','pl>sp'],t:'Ambitious scope, product level, no implementation details.'},{title:'Agree the contract',e:['sp>gen','gen>ct','ct>ev'],t:'What done means for this sprint, and how it will be tested.'},{title:'Build',e:['gen>ev'],t:'One feature, committed with git, then handed to QA.'},{title:'Evaluate',e:['ev>th'],t:'The evaluator uses the app like a user and grades it against hard thresholds.'},{title:'Fail and fix',e:['th>gen'],t:'Any score under the bar sends detailed feedback back to the generator.'},{title:'Done',e:['ev>done'],t:'Stop when every feature in the spec passes. Report cost and time.'}]};
""".strip('\n') + '\n'
rep('DEFS.idp={', DEFS + 'DEFS.idp={')

# ---------------------------------------------------------------- data
# References
rep(" dun:['Dunlosky et al.", " harn3:['Anthropic, Harness design for long-running application development (2026)','https://www.anthropic.com/research/harness-design-long-running-apps'],\n dun:['Dunlosky et al.")
rep("'agent-runtime':['wimse','rfc8693','oidc']};", "'agent-runtime':['wimse','rfc8693','oidc'],\n 'ai-system-design':['sre','otel','owasp'],'hitl-controls':['euai','rmf','owasp'],'harness':['harn3','bea']};")

# Review tracker
rep("const REVIEW={", "const REVIEW={'ai-system-design':['2026-11-27','Building blocks per layer and their LLM-specific changes'],'hitl-controls':['2026-11-27','Oversight controls and EU AI Act human-oversight duties'],")

# Changelog
rep("const CHANGES=[", "const CHANGES=[{v:'24',d:'2026-11-27',t:'System design layers, human-in-the-loop controls, three-agent harness',items:['New page: AI system design in six layers (scale, data, reliability, AI and agents, security, observability), with what changes when a model is inside','New page: eight human-in-the-loop controls for agents, matched to risk tiers','Harness engineering: the planner, generator and evaluator harness, with its costs and a prompt to set it up','MCP: eight community servers, with licences and what to check before installing','3 new AI Acumen terms']},")

# Learning paths
rep("'fde','fde-discovery','data-readiness','decide','reference-arch',", "'fde','fde-discovery','data-readiness','decide','reference-arch','ai-system-design',")
rep("'cx-migration','data-readiness','guardrails','usecase-roi','decide']", "'cx-migration','data-readiness','guardrails','hitl-controls','usecase-roi','decide']")

# Glossary (AI Acumen)
rep("['Human-in-the-loop','agent',1,'Approval gates and escalation for high-stakes or uncertain actions.','d','agent-governance']",
    "['Human-in-the-loop','agent',1,'Approval gates and escalation for high-stakes or uncertain actions.','d','hitl-controls']")
NEW_TERMS = r"""['Confidence routing','agent',2,'Sending only an agent\'s low-confidence outputs to a person and letting the rest run automatically.','d','hitl-controls'],
['Kill switch','sec',1,'A monitored limit on cost, errors or drift that pauses an agent and hands its work back to people.','d','hitl-controls'],
['Sprint contract','agent',3,'An agreement between a generator agent and an evaluator agent on what done means for the next piece of work, written before any code.','d','patterns'],
"""
i = s.index('const AC=[')
j = s.index('\n];', i)
s = s[:j] + '\n' + NEW_TERMS.rstrip('\n').rstrip(',') + ',' + s[j:]

SRC.write_text(s, encoding='utf-8')
print('applied: 2 pages, 2 sections,', len(NEW_TERMS.strip().splitlines()), 'terms')
