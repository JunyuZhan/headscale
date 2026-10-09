// Command webbackend is the standalone web administration backend for
// Headscale. It is deployed alongside headscale (see docker-compose.yml) and
// proxies every Headscale operation server-side, keeping the API key off the
// browser.
package main

import (
	"log"

	"github.com/juanfont/headscale/hscontrol/webbackend"
)

func main() {
	cfg := webbackend.LoadConfig()
	srv, err := webbackend.NewServer(cfg)
	if err != nil {
		log.Fatalf("webbackend: %v", err)
	}
	if err := srv.Run(); err != nil {
		log.Fatalf("webbackend: %v", err)
	}
}
