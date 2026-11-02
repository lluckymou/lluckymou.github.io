# Monaco Editor ESM slice

This folder is a local dependency slice of the vendored Monaco Editor 0.57.0 package. The files are copied from the package's `esm-browser` tree and retain the package license and notices in the parent directory.

The JavaScript slice is the static import closure of the app's editor API, JavaScript language definition, editor core commands, comment, hover, multi-cursor, word navigation, find, suggest, parameter-hint registrations, the suggest controller used by custom sBotics completion providers, and the editor worker. Monaco's TypeScript language services are not included because the app does not use them. The codicon font is retained for Monaco's editor icons.

This is a file-level slice, not a transformed or minified build. If imports or Monaco version change, regenerate and recheck the dependency closure before removing unused package files.
