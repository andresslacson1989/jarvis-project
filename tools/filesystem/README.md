# Filesystem Tool Boundary

`tools/filesystem` is reserved for narrow typed filesystem capabilities operating on canonical qualified paths/scopes.

Filesystem code cannot manufacture scope, bypass fresh/conditional target validation, or route around permission, authority, audit, locality, platform, and postcondition checks. Concrete implementation belongs to later matrix subsections.
