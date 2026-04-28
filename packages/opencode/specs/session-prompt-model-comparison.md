# Session Prompt Model Comparison

This note explains why `packages/opencode/src/session/prompt/` contains multiple prompt files, how prompt selection works, when each prompt is used, and how the model-family prompts differ.

## Overview

`packages/opencode/src/session/prompt/` is not a directory of interchangeable prompts for every request.

It contains three categories:

1. Model-family base prompts
2. Runtime state reminders appended conditionally
3. A couple of files that appear unused in the current code path

A normal request usually gets exactly one base prompt, chosen in `packages/opencode/src/session/llm.ts:104` via `SystemPrompt.provider(...)` in `packages/opencode/src/session/system.ts:20`.

## Why There Are Multiple Prompt Files

Different model families respond better to different instruction styles.

OpenCode uses provider- and model-specific system prompts to compensate for differences in:

- autonomy
- verbosity
- tool-use behavior
- planning discipline
- appetite for parallelism
- safety and guardrails

Some files in the directory are not provider prompts at all. They are temporary control prompts injected at runtime for plan mode, build mode, or max-step handling.

## Prompt Selection Path

Base prompt selection happens here:

- `packages/opencode/src/session/system.ts:20`

That selected prompt is only used if the active agent does not already define its own prompt:

- `packages/opencode/src/session/llm.ts:104`

This means the prompts in `session/prompt/` mainly apply to agents like `build`, `plan`, and `general`.

Some agents bypass these model-family prompts entirely because they have explicit agent prompts:

- `explore`: `packages/opencode/src/agent/agent.ts:185`
- `compaction`: `packages/opencode/src/agent/agent.ts:195`
- `title`: `packages/opencode/src/agent/agent.ts:219`
- `summary`: `packages/opencode/src/agent/agent.ts:234`

## Prompt Files And When They Are Used

| File                          | Type                     | Used when                                                                            | Source                                                                                                                                      |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `default.txt`                 | Base prompt              | Fallback when no model-specific branch matches                                       | `packages/opencode/src/session/system.ts:33`                                                                                                |
| `anthropic.txt`               | Base prompt              | Model id contains `claude`                                                           | `packages/opencode/src/session/system.ts:30`                                                                                                |
| `gemini.txt`                  | Base prompt              | Model id contains `gemini-`                                                          | `packages/opencode/src/session/system.ts:29`                                                                                                |
| `kimi.txt`                    | Base prompt              | Model id contains `kimi`                                                             | `packages/opencode/src/session/system.ts:32`                                                                                                |
| `trinity.txt`                 | Base prompt              | Model id contains `trinity`                                                          | `packages/opencode/src/session/system.ts:31`                                                                                                |
| `gpt.txt`                     | Base prompt              | Model id contains `gpt`, except earlier `gpt-4`/`o1`/`o3` match and except `codex`   | `packages/opencode/src/session/system.ts:21`, `packages/opencode/src/session/system.ts:23`                                                  |
| `codex.txt`                   | Base prompt              | Model id contains both `gpt` and `codex`                                             | `packages/opencode/src/session/system.ts:24`                                                                                                |
| `beast.txt`                   | Base prompt              | Model id contains `gpt-4`, `o1`, or `o3`                                             | `packages/opencode/src/session/system.ts:21`                                                                                                |
| `plan.txt`                    | Runtime reminder         | Appended when active agent is `plan` and experimental plan mode is off               | `packages/opencode/src/session/prompt.ts:230`, `packages/opencode/src/session/prompt.ts:231`, `packages/opencode/src/session/prompt.ts:237` |
| `build-switch.txt`            | Runtime reminder         | Appended when the conversation switches from `plan` to `build`                       | `packages/opencode/src/session/prompt.ts:241`, `packages/opencode/src/session/prompt.ts:242`, `packages/opencode/src/session/prompt.ts:248` |
| `max-steps.txt`               | Runtime reminder         | Injected on the last allowed loop step so the model stops using tools and summarizes | `packages/opencode/src/session/prompt.ts:1497`                                                                                              |
| `copilot-gpt-5.txt`           | Unclear / appears unused | No active references found in the current repo                                       | no matches found                                                                                                                            |
| `plan-reminder-anthropic.txt` | Unclear / appears unused | No active references found in the current repo                                       | no matches found                                                                                                                            |

## High-Level Differences Between Model Families

The main differences are in system prompt strategy, not just in raw model capability.

- `gpt.txt`: current house-style prompt, tightly aligned with OpenCode's preferred workflow
- `beast.txt`: more forceful and autonomous, aimed at stronger OpenAI reasoning models
- `codex.txt`: similar target to `gpt.txt`, but written around Codex-style tooling and response formatting
- `anthropic.txt`: heavier on todo/task management and objective code-review behavior
- `gemini.txt`: more procedural and safety-explicit, especially around shell commands and file paths
- `kimi.txt`: action-first, minimal, and strongly biased toward actually doing the work with tools
- `trinity.txt`: highly constrained, especially around tool cadence
- `default.txt`: generic fallback prompt

## By Model Family

- `beast.txt` for `gpt-4`, `o1`, and `o3`: `packages/opencode/src/session/system.ts:21`
- `codex.txt` for `gpt*codex*`: `packages/opencode/src/session/system.ts:24`
- `gpt.txt` for other `gpt*`: `packages/opencode/src/session/system.ts:23`
- `gemini.txt` for `gemini-*`: `packages/opencode/src/session/system.ts:29`
- `anthropic.txt` for `claude*`: `packages/opencode/src/session/system.ts:30`
- `trinity.txt` for `*trinity*`: `packages/opencode/src/session/system.ts:31`
- `kimi.txt` for `*kimi*`: `packages/opencode/src/session/system.ts:32`
- `default.txt` otherwise: `packages/opencode/src/session/system.ts:33`

## Key Behavioral Differences

### Autonomy

- `beast.txt` is the most aggressive: keep going until fully solved, mandatory iteration, repeated testing, and strong no-stop-until-done language. See `packages/opencode/src/session/prompt/beast.txt:5`, `packages/opencode/src/session/prompt/beast.txt:24`.
- `gpt.txt` is also autonomous, but more pragmatic and repo-aware. See `packages/opencode/src/session/prompt/gpt.txt:15`.
- `gemini.txt` is more structured and approval-oriented, especially for new apps. See `packages/opencode/src/session/prompt/gemini.txt:18`, `packages/opencode/src/session/prompt/gemini.txt:31`.
- `kimi.txt` defaults to action for anything beyond simple questions. See `packages/opencode/src/session/prompt/kimi.txt:7`.

### Tool Orchestration

- `gpt.txt` explicitly prefers `Glob` and `Grep` and strongly prefers `multi_tool_use.parallel`. See `packages/opencode/src/session/prompt/gpt.txt:5`.
- `anthropic.txt` strongly prefers `Task` for broader exploration and says to use `TodoWrite` very frequently. See `packages/opencode/src/session/prompt/anthropic.txt:23`, `packages/opencode/src/session/prompt/anthropic.txt:79`, `packages/opencode/src/session/prompt/anthropic.txt:96`.
- `trinity.txt` is the outlier: it says to use exactly one tool per assistant message. See `packages/opencode/src/session/prompt/trinity.txt:84`.
- `gemini.txt` allows parallelism but is otherwise more procedural. See `packages/opencode/src/session/prompt/gemini.txt:52`.
- `kimi.txt` encourages parallel calls and tells the model not to explain tool calls. See `packages/opencode/src/session/prompt/kimi.txt:9`, `packages/opencode/src/session/prompt/kimi.txt:13`.

### Research Expectations

- `beast.txt` is the strongest here: it says the problem cannot be solved without extensive internet research and even instructs the model to search Google for third-party usage. See `packages/opencode/src/session/prompt/beast.txt:11`, `packages/opencode/src/session/prompt/beast.txt:17`, `packages/opencode/src/session/prompt/beast.txt:68`.
- `anthropic.txt` and `default.txt` only require `WebFetch` for OpenCode/docs-oriented questions. See `packages/opencode/src/session/prompt/anthropic.txt:12`, `packages/opencode/src/session/prompt/default.txt:9`.
- `gemini.txt` and `kimi.txt` allow research when needed, but do not force it in the same way. See `packages/opencode/src/session/prompt/gemini.txt:20`, `packages/opencode/src/session/prompt/kimi.txt:53`.

### Task Tracking

- `anthropic.txt` is the strongest on todos: frequent `TodoWrite`, mark items complete immediately, use it for planning. See `packages/opencode/src/session/prompt/anthropic.txt:23`, `packages/opencode/src/session/prompt/anthropic.txt:27`.
- `beast.txt` also wants a todo list, but as markdown in the response rather than the repo's structured tool discipline. See `packages/opencode/src/session/prompt/beast.txt:42`, `packages/opencode/src/session/prompt/beast.txt:76`.
- `gpt.txt` does not force todo use by default.
- `trinity.txt` does not emphasize todos much; its main control is serialized tool use.

### Communication Style

- `default.txt` and `trinity.txt` are extremely terse: fewer than 4 lines, almost no preamble or postamble. See `packages/opencode/src/session/prompt/default.txt:19`, `packages/opencode/src/session/prompt/trinity.txt:11`.
- `gpt.txt` is concise but allows fuller structured explanations when useful. See `packages/opencode/src/session/prompt/gpt.txt:60`, `packages/opencode/src/session/prompt/gpt.txt:101`.
- `codex.txt` has the most explicit final-answer formatting rules. See `packages/opencode/src/session/prompt/codex.txt:38`, `packages/opencode/src/session/prompt/codex.txt:61`.
- `beast.txt` asks for a concise sentence before each tool call. See `packages/opencode/src/session/prompt/beast.txt:20`.

### Editing Philosophy

- `gpt.txt` is the closest to the repo's current editing norms: minimal changes, `apply_patch`, avoid unnecessary abstraction, avoid casual compatibility code. See `packages/opencode/src/session/prompt/gpt.txt:8`, `packages/opencode/src/session/prompt/gpt.txt:23`.
- `codex.txt` is similar, but more permissive about using something other than `apply_patch` if needed. See `packages/opencode/src/session/prompt/codex.txt:5`.
- `gemini.txt` is more generic about following local conventions and verifying libraries first. See `packages/opencode/src/session/prompt/gemini.txt:5`.
- `kimi.txt` emphasizes minimal intrusive changes and tool-backed edits. See `packages/opencode/src/session/prompt/kimi.txt:36`, `packages/opencode/src/session/prompt/kimi.txt:42`.

### Git And Safety

- `gpt.txt` has detailed git hygiene and non-destructive rules. See `packages/opencode/src/session/prompt/gpt.txt:29`.
- `codex.txt` has a shorter version of the same. See `packages/opencode/src/session/prompt/codex.txt:17`.
- `kimi.txt` is stricter about git mutations: do not commit, push, reset, or rebase unless explicitly asked, and ask each time. See `packages/opencode/src/session/prompt/kimi.txt:45`.
- `gemini.txt` is strongest on explaining filesystem-modifying shell commands before running them. See `packages/opencode/src/session/prompt/gemini.txt:49`.

## Comparison Table: Model Families

| Model family        | Prompt file     | Autonomy    | Tool style                                                           | Todo/task style                                   | Web research                       | Response style                         | Notable quirks                                                           |
| ------------------- | --------------- | ----------- | -------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `gpt-4`, `o1`, `o3` | `beast.txt`     | Very high   | Many tools, iterative, explicit before each tool call                | Markdown todo mindset, complete-all-steps framing | Strongly required                  | Concise but thorough                   | Pushes repeated testing and says internet research is mandatory          |
| other `gpt*`        | `gpt.txt`       | High        | Prefer `Glob` and `Grep`, strongly prefers `multi_tool_use.parallel` | No forced todo default                            | Optional, as needed                | Direct, structured, repo-specific      | Best aligned with current OpenCode house rules                           |
| `gpt*codex*`        | `codex.txt`     | High        | Prefer specialized tools, parallel when possible                     | No forced todo default                            | Optional                           | Concise with strong final-format rules | Similar to `gpt.txt` but more Codex-oriented formatting and presentation |
| `claude*`           | `anthropic.txt` | Medium-high | Prefer `Task` for exploration, parallel when possible                | Very strong `TodoWrite` emphasis                  | Mostly for OpenCode/docs questions | Short, CLI-friendly                    | Heavy task-tracking and objective code-review guidance                   |
| `gemini-*`          | `gemini.txt`    | Medium      | Procedural, parallel allowed, explicit path and shell safety         | Planning encouraged, not forced                   | Optional                           | Minimal, professional                  | Most explicit about explaining modifying shell commands                  |
| `*kimi*`            | `kimi.txt`      | High        | Action-first, encourages parallel tool calls                         | Minimal-change bias, no strong todo requirement   | Optional                           | Very terse, same language as user      | Defaults to acting rather than explaining                                |
| `*trinity*`         | `trinity.txt`   | Medium      | Serialized: one tool per assistant message                           | Low emphasis                                      | Optional                           | Extremely terse                        | Outlier: explicitly forbids parallel tool use                            |
| fallback            | `default.txt`   | Medium      | Generic tooling guidance                                             | Low emphasis                                      | Mostly for OpenCode/docs questions | Extremely terse                        | Basic compatibility fallback                                             |

## Comparison Table: Relative Operating Characteristics

This table includes `default.txt` as the baseline.

| Model family        | Prompt file     | Planning rigor | Autonomy    | Parallelism | Verbosity  | Safety / guardrails | Todo emphasis | Web research pressure | Repo-specific fit |
| ------------------- | --------------- | -------------- | ----------- | ----------- | ---------- | ------------------- | ------------- | --------------------- | ----------------- |
| fallback            | `default.txt`   | Medium         | Medium      | Medium      | Very low   | Medium              | Low           | Low                   | Low               |
| `gpt-4`, `o1`, `o3` | `beast.txt`     | Very high      | Very high   | High        | Medium     | Medium              | Medium        | Very high             | Low               |
| other `gpt*`        | `gpt.txt`       | High           | High        | Very high   | Low-medium | High                | Low           | Low                   | Very high         |
| `gpt*codex*`        | `codex.txt`     | High           | High        | High        | Low-medium | High                | Low           | Low                   | High              |
| `claude*`           | `anthropic.txt` | High           | Medium-high | High        | Low        | Medium              | Very high     | Low                   | Medium            |
| `gemini-*`          | `gemini.txt`    | High           | Medium      | Medium-high | Very low   | Very high           | Medium        | Low-medium            | Medium            |
| `*kimi*`            | `kimi.txt`      | Medium         | High        | High        | Very low   | Medium-high         | Low           | Low-medium            | Medium            |
| `*trinity*`         | `trinity.txt`   | Medium         | Medium      | Very low    | Very low   | Medium              | Low           | Low                   | Low-medium        |

## Compared To `default.txt`

- `gpt.txt`: more repo-aware, much stronger parallel-tool guidance, better aligned with current OpenCode workflow
- `beast.txt`: far more aggressive about autonomy, testing, and internet research
- `codex.txt`: stronger formatting and workspace hygiene, but less repo-specific than `gpt.txt`
- `anthropic.txt`: much heavier on `TodoWrite` and `Task` delegation
- `gemini.txt`: more procedural and safer around shell and file operations than `default.txt`
- `kimi.txt`: more action-oriented than `default.txt`; defaults to doing rather than explaining
- `trinity.txt`: stricter than `default.txt` operationally because it serializes tool use

## Practical Interpretation

- Best general prompt: `gpt.txt`
- Most forceful and autonomous: `beast.txt`
- Best for explicit task tracking: `anthropic.txt`
- Most cautious and procedural: `gemini.txt`
- Most restrictive operationally: `trinity.txt`
- Best fallback baseline: `default.txt`

## Notes

- The model-family prompt is only one part of the final system prompt. Additional environment, skills, instructions, and runtime reminders are assembled later in `packages/opencode/src/session/prompt.ts:1481`.
- Structured-output requests add an extra system instruction at runtime. See `packages/opencode/src/session/prompt.ts:1489`.
- The current repo appears to include two prompt files with no active references: `copilot-gpt-5.txt` and `plan-reminder-anthropic.txt`.
