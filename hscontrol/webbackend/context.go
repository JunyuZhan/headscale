package webbackend

import "context"

type ctxKey struct{}

// contextWithUser stores the authenticated web user in the request context.
func contextWithUser(ctx context.Context, u *WebUser) context.Context {
	return context.WithValue(ctx, ctxKey{}, u)
}

// userFromContext retrieves the authenticated web user from the context.
func userFromContext(ctx context.Context) *WebUser {
	if u, ok := ctx.Value(ctxKey{}).(*WebUser); ok {
		return u
	}
	return nil
}
