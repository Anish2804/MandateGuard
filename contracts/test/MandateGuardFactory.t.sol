// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MandateGuardFactory.sol";
import "../src/MandateGuardAccount.sol";
import "../src/MockUSDC.sol";

contract MandateGuardFactoryTest is Test {
    MandateGuardFactory public factory;
    MockUSDC public token;

    address public platformAdmin = makeAddr("platformAdmin");
    address public defaultSigner = makeAddr("defaultSigner");
    address public customSigner = makeAddr("customSigner");

    address public userAlice = makeAddr("userAlice");
    address public userBob = makeAddr("userBob");
    address public merchant = makeAddr("merchant");
    address public agent = makeAddr("agent");

    uint256 internal defaultSignerPrivateKey = 0xA11CE;
    address internal signerAddress;

    function setUp() public {
        signerAddress = vm.addr(defaultSignerPrivateKey);

        vm.prank(platformAdmin);
        factory = new MandateGuardFactory(signerAddress);

        token = new MockUSDC();
    }

    function test_FactoryInitialization() public view {
        assertEq(factory.owner(), platformAdmin);
        assertEq(factory.defaultAuthorizerSigner(), signerAddress);
        assertEq(factory.totalAccounts(), 0);
    }

    function test_CreateAccount_Success() public {
        vm.prank(userAlice);
        address accountAddr = factory.createAccount();

        assertTrue(accountAddr != address(0));
        assertTrue(factory.isDeployedAccount(accountAddr));
        assertEq(factory.totalAccounts(), 1);

        address[] memory aliceAccounts = factory.getAccountsByOwner(userAlice);
        assertEq(aliceAccounts.length, 1);
        assertEq(aliceAccounts[0], accountAddr);

        MandateGuardAccount account = MandateGuardAccount(accountAddr);
        assertEq(account.owner(), userAlice);
        assertEq(account.authorizerSigner(), signerAddress);
    }

    function test_CreateAccountWithCustomSigner() public {
        vm.prank(userAlice);
        address accountAddr = factory.createAccountWithCustomSigner(customSigner);

        MandateGuardAccount account = MandateGuardAccount(accountAddr);
        assertEq(account.owner(), userAlice);
        assertEq(account.authorizerSigner(), customSigner);
    }

    function test_CreateAccountDeterministic_MatchesPrediction() public {
        bytes32 salt = keccak256("ALICE_PRIMARY_WALLET");

        address predicted = factory.predictAccountAddress(userAlice, signerAddress, salt);

        vm.prank(userAlice);
        address deployed = factory.createAccountDeterministic(salt);

        assertEq(deployed, predicted);
        assertTrue(factory.isDeployedAccount(deployed));

        MandateGuardAccount account = MandateGuardAccount(deployed);
        assertEq(account.owner(), userAlice);
    }

    function test_MultipleUsersGetIsolatedAccounts() public {
        vm.prank(userAlice);
        address aliceAcc = factory.createAccount();

        vm.prank(userBob);
        address bobAcc = factory.createAccount();

        assertTrue(aliceAcc != bobAcc);

        assertEq(factory.getAccountsByOwner(userAlice).length, 1);
        assertEq(factory.getAccountsByOwner(userBob).length, 1);
        assertEq(factory.totalAccounts(), 2);

        // Verify Bob cannot administer Alice's account
        bytes32 mandateId = keccak256("TEST_MANDATE");
        vm.prank(userBob);
        vm.expectRevert(MandateGuardAccount.Unauthorized.selector);
        MandateGuardAccount(aliceAcc).registerMandate(
            mandateId,
            agent,
            address(token),
            merchant,
            100e6,
            500e6,
            block.timestamp,
            block.timestamp + 1000
        );

        // Verify Alice can administer her own account
        vm.prank(userAlice);
        MandateGuardAccount(aliceAcc).registerMandate(
            mandateId,
            agent,
            address(token),
            merchant,
            100e6,
            500e6,
            block.timestamp,
            block.timestamp + 1000
        );
    }

    function test_DeployedAccountCanExecuteAuthorizedPayment() public {
        vm.prank(userAlice);
        address accountAddr = factory.createAccount();
        MandateGuardAccount account = MandateGuardAccount(accountAddr);

        // Fund account with 1,000 USDC
        token.mint(accountAddr, 1000e6);
        assertEq(token.balanceOf(accountAddr), 1000e6);

        // Register mandate
        bytes32 mandateId = keccak256("ALICE_MANDATE_01");
        vm.prank(userAlice);
        account.registerMandate(
            mandateId,
            agent,
            address(token),
            merchant,
            50e6,
            500e6,
            block.timestamp,
            block.timestamp + 1 days
        );

        // Construct valid EIP-712 PaymentVerdict
        bytes32 authId = keccak256("AUTH_001");
        MandateGuardAccount.PaymentVerdict memory verdict = MandateGuardAccount.PaymentVerdict({
            verdict: 1, // ALLOW
            chainId: block.chainid,
            account: accountAddr,
            token: address(token),
            recipient: merchant,
            amount: 25e6,
            mandateId: mandateId,
            authorizationId: authId,
            expiry: block.timestamp + 300,
            mandateVersion: 1
        });

        // Compute typed-data digest and sign with signer key
        bytes32 structHash = keccak256(
            abi.encode(
                account.PAYMENT_VERDICT_TYPEHASH(),
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

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", account.domainSeparator(), structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(defaultSignerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute payment
        account.executePayment(verdict, signature);

        // Verify token transfer
        assertEq(token.balanceOf(merchant), 25e6);
        assertEq(token.balanceOf(accountAddr), 975e6);
        assertTrue(account.usedAuthorizations(authId));
    }

    function test_RevertWhen_ZeroAddressDefaultSigner() public {
        vm.prank(platformAdmin);
        vm.expectRevert(MandateGuardFactory.ZeroAddress.selector);
        new MandateGuardFactory(address(0));
    }

    function test_AdminUpdateDefaultAuthorizer() public {
        address newSigner = makeAddr("newSigner");

        // Non-admin reverts
        vm.prank(userAlice);
        vm.expectRevert();
        factory.setDefaultAuthorizerSigner(newSigner);

        // Admin succeeds
        vm.prank(platformAdmin);
        factory.setDefaultAuthorizerSigner(newSigner);
        assertEq(factory.defaultAuthorizerSigner(), newSigner);
    }
}
