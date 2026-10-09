// Package webui embeds the React single-page admin interface and serves it
// from the headscale binary itself under /ui.
//
// The compiled frontend is produced by `make web` (which builds the project
// under web/) into hscontrol/webui/dist. A .gitkeep is kept so the embed
// always resolves; if the real build has not run, the handler falls back to an
// inline message instructing the operator to run `make build`.
package webui

import "embed"

//go:embed dist
var distFS embed.FS

// Dist exposes the embedded filesystem for tests or advanced use.
func Dist() embed.FS {
	return distFS
}
