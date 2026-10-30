// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MandateGuardAccount.sol";
import "../src/MockUSDC.sol";

/// @dev Handler contract for stateful invariant testing
contract MandateGuardHandler is Test {
    MandateGuardAccount public immutable account;
    MockUSDC public immutable usdc;

    uint256 public immutable authorizerKey;
    address public immutable authorizer;
    uint256 public immutable ownerKey;
    address public immutable owner;

    address public immutable merchant;
    address public immutable agent;
    bytes32 public immutable mandateId;

    uint256 public constant MAX_TX_LIMIT = 50_000_000;    // $50.00 USDC
    uint256 public constant MAX_CUMULATIVE = 500_000_000; // $500.00 USDC

    // Ghost variables tracking system state
    uint256 public ghost_totalSpent;
    uint256 public ghost_successfulExecutions;
    uint256 public ghost_nonceCounter;
    bytes32[] public ghost_usedAuthIds;
    bool public ghost_mandateRevoked;

    constructor(
        MandateGuardAccount _account,
        MockUSDC _usdc,
        uint256 _authorizerKey,
        uint256 _ownerKey,
        bytes32 _mandateId,
        address _merchant,
        address _agent
    ) {
        account = _account;
        usdc = _usdc;
        authorizerKey = _authorizerKey;
        authorizer = vm.addr(_authorizerKey);
        ownerKey = _ownerKey;
        owner = vm.addr(_ownerKey);
        mandateId = _mandateId;
        merchant = _merchant;
        agent = _agent;
    }

    function _signVerdict(
        MandateGuardAccount.PaymentVerdict memory verdict,
        uint256 signerKey
    ) internal view returns (bytes memory signature) {
        bytes32 structHash = account.hashVerdict(verdict);
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", account.domainSeparator(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    /// @notice Attempts a normal or edge-case payment
    function executePayment(uint256 amountSeed, uint256 deltaSec) external {
        if (ghost_mandateRevoked) return;

        // Bound amount between 1 and MAX_TX_LIMIT
        uint256 amount = bound(amountSeed, 1, MAX_TX_LIMIT);

        ghost_nonceCounter++;
        bytes32 authId = keccak256(abi.encodePacked("INVARIANT_AUTH_", ghost_nonceCounter));
        uint256 expiry = block.timestamp + bound(deltaSec, 60, 86400);

        MandateGuardAccount.PaymentVerdict memory verdict = MandateGuardAccount.PaymentVerdict({
            verdict: 1, // ALLOW
            chainId: block.chainid,
            account: address(account),
            token: address(usdc),
            recipient: merchant,
            amount: amount,
            mandateId: mandateId,
            authorizationId: authId,
            expiry: expiry,
            mandateVersion: 1
        });

        bytes memory signature = _signVerdict(verdict, authorizerKey);

        if (ghost_totalSpent + amount <= MAX_CUMULATIVE) {
            // Should succeed
            account.executePayment(verdict, signature);
            ghost_totalSpent += amount;
            ghost_successfulExecutions++;
            ghost_usedAuthIds.push(authId);
        } else {
            // Exceeds cumulative limit -> MUST revert
            vm.expectRevert();
            account.executePayment(verdict, signature);
        }
    }

    /// @notice Tries to replay an already used authorization ID
    function attemptReplay(uint256 authIndexSeed) external {
        if (ghost_usedAuthIds.length == 0) return;

        uint256 idx = authIndexSeed % ghost_usedAuthIds.length;
        bytes32 usedAuthId = ghost_usedAuthIds[idx];

        MandateGuardAccount.PaymentVerdict memory verdict = MandateGuardAccount.PaymentVerdict({
            verdict: 1,
            chainId: block.chainid,
            account: address(account),
            token: address(usdc),
            recipient: merchant,
            amount: 1_000_000,
            mandateId: mandateId,
            authorizationId: usedAuthId,
            expiry: block.timestamp + 3600,
            mandateVersion: 1
        });

        bytes memory signature = _signVerdict(verdict, authorizerKey);

        // Replay MUST fail-closed with revert
        vm.expectRevert();
        account.executePayment(verdict, signature);
    }

    /// @notice Tries to send to an unauthorized recipient
    function attemptUnauthorizedRecipient(uint256 amountSeed, address attacker) external {
        if (attacker == merchant || attacker == address(0)) return;

        uint256 amount = bound(amountSeed, 1, MAX_TX_LIMIT);
        ghost_nonceCounter++;
        bytes32 authId = keccak256(abi.encodePacked("ATTACK_REC_", ghost_nonceCounter));

        MandateGuardAccount.PaymentVerdict memory verdict = MandateGuardAccount.PaymentVerdict({
            verdict: 1,
            chainId: block.chainid,
            account: address(account),
            token: address(usdc),
            recipient: attacker, // Unapproved recipient!
            amount: amount,
            mandateId: mandateId,
            authorizationId: authId,
            expiry: block.timestamp + 3600,
            mandateVersion: 1
        });

        bytes memory signature = _signVerdict(verdict, authorizerKey);

        vm.expectRevert();
        account.executePayment(verdict, signature);
    }

    /// @notice Tries an expired verdict
    function attemptExpiredVerdict(uint256 amountSeed) external {
        uint256 amount = bound(amountSeed, 1, MAX_TX_LIMIT);
        ghost_nonceCounter++;
        bytes32 authId = keccak256(abi.encodePacked("EXPIRED_AUTH_", ghost_nonceCounter));

        MandateGuardAccount.PaymentVerdict memory verdict = MandateGuardAccount.PaymentVerdict({
            verdict: 1,
            chainId: block.chainid,
            account: address(account),
            token: address(usdc),
            recipient: merchant,
            amount: amount,
            mandateId: mandateId,
            authorizationId: authId,
            expiry: block.timestamp - 1, // Already expired!
            mandateVersion: 1
        });

        bytes memory signature = _signVerdict(verdict, authorizerKey);

        vm.expectRevert();
        account.executePayment(verdict, signature);
    }

    /// @notice Tries a forged signature from unauthorized key
    function attemptForgedSignature(uint256 fakeKeySeed, uint256 amountSeed) external {
        uint256 fakeKey = bound(fakeKeySeed, 0x1000, 0xFFFFFF);
        if (fakeKey == authorizerKey) return;

        uint256 amount = bound(amountSeed, 1, MAX_TX_LIMIT);
        ghost_nonceCounter++;
        bytes32 authId = keccak256(abi.encodePacked("FORGED_AUTH_", ghost_nonceCounter));

        MandateGuardAccount.PaymentVerdict memory verdict = MandateGuardAccount.PaymentVerdict({
            verdict: 1,
            chainId: block.chainid,
            account: address(account),
            token: address(usdc),
            recipient: merchant,
            amount: amount,
            mandateId: mandateId,
            authorizationId: authId,
            expiry: block.timestamp + 3600,
            mandateVersion: 1
        });

        bytes memory signature = _signVerdict(verdict, fakeKey);

        vm.expectRevert();
        account.executePayment(verdict, signature);
    }

    function getUsedAuthIdsCount() external view returns (uint256) {
        return ghost_usedAuthIds.length;
    }
}

contract MandateGuardAccountInvariantTest is Test {
    MandateGuardAccount public account;
    MockUSDC public usdc;
    MandateGuardHandler public handler;

    uint256 internal constant INITIAL_USDC_DEPOSIT = 10_000_000_000; // 10,000 USDC
    uint256 internal constant MAX_TX_LIMIT = 50_000_000;           // $50.00 USDC
    uint256 internal constant MAX_CUMULATIVE = 500_000_000;        // $500.00 USDC

    bytes32 internal mandateId;
    address internal owner;
    address internal authorizer;
    address internal merchant;
    address internal agent;

    function setUp() public {
        uint256 ownerKey = 0xAA11;
        owner = vm.addr(ownerKey);

        uint256 authKey = 0xBB22;
        authorizer = vm.addr(authKey);

        merchant = address(0xCAFE);
        agent = address(0xAA99);

        usdc = new MockUSDC();
        account = new MandateGuardAccount(owner, authorizer);

        usdc.mint(address(account), INITIAL_USDC_DEPOSIT);

        mandateId = keccak256("INVARIANT_MANDATE_001");

        vm.prank(owner);
        account.registerMandate(
            mandateId,
            agent,
            address(usdc),
            merchant,
            MAX_TX_LIMIT,
            MAX_CUMULATIVE,
            block.timestamp,
            block.timestamp + 365 days
        );

        handler = new MandateGuardHandler(
            account,
            usdc,
            authKey,
            ownerKey,
            mandateId,
            merchant,
            agent
        );

        targetContract(address(handler));
    }

    /// @notice INVARIANT 1: Total cumulative spend on a mandate NEVER exceeds maxCumulativeAmount
    function invariant_CumulativeLimitNeverExceeded() public view {
        (,,,,,,, uint256 cumulativeSpent,,,) = account.mandates(mandateId);
        assertLe(cumulativeSpent, MAX_CUMULATIVE, "CRITICAL: Cumulative limit was exceeded!");
    }

    /// @notice INVARIANT 2: Token balance strictly equals initial balance minus authorized spend
    function invariant_BalanceIntegrity() public view {
        uint256 currentBal = usdc.balanceOf(address(account));
        uint256 expectedBal = INITIAL_USDC_DEPOSIT - handler.ghost_totalSpent();
        assertEq(currentBal, expectedBal, "CRITICAL: Token balance does not match total spent!");
    }

    /// @notice INVARIANT 3: Merchant balance strictly equals cumulative spent
    function invariant_MerchantReceivedCorrectAmount() public view {
        uint256 merchantBal = usdc.balanceOf(merchant);
        assertEq(merchantBal, handler.ghost_totalSpent(), "CRITICAL: Merchant balance mismatch!");
    }

    /// @notice INVARIANT 4: All recorded successful authorizations are marked as used
    function invariant_AllUsedAuthIdsMarked() public view {
        uint256 count = handler.getUsedAuthIdsCount();
        for (uint256 i = 0; i < count; i++) {
            bytes32 authId = handler.ghost_usedAuthIds(i);
            assertTrue(account.usedAuthorizations(authId), "CRITICAL: Used authorization was not recorded!");
        }
    }

    /// @notice INVARIANT 5: On-chain cumulative spend matches handler ghost spend
    function invariant_GhostSpendMatchesContract() public view {
        (,,,,,,, uint256 cumulativeSpent,,,) = account.mandates(mandateId);
        assertEq(cumulativeSpent, handler.ghost_totalSpent(), "CRITICAL: Mandate cumulative spend out of sync!");
    }
}
