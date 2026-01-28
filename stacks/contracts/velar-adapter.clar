;; velar-adapter.clar
;; Adapter for Velar DEX integration
;; Implements dex-adapter-trait for swapping xUSDC -> USDCx

(impl-trait .dex-adapter-trait.dex-adapter-trait)


;; ============================================
;; CONSTANTS
;; ============================================

 

(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-SWAP-FAILED (err u501))
(define-constant ERR-INSUFFICIENT-OUTPUT (err u502))
(define-constant ERR-POOL-NOT-FOUND (err u503))
(define-constant ERR-NOT-CONFIGURED (err u504))
(define-constant ERR-INVALID-TOKEN (err u505))
(define-constant ERR-PAUSED (err u506))
(define-constant ERR-INVALID-SLIPPAGE (err u507))

;; Velar Mainnet Router Contract
(define-constant VELAR-MAINNET-ROUTER 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1)

;; Official USDCx Contract
(define-constant USDCX-MAINNET 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE)

;; AMM fee (0.3%)
(define-constant FEE-NUMERATOR u997)
(define-constant FEE-DENOMINATOR u1000)

;; Slippage
(define-constant DEFAULT-SLIPPAGE-TOLERANCE u50) ;; 0.5%
(define-constant SLIPPAGE-DENOMINATOR u10000)

;; ============================================
;; DATA VARIABLES
;; ============================================

(define-data-var router-contract principal VELAR-MAINNET-ROUTER)
(define-data-var router-configured bool false)
(define-data-var contract-owner principal tx-sender)


(define-data-var xusdc-token-contract principal tx-sender)
(define-data-var usdcx-token-contract principal USDCX-MAINNET)
(define-data-var pool-id uint u0)
(define-data-var pool-configured bool false)

(define-data-var slippage-tolerance uint DEFAULT-SLIPPAGE-TOLERANCE)
(define-data-var paused bool false)

;; ============================================
;; ADMIN FUNCTIONS
;; ============================================

(define-public (set-router-contract (router principal))
  (begin
   (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set router-contract router)
    (var-set router-configured true)
    (print { event: "router-configured", router: router })
    (ok true)))

(define-public (configure-pool
  (xusdc-token principal)
  (usdcx-token principal)
  (velar-pool-id uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set xusdc-token-contract xusdc-token)
    (var-set usdcx-token-contract usdcx-token)
    (var-set pool-id velar-pool-id)
    (var-set pool-configured true)
    (print {
      event: "pool-configured",
      xusdc-token: xusdc-token,
      usdcx-token: usdcx-token,
      pool-id: velar-pool-id
    })
    (ok true)))

(define-public (set-slippage-tolerance (tolerance uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (asserts! (<= tolerance u1000) ERR-INVALID-SLIPPAGE) ;; max 10%
    (var-set slippage-tolerance tolerance)
    (print { event: "slippage-updated", tolerance: tolerance })
    (ok true)))

(define-public (set-paused (is-paused bool))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set paused is-paused)
    (print { event: "pause-toggled", paused: is-paused })
    (ok true)))

;; ============================================
;; DEX ADAPTER IMPLEMENTATION
;; ============================================

(define-public (swap-exact-tokens
  (amount-in uint)
  (min-amount-out uint)
  (token-in principal)
  (token-out principal))
  (let (
    (expected-out (calculate-output-amount amount-in))
    (actual-min-out (calculate-min-output amount-in))
  )
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (var-get router-configured) ERR-NOT-CONFIGURED)
    (asserts! (var-get pool-configured) ERR-NOT-CONFIGURED)

    (asserts! (is-eq token-in (var-get xusdc-token-contract)) ERR-INVALID-TOKEN)
    (asserts! (is-eq token-out (var-get usdcx-token-contract)) ERR-INVALID-TOKEN)

    ;; Enforce adapter slippage protection
    (asserts! (>= min-amount-out actual-min-out) ERR-INSUFFICIENT-OUTPUT)

    ;; Simulated swap (router call omitted)
    (print {
      event: "swap-executed",
      router: (var-get router-contract),
      pool-id: (var-get pool-id),
      token-in: token-in,
      token-out: token-out,
      amount-in: amount-in,
      amount-out: expected-out,
      min-amount-out: min-amount-out,
      slippage: (var-get slippage-tolerance),
      sender: tx-sender
    })

    (ok expected-out)))

;; ============================================
;; READ-ONLY / HELPERS
;; ============================================

(define-read-only (get-swap-quote
  (amount-in uint)
  (token-in principal)
  (token-out principal))
  (begin
    (asserts! (is-eq token-in (var-get xusdc-token-contract)) ERR-INVALID-TOKEN)
    (asserts! (is-eq token-out (var-get usdcx-token-contract)) ERR-INVALID-TOKEN)
    (ok (calculate-output-amount amount-in))))

(define-private (calculate-output-amount (amount-in uint))
  (/ (* amount-in FEE-NUMERATOR) FEE-DENOMINATOR))

(define-private (calculate-min-output (amount-in uint))
  (let (
    (expected (calculate-output-amount amount-in))
    (slippage (var-get slippage-tolerance))
  )
    (/ (* expected (- SLIPPAGE-DENOMINATOR slippage)) SLIPPAGE-DENOMINATOR)))

;; ============================================
;; VIEW FUNCTIONS
;; ============================================

(define-read-only (get-router-contract) (var-get router-contract))
(define-read-only (is-router-configured) (var-get router-configured))
(define-read-only (is-pool-configured) (var-get pool-configured))
(define-read-only (get-slippage-tolerance) (var-get slippage-tolerance))
(define-read-only (get-paused-status) (var-get paused))
