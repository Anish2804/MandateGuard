// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MandateGuardAccount.sol";
import "../src/MockUSDC.sol";

contract MandateGuardAccountTest is Test {
    MandateGuardAccount public account;
    MockUSDC public usdc;

    // Keys & Addresses
    uint256 internal ownerPrivateKey;
    address internal owner;

    uint256 internal authorizerPrivateKey;
    address internal authorizer;

    uint256 internal attackerPrivateKey;
    address internal attacker;

    address internal merchant;
    address internal agent;

    bytes32 internal defaultMandateId;
    uint256 internal constant MAX_TX_LIMIT = 50_000_000;       // $50.00 USDC
    uint256 internal constant MAX_CUMULATIVE = 500_000_000;    // $500.00 USDC

    function setUp() public {
        ownerPrivateKey = 0xA11CE;
        owner = vm.addr(ownerPrivateKey);

        authorizerPrivateKey = 0xB0B;
        authorizer = vm.addr(authorizerPrivateKey);

        attackerPrivateKey = 0xBAD;
        attacker = vm.addr(attackerPrivateKey);

        merchant = address(0xCAFE);
        agent = address(0xAA99);

        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Deploy MandateGuardAccount
        account = new MandateGuardAccount(owner, authorizer);

        // Fund smart account with 10,000 USDC
        usdc.mint(address(account), 10_000_000_000);

        // Setup default mandate
        defaultMandateId = keccak256("MANDATE_COMPUTE_001");

        vm.prank(owner);
        account.registerMandate(
            defaultMandateId,
            agent,
            address(usdc),
            merchant,
            MAX_TX_LIMIT,
            MAX_CUMULATIVE,
            block.timestamp,
            block.timestamp + 30 days
        );
    }

    // --- Helper: Build & Sign Verdict ---

    function _createAndSignVerdict(
        uint8 verdictStatus,
        uint256 chainId,
        address accountAddr,
        address tokenAddr,
        address recipientAddr,
        uint256 amount,
        bytes32 mandateId,
        bytes32 authId,
        uint256 expiry,
        uint256 mandateVersion,
        uint256 signerKey
    ) internal view returns (MandateGuardAccount.PaymentVerdict memory verdict, bytes memory signature) {
        verdict = MandateGuardAccount.PaymentVerdict({
            verdict: verdictStatus,
            chainId: chainId,
            account: accountAddr,
            token: tokenAddr,
            recipient: recipientAddr,
            amount: amount,
            mandateId: mandateId,
            authorizationId: authId,
            expiry: expiry,
            mandateVersion: mandateVersion
        });

        bytes32 structHash = account.hashVerdict(verdict);
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", account.domainSeparator(), structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    // --- 1. Successful ALLOW Payment ---

    function test_ValidAllowVerdictSucceeds() public {
        uint256 transferAmount = 25_000_000; // $25.00 USDC
        bytes32 authId = keccak256("AUTH_001");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1, // ALLOW
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            transferAmount,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1, // Version 1
            authorizerPrivateKey
        );

        uint256 preMerchantBal = usdc.balanceOf(merchant);
        uint256 preAccountBal = usdc.balanceOf(address(account));

        account.executePayment(verdict, signature);

        assertEq(usdc.balanceOf(merchant), preMerchantBal + transferAmount);
        assertEq(usdc.balanceOf(address(account)), preAccountBal - transferAmount);
        assertTrue(account.usedAuthorizations(authId));

        (,,,,,,, uint256 cumulativeSpent,,,) = account.mandates(defaultMandateId);
        assertEq(cumulativeSpent, transferAmount);
    }

    // --- 2. DENY Verdict Fails ---

    function test_RevertWhen_DenyVerdictSubmitted() public {
        bytes32 authId = keccak256("AUTH_DENY");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            0, // DENY
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        vm.expectRevert(MandateGuardAccount.DenyVerdictNotExecutable.selector);
        account.executePayment(verdict, signature);
    }

    // --- 3. Wrong Signer Fails ---

    function test_RevertWhen_SignedByUnauthorizedKey() public {
        bytes32 authId = keccak256("AUTH_ATTACKER_KEY");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            attackerPrivateKey // Malicious key!
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.InvalidSigner.selector,
                attacker,
                authorizer
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 4. Altered Recipient Fails ---

    function test_RevertWhen_RecipientAlteredAfterSigning() public {
        bytes32 authId = keccak256("AUTH_ALTER_RECIPIENT");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        // Attacker intercepts and alters recipient to attacker
        verdict.recipient = attacker;

        // Signature verification will fail because digest does not match
        vm.expectRevert();
        account.executePayment(verdict, signature);
    }

    // --- 5. Altered Amount Fails ---

    function test_RevertWhen_AmountAlteredAfterSigning() public {
        bytes32 authId = keccak256("AUTH_ALTER_AMOUNT");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        // Attacker alters amount to 40 USDC
        verdict.amount = 40_000_000;

        vm.expectRevert();
        account.executePayment(verdict, signature);
    }

    // --- 6. Wrong Token Fails ---

    function test_RevertWhen_TokenMismatch() public {
        MockUSDC fakeToken = new MockUSDC();
        bytes32 authId = keccak256("AUTH_FAKE_TOKEN");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(fakeToken),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.TokenMismatch.selector,
                address(usdc),
                address(fakeToken)
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 7. Wrong Account Fails ---

    function test_RevertWhen_WrongAccountSpecified() public {
        bytes32 authId = keccak256("AUTH_WRONG_ACCOUNT");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(0xDEADBEEF), // Wrong account
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.InvalidAccount.selector,
                address(account),
                address(0xDEADBEEF)
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 8. Wrong Chain ID Fails ---

    function test_RevertWhen_WrongChainId() public {
        bytes32 authId = keccak256("AUTH_WRONG_CHAIN");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            999999, // Wrong Chain
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.InvalidChainId.selector,
                block.chainid,
                999999
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 9. Expired Verdict Fails ---

    function test_RevertWhen_VerdictExpired() public {
        bytes32 authId = keccak256("AUTH_EXPIRED");
        uint256 pastExpiry = block.timestamp - 1;

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            pastExpiry,
            1,
            authorizerPrivateKey
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.VerdictExpired.selector,
                pastExpiry,
                block.timestamp
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 10. Replay Attack Fails ---

    function test_RevertWhen_AuthorizationReplayed() public {
        bytes32 authId = keccak256("AUTH_REPLAY_TEST");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        // First call succeeds
        account.executePayment(verdict, signature);

        // Second call with same authId reverts!
        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.AuthorizationAlreadyUsed.selector,
                authId
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 11. Revoked Mandate Fails ---

    function test_RevertWhen_MandateRevoked() public {
        bytes32 authId = keccak256("AUTH_AFTER_REVOKE");

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            10_000_000,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        // Human owner revokes mandate on-chain
        vm.prank(owner);
        account.revokeMandate(defaultMandateId);

        // Execution must fail even with valid signature
        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.MandateRevokedError.selector,
                defaultMandateId
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 12. Above-Limit Transfer Fails ---

    function test_RevertWhen_AmountExceedsTxLimit() public {
        bytes32 authId = keccak256("AUTH_EXCEED_LIMIT");
        uint256 excessiveAmount = MAX_TX_LIMIT + 1; // Over 50 USDC

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            excessiveAmount,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.AmountExceedsTxLimit.selector,
                excessiveAmount,
                MAX_TX_LIMIT
            )
        );
        account.executePayment(verdict, signature);
    }

    // --- 13. Above Cumulative Spending Limit Fails ---

    function test_RevertWhen_CumulativeLimitExceeded() public {
        // Register a small mandate with $30 cumulative limit and $20 per tx
        bytes32 smallMandateId = keccak256("SMALL_MANDATE");
        vm.prank(owner);
        account.registerMandate(
            smallMandateId,
            agent,
            address(usdc),
            merchant,
            20_000_000, // $20 max per tx
            30_000_000, // $30 cumulative limit
            block.timestamp,
            block.timestamp + 1 days
        );

        // First payment of $20 succeeds
        (
            MandateGuardAccount.PaymentVerdict memory verdict1,
            bytes memory sig1
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            20_000_000,
            smallMandateId,
            keccak256("AUTH_CUM_1"),
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );
        account.executePayment(verdict1, sig1);

        // Second payment of $15 would reach $35 cumulative > $30 limit
        (
            MandateGuardAccount.PaymentVerdict memory verdict2,
            bytes memory sig2
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            15_000_000,
            smallMandateId,
            keccak256("AUTH_CUM_2"),
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                MandateGuardAccount.AmountExceedsCumulativeLimit.selector,
                15_000_000,
                10_000_000 // Only 10 remaining
            )
        );
        account.executePayment(verdict2, sig2);
    }

    // --- 14. Unauthorized Admin Changes Fail ---

    function test_RevertWhen_NonOwnerCallsAdminFunctions() public {
        vm.startPrank(attacker);

        vm.expectRevert(MandateGuardAccount.Unauthorized.selector);
        account.setAuthorizerSigner(attacker);

        vm.expectRevert(MandateGuardAccount.Unauthorized.selector);
        account.revokeMandate(defaultMandateId);

        vm.expectRevert(MandateGuardAccount.Unauthorized.selector);
        account.emergencyWithdrawToken(address(usdc), attacker, 1_000_000);

        vm.expectRevert(MandateGuardAccount.Unauthorized.selector);
        account.transferOwnership(attacker);

        vm.stopPrank();
    }

    // --- 15. Owner Emergency Withdrawal Works & Emits Event ---

    function test_OwnerEmergencyWithdrawToken() public {
        uint256 withdrawAmt = 500_000_000;
        address safeWallet = address(0x5AFE);

        vm.prank(owner);
        account.emergencyWithdrawToken(address(usdc), safeWallet, withdrawAmt);

        assertEq(usdc.balanceOf(safeWallet), withdrawAmt);
    }

    // --- 16. Fuzz Testing: Random Valid Amounts within Limit ---

    function testFuzz_ValidAmountsWithinLimit(uint32 amount) public {
        vm.assume(amount > 0 && amount <= MAX_TX_LIMIT);

        bytes32 authId = keccak256(abi.encodePacked("FUZZ_AUTH", amount));

        (
            MandateGuardAccount.PaymentVerdict memory verdict,
            bytes memory signature
        ) = _createAndSignVerdict(
            1,
            block.chainid,
            address(account),
            address(usdc),
            merchant,
            amount,
            defaultMandateId,
            authId,
            block.timestamp + 1 hours,
            1,
            authorizerPrivateKey
        );

        uint256 preMerchantBal = usdc.balanceOf(merchant);
        account.executePayment(verdict, signature);

        assertEq(usdc.balanceOf(merchant), preMerchantBal + amount);
        assertTrue(account.usedAuthorizations(authId));
    }
}
