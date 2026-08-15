platform "bun-interop"
    requires {} { add : _ }
    exposes []
    packages {}
    imports []
    provides [mainForHost]

mainForHost : I32, I32 -> I32
mainForHost = \a, b ->
    add a b
