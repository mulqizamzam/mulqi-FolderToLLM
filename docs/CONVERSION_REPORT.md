# Conversion Report

## Source and target

- Source: https://github.com/EdgeTypE/FolderToLLM
- Source ref inspected: `main`, commit `95303747f81e1cd372a176bb883e599b35a95bea`
- Target: `mulqizamzam/mulqi-FolderToLLM`
- Package: `mulqi-folder-to-llm@0.2.1-rc.2`
- Host target: DeepSeek Harness (DSH) `0.2.1-rc.2`

## Discovery summary

The upstream repository is a PowerShell/Windows utility for recursively scanning a project directory and aggregating directory structure plus selected text file contents. The workflows reviewed included directory-tree output, file aggregation, folder and extension filters, min/max file size filters, best-effort `.gitignore` exclusions, common generated/binary exclusions, saved configuration, and an interactive menu.

## Candidate dispositions

| Candidate | Disposition | Rationale |
|---|---|---|
| Tree and file-content aggregation | Compile into DSH tool | Core outcome retained as a local read-only snapshot tool |
| Folder, path, extension, and size filters | Preserve | Required to limit relevant context |
| `.gitignore` handling | Compile | Best-effort parser; not a full Git implementation |
| Binary and large-file skipping | Preserve/harden | Bounded output, binary heuristics, and default exclusions |
| PowerShell menu / Windows BAT wrapper | Discard | Windows-specific UX does not map to native DSH tools |
| Saved PowerShell config | Reference only | DSH tool arguments and bundle defaults replace machine-local menu state |
| Example output fixture from source repo | Discard | Avoid carrying stale or potentially sensitive snapshots |

## Architecture

Hybrid: DSH tool registrations plus one Skill and beginner documentation. No MCP server or remote service is required.

## Host/workspace contract

- Filesystem access is provided and constrained by the DSH host and OS permissions.
- Tool reads a caller-specified root and emits a bounded text value.
- Source files are not written, deleted, or executed.
- No remote upload is performed by this plugin.
- Symlinks and include/exclude paths that escape the root are rejected/skipped.

## Security and residual risk

- `.gitignore` support is best-effort and may differ from Git's full ignore semantics.
- Sensitive-name detection cannot catch credentials inside arbitrary filenames or normal source text.
- Project snapshots may contain proprietary source or data and must be reviewed before sharing.
- CI/unit tests and package validation do not prove runtime compatibility with every DSH build.
- DSH live smoke test on version `0.2.1-rc.2` remains outstanding.

## Publication state

- Public repository: created and reachable.
- Package manifest, registry patch, DSH entrypoint, context packager, Skill, README, beginner guide, logo assets, tests, validation script, CI, license and privacy documentation: committed to `main`.
- GitHub Actions CI: latest run was queued/in progress at last inspection; a final green result must be checked.
- Repository Description metadata: still needs the professional Description field applied in GitHub repository settings because the available connector exposes file writes but not repository metadata updates.
