package webui

import (
	"io/fs"
	"net/http"
	"strings"
)

// Handler returns an http.Handler that serves the embedded SPA. It is mounted
// by the router under /ui, so it never overlaps with /api, /register, /auth or
// any other headscale route.
//
// The router passes the full original request path (still including the /ui
// prefix). We strip that prefix and resolve files from the embedded "dist"
// tree directly, so http.FileServer's own prefix assumptions never apply.
func Handler() http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upath := strings.TrimPrefix(r.URL.Path, "/ui")
		if upath == "" {
			upath = "/"
		}
		rel := strings.TrimPrefix(upath, "/")

		// Directory or index request → serve the SPA entry point.
		if rel == "" || strings.HasSuffix(upath, "/") {
			serveIndex(w, sub)

			return
		}

		data, err := fs.ReadFile(sub, rel)
		if err != nil {
			// No file: if it looks like an SPA client route (no extension),
			// serve index.html so client-side routing works.
			if !strings.Contains(upath, ".") {
				serveIndex(w, sub)

				return
			}
			http.NotFound(w, r)

			return
		}

		w.Header().Set("Content-Type", mimeType(rel))
		_, _ = w.Write(data)
	})
}

// RedirectToUI redirects / and /ui to the SPA entry point /ui/.
func RedirectToUI(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/ui/", http.StatusFound)
}

func serveIndex(w http.ResponseWriter, sub fs.FS) {
	data, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fallbackHTML))

		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

// mimeType returns a sensible Content-Type for the embedded asset by extension.
func mimeType(name string) string {
	switch {
	case strings.HasSuffix(name, ".js"):
		return "text/javascript; charset=utf-8"
	case strings.HasSuffix(name, ".mjs"):
		return "text/javascript; charset=utf-8"
	case strings.HasSuffix(name, ".css"):
		return "text/css; charset=utf-8"
	case strings.HasSuffix(name, ".html"), strings.HasSuffix(name, ".htm"):
		return "text/html; charset=utf-8"
	case strings.HasSuffix(name, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(name, ".png"):
		return "image/png"
	case strings.HasSuffix(name, ".jpg"), strings.HasSuffix(name, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(name, ".json"):
		return "application/json; charset=utf-8"
	case strings.HasSuffix(name, ".ico"):
		return "image/x-icon"
	case strings.HasSuffix(name, ".woff2"):
		return "font/woff2"
	default:
		return "application/octet-stream"
	}
}

const fallbackHTML = `<!doctype html><html><head><meta charset="utf-8"><title>Headscale</title></head>` +
	`<body style="font-family:sans-serif;padding:2rem">` +
	`<h1>Headscale Web UI</h1>` +
	`<p>The frontend has not been built. Run <code>make build</code> ` +
	`(it builds the web app in <code>web/</code>) before starting headscale.</p>` +
	`</body></html>`
