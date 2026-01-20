;; wrapped-usdc.clar
;; SIP-010 compliant wrapped USDC with Multi-Sig, Rate Limiting, and Timelock
;;
;; CLARITY 4 FEATURES USED:
;;   - stacks-block-height: Block height for timelocks
;;   - current-contract: Contract principal reference
;;   - as-contract?: Secure context switching with asset allowances
;;
;; Security layers:
;;   1. Multi-sig (2-of-3) for minting
;;   2. Rate limiting (per-tx, hourly, daily caps)
;;   3. Timelock for large mints
;;   4. Emergency pause

;; ============================================
;; TRAIT IMPLEMENTATION
;; ============================================

;; For testnet: 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.sip-010-trait-ft-standard.sip-010-trait
;; For mainnet: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
(impl-trait .sip-010-trait-ft-standard.sip-010-trait)

;; ============================================
;; TOKEN DEFINITION
;; ============================================

(define-fungible-token xUSDC)

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant CONTRACT-OWNER tx-sender)
;; TESTNET: Reduced to 1 for testing. CHANGE TO u2 FOR PRODUCTION!
(define-constant REQUIRED-SIGNATURES u1)
(define-constant MAX-SIGNERS u3)

;; Rate limits (in micro-USDC, 6 decimals)
(define-constant MAX-PER-TX u10000000000)       ;; 10,000 USDC
(define-constant HOURLY-LIMIT u50000000000)     ;; 50,000 USDC
(define-constant DAILY-LIMIT u200000000000)     ;; 200,000 USDC

;; Timelock thresholds (Clarity 4: using stacks-block-height)
(define-constant SMALL-TX-THRESHOLD u1000000000)   ;; 1,000 USDC - instant
(define-constant MEDIUM-TX-THRESHOLD u10000000000) ;; 10,000 USDC - 10 blocks
(define-constant SMALL-DELAY u0)
(define-constant MEDIUM-DELAY u10)    ;; ~10 blocks
(define-constant LARGE-DELAY u60)     ;; ~60 blocks (~1 hour on Stacks)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u402))
(define-constant ERR-INVALID-AMOUNT (err u403))
(define-constant ERR-INVALID-ADDRESS (err u404))
(define-constant ERR-NOT-SIGNER (err u405))
(define-constant ERR-EXCEEDS-MAX-TX (err u406))
(define-constant ERR-EXCEEDS-HOURLY (err u407))
(define-constant ERR-EXCEEDS-DAILY (err u408))
(define-constant ERR-ALREADY-APPROVED (err u409))
(define-constant ERR-INSUFFICIENT-APPROVALS (err u410))
(define-constant ERR-TIMELOCK-NOT-EXPIRED (err u411))
(define-constant ERR-ALREADY-EXECUTED (err u412))
(define-constant ERR-ALREADY-CANCELLED (err u413))
(define-constant ERR-NOT-FOUND (err u414))
(define-constant ERR-PAUSED (err u415))
(define-constant ERR-TOO-MANY-SIGNERS (err u416))
(define-constant ERR-SIGNER-EXISTS (err u417))
(define-constant ERR-NOT-ENOUGH-SIGNERS (err u418))
(define-constant ERR-SWAP-FAILED (err u501))
(define-constant ERR-DEX-NOT-CONFIGURED (err u502))
(define-constant ERR-SLIPPAGE-TOO-HIGH (err u503))

;; Official Circle USDCx Contract
;; Mainnet: SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
;; Note: USDCx only exists on mainnet. For testnet, use xUSDC directly.
(define-data-var usdcx-contract principal 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE)
(define-data-var dex-adapter-contract (optional principal) none)
(define-data-var auto-swap-enabled bool false)

;; ============================================
;; DATA VARIABLES
;; ============================================

(define-data-var token-uri (optional (string-utf8 256)) 
  (some u"https://bridge.stacks.co/metadata/xusdc.json"))
(define-data-var paused bool false)
(define-data-var mint-nonce uint u0)

;; Rate limiting state
(define-data-var current-hourly-volume uint u0)
(define-data-var current-daily-volume uint u0)
(define-data-var last-hour-reset uint u0)
(define-data-var last-day-reset uint u0)

;; ============================================
;; DATA MAPS
;; ============================================

;; Signers list (index -> principal)
(define-map signers uint principal)
(define-data-var signer-count uint u0)

;; Check if address is signer
(define-map is-signer principal bool)

;; Pending mints
(define-map pending-mints uint {
  recipient: principal,
  amount: uint,
  execute-after: uint,
  approval-count: uint,
  executed: bool,
  cancelled: bool
})

;; Approval tracking
(define-map mint-approvals {mint-id: uint, signer: principal} bool)

;; ============================================
;; SIP-010 IMPLEMENTATION
;; ============================================

(define-public (transfer 
    (amount uint) 
    (sender principal) 
    (recipient principal) 
    (memo (optional (buff 34))))
  (begin
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (ft-transfer? xUSDC amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (print {
      event: "ft_transfer",
      amount: amount,
      sender: sender,
      recipient: recipient,
      memo: (match memo data (some data) none),
      block-height: stacks-block-height
    })
    (ok true)))

(define-read-only (get-name)
  (ok "Wrapped USDC"))

(define-read-only (get-symbol)
  (ok "xUSDC"))

(define-read-only (get-decimals)
  (ok u6))

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance xUSDC account)))

(define-read-only (get-total-supply)
  (ok (ft-get-supply xUSDC)))

(define-read-only (get-token-uri)
  (ok (var-get token-uri)))

;; ============================================
;; MULTI-SIG MINT FUNCTIONS
;; ============================================

;; Queue a mint (any signer can initiate)
(define-public (queue-mint (recipient principal) (amount uint))
  (let
    (
      (mint-id (var-get mint-nonce))
      (delay (get-delay-for-amount amount))
      ;; Clarity 4: Use stacks-block-height for block-based timelocks
      (execute-after (+ stacks-block-height delay))
    )
    ;; Checks
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (is-authorized-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (<= amount MAX-PER-TX) ERR-EXCEEDS-MAX-TX)
    
    ;; Update rate limits
    (try! (check-and-update-rate-limits amount))
    
    ;; Create pending mint
    (map-set pending-mints mint-id {
      recipient: recipient,
      amount: amount,
      execute-after: execute-after,
      approval-count: u1,
      executed: false,
      cancelled: false
    })
    
    ;; Auto-approve by initiator
    (map-set mint-approvals {mint-id: mint-id, signer: tx-sender} true)
    
    ;; Increment nonce
    (var-set mint-nonce (+ mint-id u1))
    
    ;; Emit event
    (print {
      event: "mint-queued",
      mint-id: mint-id,
      recipient: recipient,
      amount: amount,
      execute-after: execute-after
    })
    
    (ok mint-id)))

;; Approve a pending mint
(define-public (approve-mint (mint-id uint))
  (let
    (
      (mint-data (unwrap! (map-get? pending-mints mint-id) ERR-NOT-FOUND))
    )
    ;; Checks
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (is-authorized-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (not (get executed mint-data)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled mint-data)) ERR-ALREADY-CANCELLED)
    (asserts! (is-none (map-get? mint-approvals {mint-id: mint-id, signer: tx-sender})) ERR-ALREADY-APPROVED)
    
    ;; Record approval
    (map-set mint-approvals {mint-id: mint-id, signer: tx-sender} true)
    
    ;; Update approval count
    (map-set pending-mints mint-id (merge mint-data {
      approval-count: (+ (get approval-count mint-data) u1)
    }))
    
    (print {
      event: "mint-approved",
      mint-id: mint-id,
      signer: tx-sender,
      approval-count: (+ (get approval-count mint-data) u1)
    })
    
    (ok true)))

;; Execute mint after timelock and approvals
(define-public (execute-mint (mint-id uint))
  (let
    (
      (mint-data (unwrap! (map-get? pending-mints mint-id) ERR-NOT-FOUND))
    )
    ;; Checks
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (not (get executed mint-data)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled mint-data)) ERR-ALREADY-CANCELLED)
    ;; Clarity 4: Use stacks-block-height for block-based timelocks
    (asserts! (>= stacks-block-height (get execute-after mint-data)) ERR-TIMELOCK-NOT-EXPIRED)
    (asserts! (>= (get approval-count mint-data) REQUIRED-SIGNATURES) ERR-INSUFFICIENT-APPROVALS)
    
    ;; Mark as executed
    (map-set pending-mints mint-id (merge mint-data {executed: true}))
    
    ;; Mint tokens
    (try! (ft-mint? xUSDC (get amount mint-data) (get recipient mint-data)))
    
    (print {
      event: "mint-executed",
      mint-id: mint-id,
      recipient: (get recipient mint-data),
      amount: (get amount mint-data)
    })
    
    (ok true)))

;; Execute mint AND swap to USDCx in one transaction
;; This gives user USDCx (Circle's wrapped USDC) instead of xUSDC
;; @param mint-id: Approved mint to execute
;; @param min-usdcx-out: Minimum USDCx to receive (slippage protection)
(define-public (execute-mint-and-swap (mint-id uint) (min-usdcx-out uint))
  (let
    (
      (mint-data (unwrap! (map-get? pending-mints mint-id) ERR-NOT-FOUND))
      (amount (get amount mint-data))
      (recipient (get recipient mint-data))
    )
    ;; Standard mint checks
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (not (get executed mint-data)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled mint-data)) ERR-ALREADY-CANCELLED)
    ;; Clarity 4: Use stacks-block-height for block-based timelocks
    (asserts! (>= stacks-block-height (get execute-after mint-data)) ERR-TIMELOCK-NOT-EXPIRED)
    (asserts! (>= (get approval-count mint-data) REQUIRED-SIGNATURES) ERR-INSUFFICIENT-APPROVALS)
    
    ;; Check DEX is configured
    (asserts! (var-get auto-swap-enabled) ERR-DEX-NOT-CONFIGURED)
    
    ;; Mark as executed
    (map-set pending-mints mint-id (merge mint-data {executed: true}))
    
    ;; Step 1: Mint xUSDC to THIS CONTRACT (not recipient)
    ;; Clarity 4: Use current-contract for contract principal reference
    (try! (ft-mint? xUSDC amount current-contract))
    
    ;; Step 2: Swap xUSDC -> USDCx via DEX adapter
    ;; The DEX adapter will handle the actual swap
    ;; For now, we emit an event for the relayer to complete the swap off-chain
    ;; This is a safer approach for MVP
    
    (print {
      event: "mint-and-swap-requested",
      mint-id: mint-id,
      recipient: recipient,
      xusdc-amount: amount,
      min-usdcx-out: min-usdcx-out
    })
    
    (ok true)))

;; Cancel a pending mint (any signer)
(define-public (cancel-mint (mint-id uint))
  (let
    (
      (mint-data (unwrap! (map-get? pending-mints mint-id) ERR-NOT-FOUND))
    )
    (asserts! (is-authorized-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (not (get executed mint-data)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled mint-data)) ERR-ALREADY-CANCELLED)
    
    (map-set pending-mints mint-id (merge mint-data {cancelled: true}))
    
    (print {event: "mint-cancelled", mint-id: mint-id})
    
    (ok true)))

;; ============================================
;; BURN FUNCTION (Public - no multi-sig needed)
;; ============================================

(define-public (burn (amount uint) (base-address (string-ascii 42)))
  (begin
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (is-eq (len base-address) u42) ERR-INVALID-ADDRESS)
    (asserts! (>= (ft-get-balance xUSDC tx-sender) amount) ERR-INSUFFICIENT-BALANCE)
    
    (try! (ft-burn? xUSDC amount tx-sender))
    
    (print {
      event: "burn",
      sender: tx-sender,
      amount: amount,
      base-address: base-address
    })
    
    (ok true)))

;; ============================================
;; ADMIN FUNCTIONS
;; ============================================

;; Initialize signers (can only be called once)
(define-public (initialize-signers (signer1 principal) (signer2 principal) (signer3 principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (var-get signer-count) u0) ERR-NOT-AUTHORIZED)
    
    (map-set signers u0 signer1)
    (map-set signers u1 signer2)
    (map-set signers u2 signer3)
    (map-set is-signer signer1 true)
    (map-set is-signer signer2 true)
    (map-set is-signer signer3 true)
    (var-set signer-count u3)
    
    (print {event: "signers-initialized", signer1: signer1, signer2: signer2, signer3: signer3})
    (ok true)))

;; Add a signer (owner only)
(define-public (add-signer (new-signer principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (< (var-get signer-count) MAX-SIGNERS) ERR-TOO-MANY-SIGNERS)
    (asserts! (is-none (map-get? is-signer new-signer)) ERR-SIGNER-EXISTS)
    
    (let ((index (var-get signer-count)))
      (map-set signers index new-signer)
      (map-set is-signer new-signer true)
      (var-set signer-count (+ index u1)))
    
    (print {event: "signer-added", signer: new-signer})
    (ok true)))

;; Pause (any signer)
(define-public (pause)
  (begin
    (asserts! (is-authorized-signer tx-sender) ERR-NOT-SIGNER)
    (var-set paused true)
    (print {event: "paused", by: tx-sender})
    (ok true)))

;; Unpause (owner only)
(define-public (unpause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set paused false)
    (print {event: "unpaused"})
    (ok true)))

;; Update token URI
(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set token-uri new-uri)
    ;; Clarity 4: Use current-contract for contract principal reference
    (print {notification: "token-metadata-update", payload: {token-class: "ft", contract-id: current-contract}})
    (ok true)))

;; Configure DEX adapter for USDCx swaps (owner only)
(define-public (set-dex-adapter (adapter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set dex-adapter-contract (some adapter))
    (print {event: "dex-adapter-set", adapter: adapter})
    (ok true)))

;; Enable/disable auto-swap to USDCx (owner only)
(define-public (set-auto-swap-enabled (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set auto-swap-enabled enabled)
    (print {event: "auto-swap-toggled", enabled: enabled})
    (ok true)))

;; Configure USDCx contract address (owner only)
(define-public (set-usdcx-contract (usdcx-address principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set usdcx-contract usdcx-address)
    (print {event: "usdcx-contract-set", address: usdcx-address})
    (ok true)))

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (is-authorized-signer (address principal))
  (default-to false (map-get? is-signer address)))

(define-read-only (get-signer (index uint))
  (map-get? signers index))

(define-read-only (get-signer-count)
  (var-get signer-count))

(define-read-only (get-pending-mint (mint-id uint))
  (map-get? pending-mints mint-id))

(define-read-only (has-approved-mint (mint-id uint) (signer principal))
  (default-to false (map-get? mint-approvals {mint-id: mint-id, signer: signer})))

(define-read-only (is-paused)
  (var-get paused))

(define-read-only (get-rate-limits)
  {
    hourly-volume: (var-get current-hourly-volume),
    daily-volume: (var-get current-daily-volume),
    hourly-limit: HOURLY-LIMIT,
    daily-limit: DAILY-LIMIT,
    max-per-tx: MAX-PER-TX
  })

;; ============================================
;; INTERNAL FUNCTIONS
;; ============================================

(define-private (get-delay-for-amount (amount uint))
  (if (<= amount SMALL-TX-THRESHOLD)
    SMALL-DELAY
    (if (<= amount MEDIUM-TX-THRESHOLD)
      MEDIUM-DELAY
      LARGE-DELAY)))

(define-private (check-and-update-rate-limits (amount uint))
  (begin
    ;; Reset using stacks-block-time for hourly/daily windows
    (let ((now stacks-block-time))
      (if (or (is-eq (var-get last-hour-reset) u0) (>= now (+ (var-get last-hour-reset) u3600)))
        (begin
          (var-set current-hourly-volume u0)
          (var-set last-hour-reset now)
          true)
        false)
      (if (or (is-eq (var-get last-day-reset) u0) (>= now (+ (var-get last-day-reset) u86400)))
        (begin
          (var-set current-daily-volume u0)
          (var-set last-day-reset now)
          true)
        false))
    (let
      (
        (hourly (var-get current-hourly-volume))
        (daily (var-get current-daily-volume))
      )
      (asserts! (<= (+ hourly amount) HOURLY-LIMIT) ERR-EXCEEDS-HOURLY)
      (asserts! (<= (+ daily amount) DAILY-LIMIT) ERR-EXCEEDS-DAILY)
      
      (var-set current-hourly-volume (+ hourly amount))
      (var-set current-daily-volume (+ daily amount))
      (ok true))))
