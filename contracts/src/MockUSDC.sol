// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Standard ERC-20 token simulating USD Coin (USDC) with 6 decimals.
 * @dev Intended strictly for local development and integration testing.
 */
contract MockUSDC is ERC20 {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Mock USD Coin", "mUSDC") {
        // Mint initial supply of 1,000,000 mUSDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS);
    }

    /**
     * @notice Override decimals to match real USDC (6 decimals).
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Allows arbitrary minting for testing scenarios.
     * @param to Recipient address
     * @param amount Token amount in base units (6 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Allows burning tokens for testing edge cases.
     * @param from Address from which to burn tokens
     * @param amount Token amount in base units (6 decimals)
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
