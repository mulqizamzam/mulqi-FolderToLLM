# Conversion Report

## Source and target

- Source: https://github.com/EdgeTypE/FolderToLLM
- Source ref inspected: `main`, commit `95303747f81e1cd372a176bb883e599b35a95bea`
- Target: `mulqi-folder-to-llm`
- Target version: `0.2.1-rc.2`
- Host target: DeepSeek Harness (DSH) `0.2.1-rc.2`

## Discovery summary

The upstream repository is a PowerShell/Windows utility for recursively scanning a project directory and aggregating directory structure plus selected text file contents. Important workflows identified in its README and scripts:

- tree output
- file content aggregation
- include/exclude folder filters
- include/exclude extension filters
- min/max byte size filters
- `.gitignore`-derived exclusion hints
- common generated/binary exclusions
- persistent configuration and interactive menu

## Candidate dispositions

| Candidate | Disposition | Rationale |
|---|---|---|
| Tree and file-content aggregation | compile_skill + DSH tool | Core user outcome; reimplemented in Node.js for portability and host tool invocation |
| Folder/extension/size filters | preserve behavior | Core filtering controls retained in the DSH packager |
| `.gitignore` handling | compile | Implemented best-effort; not a complete Git pattern engine |
| Binary/large file skipping | preserve and harden | Bounded output, binary heuristics, and file size defaults |
| PowerShell menu / Windows BAT wrapper | discard | Platform-specific CLI UX does not map to DSH tools |
| Saved PowerShell config | reference_only | DSH tool arguments and documented safe defaults replace machine-local menu config |
| Example output file | discard | Avoid committing a potentially misleading or stale snapshot from a user project |

## Architecture

Hybrid: DSH plugin tool registrations + one reference Skill + beginner docs. No MCP server or remote service is required.

## Host/workspace contract

- Read operations: core workflow.
- Directory traversal: only paths accessible to the DSH host.
- Mutations: none.
- Shell and Python: not invoked by the plugin itself.
- Plugin does not grant new filesystem capabilities.

## Security and residual risk

- `.gitignore` support is best-effort, not a full specification implementation.
- Secret-name checks are heuristic and can miss credentials stored in ordinary filenames/content.
- Source contents can include proprietary information; users should review before sharing.
- Files are not written, executed, deleted, or uploaded by this plugin.
- Runtime compatibility still needs a smoke test against an actual DSH `0.2.1-rc.2` installation.

## Status

- Discovery completed: yes
- DSH package shape created: yes
- Local tests/validation: recorded in `docs/VALIDATION.md`
- Public repository publication: pending/partial until all intended files are committed and metadata is verified
- DSH live smoke test: not executed in this environment
