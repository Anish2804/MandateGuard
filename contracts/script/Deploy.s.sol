// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MandateGuardAccount.sol";
import "../src/MandateGuardFactory.sol";
import "../src/MockUSDC.sol";

contract DeployScript is Script {
    function run() external returns (MockUSDC usdc, MandateGuardAccount account, MandateGuardFactory factory) {
        // Read deployer private key from environment or fallback to Anvil Account #0
        uint256 deployerKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerKey);

        // Read authorizer signer address from environment or fallback to Anvil Account #1
        address authorizer = vm.envOr(
            "AUTHORIZER_ADDRESS",
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
        );

        vm.startBroadcast(deployerKey);

        // 1. Deploy Mock USDC
        usdc = new MockUSDC();

        // 2. Deploy MandateGuardAccount with deployer as owner and designated authorizer
        account = new MandateGuardAccount(deployer, authorizer);

        // 3. Deploy MandateGuardFactory
        factory = new MandateGuardFactory(authorizer);

        // 4. Fund MandateGuardAccount with 50,000 mUSDC for testing
        usdc.mint(address(account), 50_000 * 10 ** 6);

        // 5. Register a sample seed mandate for testing
        bytes32 sampleMandateId = keccak256("MANDATE_SAMPLE_DEV_001");
        address sampleMerchant = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC); // Anvil Account #2
        address sampleAgent = address(0x90F79bf6EB2c4f870365E785982E1f101E93b906);    // Anvil Account #3

        account.registerMandate(
            sampleMandateId,
            sampleAgent,
            address(usdc),
            sampleMerchant,
            50_000_000,    // $50.00 USDC max per tx
            500_000_000,   // $500.00 USDC cumulative limit
            block.timestamp,
            block.timestamp + 365 days
        );

        vm.stopBroadcast();

        console.log("=== MandateGuard Deployment Summary ===");
        console.log("Deployer / Owner :", deployer);
        console.log("Authorizer Signer:", authorizer);
        console.log("MockUSDC Address :", address(usdc));
        console.log("Smart Account    :", address(account));
        console.log("Factory Address  :", address(factory));
        console.log("Sample Mandate ID:", vm.toString(sampleMandateId));
    }
}
