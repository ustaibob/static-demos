# Dispatch Day: AI prompts and guardrails

AI never sets charger status, prices, queue waits, delivery windows, scores or grades. The engine (engine.py) applies every effect. All AI text is cached per team instance (same seed gives same text) and checked against a schema and leak list before display. On timeout or rejection, the stored fallback wording is shown.

## 1. Scenario skin

```text
You rename places in a delivery-route simulation.
Company type: coffee roaster. Team intake blocks: {intake_blocks}.
Return JSON: {"company": str, "stops": {"S1": str, ... "S14": str}, "chargers": {"C1": str, "C2": str, "C3": str}}.
Rules: invented business names only, no real brands or chains. Cafes stay cafes, grocers stay grocers,
hospital cafe stays a hospital cafe. Do not output any numbers, times, distances or prices.
```
Fallback: the default names in the scenario JSON.

## 2. Dispatch message phrasing (Challenge, round 2 only)

```text
You write one in-world dispatch message for a delivery-planning simulation.
Company: {company}. Channel: {channel}. Template summary: {summary}.
Reliability cues to preserve: {cues}.
Rules: 60 words or fewer. Sound like the channel (a status email, a text, a headline, a group chat).
Keep every reliability cue. Do not say whether the message is true or whether it matters today.
Do not add numbers that are not in the summary. Do not use the words signal, noise, trap, truth or real.
Return only the message.
```
Leak check rejects: truth words, any number not in {summary}, any advice ("you should").
Fallback: the template summary, prefixed with the channel (e.g. "Status email: ...").

## 3. Reveal narration (Reveal 1 and Reveal 2)

```text
You explain a route-planning result to one student team in plain language.
Inputs (from the engine, do not change any value): {team_log}, {engine_result}, {scorecard}, {failure_map}.
Write 3 to 5 sentences: what the team predicted, what happened, which constraint bound
(range, charger detour, charger wait, dwell time, delivery window), and which SCOR attribute moved most.
Quote the team's own log entry ID once. Do not grade, praise or blame. Do not suggest a better plan.
```
Fallback: a templated sentence set filled from {failure_map} ("Predicted {p_cost}, actual {cost}. Binding constraint: {constraint} at {node}.").

## 4. Instructor debrief clusters

```text
Group these rationales by reasoning pattern. Allowed labels: per-mile only; range-aware;
charger-availability-aware; window-aware; chased the message; ignored the message; weighed source reliability.
Return JSON: [{"label": str, "log_ids": [..], "example_quote": str}]. Quote students exactly. No grades.
```

## 5. Reflection coach (optional, off by default)

```text
A student wrote this reflection: {reflection}. Their log entries: {log}.
Ask exactly one probing question that pushes them to connect a specific log entry to a SCOR attribute
or to the binding constraint. Do not rewrite, evaluate or grade their writing.
```
