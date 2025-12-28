// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BridgeBase
 * @notice Base <> Stacks USDC Bridge with Multi-Sig, Rate Limiting, and Timelock
 * @dev Security layers:
 *      1. Multi-sig (2-of-3) for releases
 *      2. Rate limiting (per-tx, hourly, daily caps)
 *      3. Timelock for large withdrawals
 *      4. Emergency pause
 */
contract BridgeBase is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    IERC20 public immutable usdc;
    
    // Multi-sig configuration
    uint256 public constant REQUIRED_SIGNATURES = 2;
    uint256 public constant MAX_SIGNERS = 3;
    address[] public signers;
    mapping(address => bool) public isSigner;
    
    // Rate limiting
    uint256 public maxPerTx = 10_000 * 1e6;      // 10,000 USDC
    uint256 public hourlyLimit = 50_000 * 1e6;   // 50,000 USDC/hour
    uint256 public dailyLimit = 200_000 * 1e6;   // 200,000 USDC/day
    
    uint256 public currentHourlyVolume;
    uint256 public currentDailyVolume;
    uint256 public lastHourReset;
    uint256 public lastDayReset;
    
    // Timelock configuration
    uint256 public constant SMALL_TX_THRESHOLD = 1_000 * 1e6;   // 1,000 USDC - instant
    uint256 public constant MEDIUM_TX_THRESHOLD = 10_000 * 1e6; // 10,000 USDC - 10 min delay
    uint256 public constant SMALL_DELAY = 0;
    uint256 public constant MEDIUM_DELAY = 10 minutes;
    uint256 public constant LARGE_DELAY = 1 hours;
    
    // Pending releases with timelock
    struct PendingRelease {
        address receiver;
        uint256 amount;
        uint256 executeAfter;
        uint256 approvalCount;
        bool executed;
        bool cancelled;
    }
    
    uint256 public releaseNonce;
    mapping(uint256 => PendingRelease) public pendingReleases;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    
    // Deposit tracking
    mapping(string => uint256) public pendingDeposits;

    // ============================================
    // EVENTS
    // ============================================
    
    event Deposit(
        address indexed from,
        uint256 amount,
        string stacksAddress,
        uint256 timestamp
    );
    
    event ReleaseQueued(
        uint256 indexed releaseId,
        address indexed receiver,
        uint256 amount,
        uint256 executeAfter
    );
    
    event ReleaseApproved(
        uint256 indexed releaseId,
        address indexed signer,
        uint256 approvalCount
    );
    
    event ReleaseExecuted(
        uint256 indexed releaseId,
        address indexed receiver,
        uint256 amount
    );
    
    event ReleaseCancelled(uint256 indexed releaseId);
    
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event LimitsUpdated(uint256 maxPerTx, uint256 hourlyLimit, uint256 dailyLimit);

    // ============================================
    // ERRORS
    // ============================================
    
    error NotSigner();
    error InvalidAmount();
    error InvalidAddress();
    error InvalidStacksAddress();
    error ExceedsMaxPerTx();
    error ExceedsHourlyLimit();
    error ExceedsDailyLimit();
    error InsufficientContractBalance();
    error ReleaseNotFound();
    error ReleaseAlreadyExecuted();
    error ReleaseCancelledError();
    error TimelockNotExpired();
    error InsufficientApprovals();
    error AlreadyApproved();
    error TooManySigners();
    error NotEnoughSigners();
    error SignerAlreadyExists();
    error SignerDoesNotExist();

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address _usdc, 
        address[] memory _initialSigners
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_initialSigners.length >= REQUIRED_SIGNATURES, "Need at least 2 signers");
        require(_initialSigners.length <= MAX_SIGNERS, "Too many signers");
        
        usdc = IERC20(_usdc);
        
        for (uint256 i = 0; i < _initialSigners.length; i++) {
            require(_initialSigners[i] != address(0), "Invalid signer");
            require(!isSigner[_initialSigners[i]], "Duplicate signer");
            
            signers.push(_initialSigners[i]);
            isSigner[_initialSigners[i]] = true;
            emit SignerAdded(_initialSigners[i]);
        }
        
        lastHourReset = block.timestamp;
        lastDayReset = block.timestamp;
    }

    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }
    
    modifier updateRateLimits() {
        _resetRateLimitsIfNeeded();
        _;
    }

    // ============================================
    // USER FUNCTIONS
    // ============================================
    
    /**
     * @notice Lock USDC to bridge to Stacks
     * @param amount Amount of USDC to lock (6 decimals)
     * @param stacksAddress Destination Stacks address
     */
    function lock(uint256 amount, string calldata stacksAddress) 
        external 
        nonReentrant 
        whenNotPaused
        updateRateLimits
    {
        if (amount == 0) revert InvalidAmount();
        
        // Validate Stacks address (34-64 chars)
        uint256 addrLen = bytes(stacksAddress).length;
        if (addrLen < 34 || addrLen > 64) revert InvalidStacksAddress();
        
        // Transfer USDC from user to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        // Track pending deposit
        pendingDeposits[stacksAddress] += amount;
        
        emit Deposit(msg.sender, amount, stacksAddress, block.timestamp);
    }

    // ============================================
    // MULTI-SIG RELEASE FUNCTIONS
    // ============================================
    
    /**
     * @notice Queue a release (any signer can initiate)
     * @param receiver EVM address to receive USDC
     * @param amount Amount to release
     */
    function queueRelease(address receiver, uint256 amount) 
        external 
        onlySigner 
        whenNotPaused
        updateRateLimits
        returns (uint256 releaseId)
    {
        // Validate inputs
        if (amount == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidAddress();
        
        // Check rate limits
        if (amount > maxPerTx) revert ExceedsMaxPerTx();
        if (currentHourlyVolume + amount > hourlyLimit) revert ExceedsHourlyLimit();
        if (currentDailyVolume + amount > dailyLimit) revert ExceedsDailyLimit();
        
        // Check balance
        if (usdc.balanceOf(address(this)) < amount) {
            revert InsufficientContractBalance();
        }
        
        // Calculate timelock delay based on amount
        uint256 delay = _getDelayForAmount(amount);
        uint256 executeAfter = block.timestamp + delay;
        
        // Create pending release
        releaseId = releaseNonce++;
        pendingReleases[releaseId] = PendingRelease({
            receiver: receiver,
            amount: amount,
            executeAfter: executeAfter,
            approvalCount: 1, // Initiator auto-approves
            executed: false,
            cancelled: false
        });
        
        hasApproved[releaseId][msg.sender] = true;
        
        // Update rate limit tracking
        currentHourlyVolume += amount;
        currentDailyVolume += amount;
        
        emit ReleaseQueued(releaseId, receiver, amount, executeAfter);
        emit ReleaseApproved(releaseId, msg.sender, 1);
        
        return releaseId;
    }
    
    /**
     * @notice Approve a pending release (requires 2-of-3)
     * @param releaseId The release to approve
     */
    function approveRelease(uint256 releaseId) 
        external 
        onlySigner 
        whenNotPaused
    {
        PendingRelease storage release = pendingReleases[releaseId];
        
        if (release.receiver == address(0)) revert ReleaseNotFound();
        if (release.executed) revert ReleaseAlreadyExecuted();
        if (release.cancelled) revert ReleaseCancelledError();
        if (hasApproved[releaseId][msg.sender]) revert AlreadyApproved();
        
        hasApproved[releaseId][msg.sender] = true;
        release.approvalCount++;
        
        emit ReleaseApproved(releaseId, msg.sender, release.approvalCount);
    }
    
    /**
     * @notice Execute a release after timelock and approvals
     * @param releaseId The release to execute
     */
    function executeRelease(uint256 releaseId) 
        external 
        nonReentrant 
        whenNotPaused
    {
        PendingRelease storage release = pendingReleases[releaseId];
        
        if (release.receiver == address(0)) revert ReleaseNotFound();
        if (release.executed) revert ReleaseAlreadyExecuted();
        if (release.cancelled) revert ReleaseCancelledError();
        if (block.timestamp < release.executeAfter) revert TimelockNotExpired();
        if (release.approvalCount < REQUIRED_SIGNATURES) revert InsufficientApprovals();
        
        // Check balance again at execution time
        if (usdc.balanceOf(address(this)) < release.amount) {
            revert InsufficientContractBalance();
        }
        
        release.executed = true;
        
        usdc.safeTransfer(release.receiver, release.amount);
        
        emit ReleaseExecuted(releaseId, release.receiver, release.amount);
    }
    
    /**
     * @notice Cancel a pending release (any signer)
     * @param releaseId The release to cancel
     */
    function cancelRelease(uint256 releaseId) 
        external 
        onlySigner
    {
        PendingRelease storage release = pendingReleases[releaseId];
        
        if (release.receiver == address(0)) revert ReleaseNotFound();
        if (release.executed) revert ReleaseAlreadyExecuted();
        if (release.cancelled) revert ReleaseCancelledError();
        
        release.cancelled = true;
        
        // Refund the rate limit tracking
        if (currentHourlyVolume >= release.amount) {
            currentHourlyVolume -= release.amount;
        }
        if (currentDailyVolume >= release.amount) {
            currentDailyVolume -= release.amount;
        }
        
        emit ReleaseCancelled(releaseId);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function addSigner(address newSigner) external onlyOwner {
        if (signers.length >= MAX_SIGNERS) revert TooManySigners();
        if (newSigner == address(0)) revert InvalidAddress();
        if (isSigner[newSigner]) revert SignerAlreadyExists();
        
        signers.push(newSigner);
        isSigner[newSigner] = true;
        
        emit SignerAdded(newSigner);
    }
    
    function removeSigner(address signer) external onlyOwner {
        if (!isSigner[signer]) revert SignerDoesNotExist();
        if (signers.length <= REQUIRED_SIGNATURES) revert NotEnoughSigners();
        
        isSigner[signer] = false;
        
        // Remove from array
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }
        
        emit SignerRemoved(signer);
    }
    
    function updateLimits(
        uint256 _maxPerTx,
        uint256 _hourlyLimit,
        uint256 _dailyLimit
    ) external onlyOwner {
        maxPerTx = _maxPerTx;
        hourlyLimit = _hourlyLimit;
        dailyLimit = _dailyLimit;
        
        emit LimitsUpdated(_maxPerTx, _hourlyLimit, _dailyLimit);
    }
    
    function pause() external onlySigner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        usdc.safeTransfer(to, amount);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function getLockedBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    function getSigners() external view returns (address[] memory) {
        return signers;
    }
    
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }
    
    function getReleaseInfo(uint256 releaseId) external view returns (
        address receiver,
        uint256 amount,
        uint256 executeAfter,
        uint256 approvalCount,
        bool executed,
        bool cancelled
    ) {
        PendingRelease storage r = pendingReleases[releaseId];
        return (r.receiver, r.amount, r.executeAfter, r.approvalCount, r.executed, r.cancelled);
    }
    
    function getRemainingLimits() external view returns (
        uint256 remainingHourly,
        uint256 remainingDaily
    ) {
        uint256 hourly = currentHourlyVolume > hourlyLimit ? 0 : hourlyLimit - currentHourlyVolume;
        uint256 daily = currentDailyVolume > dailyLimit ? 0 : dailyLimit - currentDailyVolume;
        return (hourly, daily);
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    function _getDelayForAmount(uint256 amount) internal pure returns (uint256) {
        if (amount <= SMALL_TX_THRESHOLD) {
            return SMALL_DELAY;
        } else if (amount <= MEDIUM_TX_THRESHOLD) {
            return MEDIUM_DELAY;
        } else {
            return LARGE_DELAY;
        }
    }
    
    function _resetRateLimitsIfNeeded() internal {
        if (block.timestamp >= lastHourReset + 1 hours) {
            currentHourlyVolume = 0;
            lastHourReset = block.timestamp;
        }
        
        if (block.timestamp >= lastDayReset + 1 days) {
            currentDailyVolume = 0;
            lastDayReset = block.timestamp;
        }
    }
}
