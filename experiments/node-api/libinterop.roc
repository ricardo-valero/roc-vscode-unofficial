app [main] { pf: platform "platform.roc" }

main : Str -> Str
main = \message ->
    "Nodejs said to Roc: $(message)! 🎉"
