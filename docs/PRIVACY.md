# Privacy and Data Handling

This plugin creates a text value containing selected files from a directory supplied to the tool. It does not intentionally transmit data to a remote service, write a snapshot to disk, modify source files, or execute project files.

Important considerations:

- The output can contain proprietary code, internal endpoints, sample data, or secrets.
- Default exclusions and filename heuristics cannot guarantee complete secret removal.
- `.gitignore` support is best-effort.
- Only point the tool at directories you are authorized to inspect.
- Review `includedFiles`, `skippedFiles`, and snapshot contents before sharing the output with a model or external service.
- The available filesystem paths and permissions are controlled by the DSH host, not granted by this plugin.
