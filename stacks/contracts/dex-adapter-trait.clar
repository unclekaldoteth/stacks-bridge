;; dex-adapter-trait.clar
;; Generic DEX adapter interface for token swaps
;; Allows modular integration with different DEXes (Velar, Alex, etc.)

(define-trait dex-adapter-trait
  (
    ;; Swap exact amount of input tokens for output tokens
    ;; @param amount-in: Amount of tokens to swap
    ;; @param min-amount-out: Minimum acceptable output (slippage protection)
    ;; @param token-in: Principal of input token contract
    ;; @param token-out: Principal of output token contract
    ;; @returns: Actual amount of tokens received
    (swap-exact-tokens 
      (uint uint principal principal) 
      (response uint uint)
    )
    
    ;; Get expected output for a given input
    ;; @param amount-in: Amount of tokens to swap
    ;; @param token-in: Principal of input token contract
    ;; @param token-out: Principal of output token contract
    ;; @returns: Expected output amount
    (get-swap-quote
      (uint principal principal)
      (response uint uint)
    )
  )
)
