// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MandateGuardAccount.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MandateGuardFactory
 * @notice Factory for deploying and indexing isolated MandateGuardAccount instances
 *         for multiple users and organizations.
 * @dev Supports both direct deployment and CREATE2 deterministic deployments.
 */
contract MandateGuardFactory is Ownable {
    // --- State Variables ---

    address public defaultAuthorizerSigner;

    // Registry of all deployed accounts
    address[] public allAccounts;
    mapping(address => bool) public isDeployedAccount;

    // Accounts mapped to owner
    mapping(address => address[]) private _ownerAccounts;

    // --- Events ---

    event AccountCreated(
        address indexed owner,
        address indexed account,
        address indexed authorizerSigner,
        uint256 accountIndex,
        bytes32 salt
    );

    event DefaultAuthorizerUpdated(
        address indexed oldSigner,
        address indexed newSigner
    );

    // --- Custom Errors ---

    error ZeroAddress();
    error DeploymentFailed();

    // --- Constructor ---

    constructor(address _defaultAuthorizerSigner) Ownable(msg.sender) {
        if (_defaultAuthorizerSigner == address(0)) revert ZeroAddress();
        defaultAuthorizerSigner = _defaultAuthorizerSigner;
    }

    // --- External Deployers ---

    /**
     * @notice Deploy a new MandateGuardAccount for msg.sender with default authorizer
     * @return account Address of the newly deployed smart account
     */
    function createAccount() external returns (address account) {
        return createAccountWithCustomSigner(defaultAuthorizerSigner);
    }

    /**
     * @notice Deploy a new MandateGuardAccount for msg.sender with a custom authorizer
     * @param _authorizerSigner The authorized verdict signer for this account
     * @return account Address of the newly deployed smart account
     */
    function createAccountWithCustomSigner(
        address _authorizerSigner
    ) public returns (address account) {
        if (_authorizerSigner == address(0)) revert ZeroAddress();

        MandateGuardAccount newAcc = new MandateGuardAccount(
            msg.sender,
            _authorizerSigner
        );
        account = address(newAcc);

        _registerAccount(msg.sender, account, _authorizerSigner, bytes32(0));
    }

    /**
     * @notice Deterministically deploy a MandateGuardAccount using CREATE2
     * @param salt Unique salt for deterministic address derivation
     * @return account Address of the newly deployed smart account
     */
    function createAccountDeterministic(
        bytes32 salt
    ) external returns (address account) {
        return createAccountDeterministicWithSigner(salt, defaultAuthorizerSigner);
    }

    /**
     * @notice Deterministically deploy a MandateGuardAccount using CREATE2 with custom authorizer
     * @param salt Unique salt for deterministic address derivation
     * @param _authorizerSigner The authorized verdict signer for this account
     * @return account Address of the newly deployed smart account
     */
    function createAccountDeterministicWithSigner(
        bytes32 salt,
        address _authorizerSigner
    ) public returns (address account) {
        if (_authorizerSigner == address(0)) revert ZeroAddress();

        MandateGuardAccount newAcc = new MandateGuardAccount{salt: salt}(
            msg.sender,
            _authorizerSigner
        );
        account = address(newAcc);

        _registerAccount(msg.sender, account, _authorizerSigner, salt);
    }

    // --- View Functions ---

    /**
     * @notice Get all accounts owned by a specific address
     * @param _owner The owner wallet address
     * @return Array of account addresses
     */
    function getAccountsByOwner(
        address _owner
    ) external view returns (address[] memory) {
        return _ownerAccounts[_owner];
    }

    /**
     * @notice Get total count of all accounts deployed by this factory
     * @return Total accounts count
     */
    function totalAccounts() external view returns (uint256) {
        return allAccounts.length;
    }

    /**
     * @notice Compute deterministic CREATE2 address prior to deployment
     * @param _owner Expected owner of the account
     * @param _signer Expected authorizer signer of the account
     * @param salt Unique salt
     * @return Predicted address
     */
    function predictAccountAddress(
        address _owner,
        address _signer,
        bytes32 salt
    ) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(MandateGuardAccount).creationCode,
            abi.encode(_owner, _signer)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );

        return address(uint160(uint256(hash)));
    }

    // --- Admin Functions ---

    /**
     * @notice Update the default platform authorizer signer
     * @param _newSigner New default authorizer address
     */
    function setDefaultAuthorizerSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert ZeroAddress();
        address oldSigner = defaultAuthorizerSigner;
        defaultAuthorizerSigner = _newSigner;
        emit DefaultAuthorizerUpdated(oldSigner, _newSigner);
    }

    // --- Internal Helpers ---

    function _registerAccount(
        address _owner,
        address _account,
        address _authorizerSigner,
        bytes32 _salt
    ) internal {
        allAccounts.push(_account);
        isDeployedAccount[_account] = true;
        _ownerAccounts[_owner].push(_account);

        emit AccountCreated(
            _owner,
            _account,
            _authorizerSigner,
            allAccounts.length - 1,
            _salt
        );
    }
}
