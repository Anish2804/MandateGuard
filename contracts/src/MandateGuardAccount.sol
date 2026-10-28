// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MandateGuardAccount
 * @notice Guarded smart account enforcing cryptographic human-approved mandate
 *         authorization before any token payment can be executed.
 * @dev Employs EIP-712 typed-data verification, single-use replay defense,
 *      and on-chain mandate registration and revocation.
 */
contract MandateGuardAccount is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Types & Enums ---

    enum Verdict {
        DENY,
        ALLOW
    }

    struct PaymentVerdict {
        uint8 verdict;            // 0 = DENY, 1 = ALLOW
        uint256 chainId;          // Target EVM chain ID
        address account;          // Target smart account (must be address(this))
        address token;            // Token contract to transfer
        address recipient;        // Payment destination
        uint256 amount;           // Exact transfer amount in base units
        bytes32 mandateId;        // Reference to human mandate policy
        bytes32 authorizationId;  // Unique nonce for replay defense
        uint256 expiry;           // Unix timestamp expiration
        uint256 mandateVersion;   // Monotonic policy version
    }

    struct Mandate {
        bool isRegistered;
        bool revoked;
        address agent;
        address token;
        address recipient;        // If address(0), any recipient is permitted within limits
        uint256 maxAmountPerTx;
        uint256 maxCumulativeAmount;
        uint256 cumulativeSpent;
        uint256 startTime;
        uint256 expiry;
        uint256 version;
    }

    // --- Constants & EIP-712 TypeHashes ---

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant PAYMENT_VERDICT_TYPEHASH = keccak256(
        "PaymentVerdict(uint8 verdict,uint256 chainId,address account,address token,address recipient,uint256 amount,bytes32 mandateId,bytes32 authorizationId,uint256 expiry,uint256 mandateVersion)"
    );

    bytes32 private immutable _HASHED_NAME;
    bytes32 private immutable _HASHED_VERSION;
    uint256 private immutable _INITIAL_CHAIN_ID;
    bytes32 private immutable _INITIAL_DOMAIN_SEPARATOR;

    // --- State Variables ---

    address public owner;
    address public authorizerSigner;

    // Replay protection: authorizationId => hasBeenUsed
    mapping(bytes32 => bool) public usedAuthorizations;

    // On-chain mandate registry: mandateId => Mandate
    mapping(bytes32 => Mandate) public mandates;

    // --- Events ---

    event PaymentExecuted(
        bytes32 indexed mandateId,
        bytes32 indexed authorizationId,
        address indexed recipient,
        address token,
        uint256 amount
    );

    event MandateRegistered(
        bytes32 indexed mandateId,
        address indexed agent,
        address token,
        address recipient,
        uint256 maxAmountPerTx,
        uint256 maxCumulativeAmount,
        uint256 startTime,
        uint256 expiry
    );

    event MandateRevoked(bytes32 indexed mandateId);
    event AuthorizerSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EmergencyWithdrawalExecuted(address indexed token, address indexed to, uint256 amount);

    // --- Custom Errors ---

    error Unauthorized();
    error DenyVerdictNotExecutable();
    error InvalidChainId(uint256 expected, uint256 actual);
    error InvalidAccount(address expected, address actual);
    error VerdictExpired(uint256 expiry, uint256 currentTimestamp);
    error AuthorizationAlreadyUsed(bytes32 authorizationId);
    error InvalidSigner(address recovered, address expected);
    error MandateRevokedError(bytes32 mandateId);
    error MandateNotActive(bytes32 mandateId, uint256 currentTimestamp);
    error AmountExceedsTxLimit(uint256 requested, uint256 limit);
    error AmountExceedsCumulativeLimit(uint256 requested, uint256 remaining);
    error TokenMismatch(address expected, address actual);
    error RecipientMismatch(address expected, address actual);
    error InvalidZeroAddress();
    error ZeroAmount();
    error MandateVersionMismatch(uint256 expected, uint256 actual);
    error MandateNotRegistered(bytes32 mandateId);

    // --- Modifiers ---

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // --- Constructor ---

    constructor(address _owner, address _authorizerSigner) {
        if (_owner == address(0) || _authorizerSigner == address(0)) {
            revert InvalidZeroAddress();
        }
        owner = _owner;
        authorizerSigner = _authorizerSigner;

        bytes32 hashedName = keccak256(bytes("MandateGuard"));
        bytes32 hashedVersion = keccak256(bytes("1"));

        _HASHED_NAME = hashedName;
        _HASHED_VERSION = hashedVersion;
        _INITIAL_CHAIN_ID = block.chainid;
        _INITIAL_DOMAIN_SEPARATOR = _buildDomainSeparator(hashedName, hashedVersion, block.chainid, address(this));

        emit OwnershipTransferred(address(0), _owner);
        emit AuthorizerSignerUpdated(address(0), _authorizerSigner);
    }

    // --- EIP-712 Domain Separator ---

    function domainSeparator() public view returns (bytes32) {
        if (block.chainid == _INITIAL_CHAIN_ID) {
            return _INITIAL_DOMAIN_SEPARATOR;
        } else {
            return _buildDomainSeparator(_HASHED_NAME, _HASHED_VERSION, block.chainid, address(this));
        }
    }

    function _buildDomainSeparator(
        bytes32 nameHash,
        bytes32 versionHash,
        uint256 chainId,
        address contractAddress
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                nameHash,
                versionHash,
                chainId,
                contractAddress
            )
        );
    }

    // --- Struct Hash Helper ---

    function hashVerdict(PaymentVerdict calldata verdict) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                PAYMENT_VERDICT_TYPEHASH,
                verdict.verdict,
                verdict.chainId,
                verdict.account,
                verdict.token,
                verdict.recipient,
                verdict.amount,
                verdict.mandateId,
                verdict.authorizationId,
                verdict.expiry,
                verdict.mandateVersion
            )
        );
    }

    // --- Core Execution Method ---

    /**
     * @notice Executes a payment transfer guarded by EIP-712 signed authorization.
     * @param verdict Structured verdict containing all payment and policy parameters.
     * @param signature Cryptographic signature of the verdict by authorizerSigner.
     */
    function executePayment(
        PaymentVerdict calldata verdict,
        bytes calldata signature
    ) external nonReentrant {
        // 1. Strict verdict verification: DENY is never executable
        if (verdict.verdict != uint8(Verdict.ALLOW)) {
            revert DenyVerdictNotExecutable();
        }

        // 2. Strict bindings
        if (verdict.chainId != block.chainid) {
            revert InvalidChainId(block.chainid, verdict.chainId);
        }
        if (verdict.account != address(this)) {
            revert InvalidAccount(address(this), verdict.account);
        }
        if (block.timestamp > verdict.expiry) {
            revert VerdictExpired(verdict.expiry, block.timestamp);
        }
        if (verdict.amount == 0) {
            revert ZeroAmount();
        }
        if (verdict.recipient == address(0) || verdict.token == address(0)) {
            revert InvalidZeroAddress();
        }

        // 3. Replay protection
        if (usedAuthorizations[verdict.authorizationId]) {
            revert AuthorizationAlreadyUsed(verdict.authorizationId);
        }

        // 4. On-chain mandate verification: mandate MUST be registered on-chain by the owner
        Mandate storage mandate = mandates[verdict.mandateId];
        if (!mandate.isRegistered) {
            revert MandateNotRegistered(verdict.mandateId);
        }
        if (mandate.revoked) {
            revert MandateRevokedError(verdict.mandateId);
        }
        if (block.timestamp < mandate.startTime || block.timestamp > mandate.expiry) {
            revert MandateNotActive(verdict.mandateId, block.timestamp);
        }
        if (verdict.token != mandate.token) {
            revert TokenMismatch(mandate.token, verdict.token);
        }
        if (mandate.recipient != address(0) && verdict.recipient != mandate.recipient) {
            revert RecipientMismatch(mandate.recipient, verdict.recipient);
        }
        if (verdict.amount > mandate.maxAmountPerTx) {
            revert AmountExceedsTxLimit(verdict.amount, mandate.maxAmountPerTx);
        }
        if (mandate.cumulativeSpent + verdict.amount > mandate.maxCumulativeAmount) {
            revert AmountExceedsCumulativeLimit(
                verdict.amount,
                mandate.maxCumulativeAmount - mandate.cumulativeSpent
            );
        }
        if (verdict.mandateVersion != mandate.version) {
            revert MandateVersionMismatch(mandate.version, verdict.mandateVersion);
        }

        // 5. Cryptographic signature verification
        bytes32 structHash = hashVerdict(verdict);
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator(), structHash)
        );

        address recovered = ECDSA.recover(digest, signature);
        if (recovered != authorizerSigner) {
            revert InvalidSigner(recovered, authorizerSigner);
        }

        // 6. State updates & Event (Checks-Effects-Interactions)
        usedAuthorizations[verdict.authorizationId] = true;
        mandate.cumulativeSpent += verdict.amount;

        emit PaymentExecuted(
            verdict.mandateId,
            verdict.authorizationId,
            verdict.recipient,
            verdict.token,
            verdict.amount
        );

        // 7. Token transfer
        IERC20(verdict.token).safeTransfer(verdict.recipient, verdict.amount);
    }

    // --- Mandate Management (Owner only) ---

    /**
     * @notice Registers or updates a mandate policy on-chain.
     */
    function registerMandate(
        bytes32 mandateId,
        address agent,
        address token,
        address recipient,
        uint256 maxAmountPerTx,
        uint256 maxCumulativeAmount,
        uint256 startTime,
        uint256 expiry
    ) external onlyOwner {
        if (mandateId == bytes32(0) || token == address(0)) {
            revert InvalidZeroAddress();
        }
        if (expiry <= startTime) {
            revert VerdictExpired(expiry, startTime);
        }

        Mandate storage mandate = mandates[mandateId];
        uint256 nextVersion = mandate.isRegistered ? mandate.version + 1 : 1;

        mandates[mandateId] = Mandate({
            isRegistered: true,
            revoked: false,
            agent: agent,
            token: token,
            recipient: recipient,
            maxAmountPerTx: maxAmountPerTx,
            maxCumulativeAmount: maxCumulativeAmount,
            cumulativeSpent: mandate.isRegistered ? mandate.cumulativeSpent : 0,
            startTime: startTime,
            expiry: expiry,
            version: nextVersion
        });

        emit MandateRegistered(
            mandateId,
            agent,
            token,
            recipient,
            maxAmountPerTx,
            maxCumulativeAmount,
            startTime,
            expiry
        );
    }

    /**
     * @notice Revokes a mandate on-chain immediately.
     */
    function revokeMandate(bytes32 mandateId) external onlyOwner {
        Mandate storage mandate = mandates[mandateId];
        mandate.revoked = true;
        emit MandateRevoked(mandateId);
    }

    // --- Signer & Owner Administration ---

    function setAuthorizerSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidZeroAddress();
        address oldSigner = authorizerSigner;
        authorizerSigner = newSigner;
        emit AuthorizerSignerUpdated(oldSigner, newSigner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @notice Audited emergency escape hatch for the human owner.
     * @dev Allows recovering mis-sent tokens or decommissioning the smart account.
     */
    function emergencyWithdrawToken(
        address token,
        address to,
        uint256 amount
    ) external nonReentrant onlyOwner {
        if (to == address(0) || token == address(0)) revert InvalidZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdrawalExecuted(token, to, amount);
    }
}
