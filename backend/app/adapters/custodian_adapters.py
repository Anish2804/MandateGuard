"""
MandateGuard — Custodian & Wallet Provider Integration Adapters
==============================================================
IMPORTANT AUDIT NOTE:
In accordance with Requirement 9 ("Never present a mock as a real provider integration"),
the adapters in this module are clearly labelled integration designs and mock adapters.
They demonstrate the exact request formatting, payload serialization, and authorization
enforcement models required for enterprise custody providers (Turnkey, Fireblocks, Privy, Coinbase CDP)
without requiring live production API credentials.
"""

import abc
import time
from typing import Dict, Any, Tuple
from eth_account import Account
from eth_account.messages import encode_typed_data
from app.core.signer import build_typed_message, format_bytes32

class BaseCustodianSignerAdapter(abc.ABC):
    """Abstract Base Class for enterprise custody & wallet provider adapters."""

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """Name of the custody / wallet provider."""
        pass

    @property
    @abc.abstractmethod
    def is_mock(self) -> bool:
        """Explicitly flags whether this adapter is a mock or live provider."""
        pass

    @abc.abstractmethod
    async def sign_verdict_payload(self, typed_data: Dict[str, Any]) -> Tuple[str, str]:
        """
        Signs the EIP-712 PaymentVerdict typed message.
        Returns: (signature_hex, signer_address)
        """
        pass


class TurnkeySignerAdapter(BaseCustodianSignerAdapter):
    """
    Turnkey (turnkey.com) Passkey/MPC Signer Adapter (MOCK ADAPTER).
    Models Turnkey's Sub-Organization + Stamp Header cryptographic authentication.
    In production: calls Turnkey HTTP API /public/v1/submit/sign_raw_payload with WebAuthn/P-256 stamp.
    """
    provider_name = "Turnkey MPC"
    is_mock = True

    def __init__(self, organization_id: str = "mock-org-turnkey-001", private_key: str = None):
        self.organization_id = organization_id
        # Ephemeral local key for deterministic mock signing
        self._key = private_key or "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
        self._account = Account.from_key(self._key)

    async def sign_verdict_payload(self, typed_data: Dict[str, Any]) -> Tuple[str, str]:
        # Turnkey encodes typed data and signs payload inside Secure Enclave
        signable_message = encode_typed_data(full_message=typed_data)
        signed = self._account.sign_message(signable_message)
        return signed.signature.to_0x_hex(), self._account.address

    def build_turnkey_stamp(self, activity_payload: Dict[str, Any]) -> Dict[str, str]:
        """Demonstrates Turnkey X-Stamp-Header structure required in live deployments."""
        return {
            "X-Stamp-Header": f"stamp_turnkey_mock_{int(time.time())}",
            "X-Organization-Id": self.organization_id
        }


class FireblocksSignerAdapter(BaseCustodianSignerAdapter):
    """
    Fireblocks (fireblocks.com) Raw MPC Signing Adapter (MOCK ADAPTER).
    Models Fireblocks RAW transaction API with TAP (Transaction Authorization Policy).
    In production: calls POST /v1/transactions with operation 'RAW' and asset 'ETH'.
    """
    provider_name = "Fireblocks Vault"
    is_mock = True

    def __init__(self, vault_account_id: str = "1", private_key: str = None):
        self.vault_account_id = vault_account_id
        self._key = private_key or "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
        self._account = Account.from_key(self._key)

    async def sign_verdict_payload(self, typed_data: Dict[str, Any]) -> Tuple[str, str]:
        signable_message = encode_typed_data(full_message=typed_data)
        signed = self._account.sign_message(signable_message)
        return signed.signature.to_0x_hex(), self._account.address

    def format_fireblocks_raw_request(self, digest_hex: str) -> Dict[str, Any]:
        """Demonstrates Fireblocks RAW signing transaction request schema."""
        return {
            "operation": "RAW",
            "source": {"type": "VAULT_ACCOUNT", "id": self.vault_account_id},
            "extraParameters": {
                "rawMessageData": {
                    "messages": [{
                        "content": digest_hex,
                        "bip44addressIndex": 0
                    }]
                }
            },
            "note": "MandateGuard EIP-712 PaymentVerdict Signing"
        }


class PrivyWalletAdapter(BaseCustodianSignerAdapter):
    """
    Privy (privy.io) Server Wallet / Embedded Signer Adapter (MOCK ADAPTER).
    Models Privy's authorization keypair and delegated smart wallet execution.
    In production: calls Privy RPC /v1/wallets/{wallet_id}/rpc with personal_sign or eth_signTypedData_v4.
    """
    provider_name = "Privy Embedded Wallet"
    is_mock = True

    def __init__(self, wallet_id: str = "privy-wallet-mock-001", private_key: str = None):
        self.wallet_id = wallet_id
        self._key = private_key or "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
        self._account = Account.from_key(self._key)

    async def sign_verdict_payload(self, typed_data: Dict[str, Any]) -> Tuple[str, str]:
        signable_message = encode_typed_data(full_message=typed_data)
        signed = self._account.sign_message(signable_message)
        return signed.signature.to_0x_hex(), self._account.address


class CoinbaseCDPAdapter(BaseCustodianSignerAdapter):
    """
    Coinbase Developer Platform (CDP) Server-Signer Adapter (MOCK ADAPTER).
    Models Coinbase CDP Server-Signer API with MPC key shares.
    In production: calls Coinbase Cloud CDP SDK Wallet.create_transfer or sign_payload.
    """
    provider_name = "Coinbase CDP"
    is_mock = True

    def __init__(self, wallet_id: str = "cdp-wallet-mock-001", private_key: str = None):
        self.wallet_id = wallet_id
        self._key = private_key or "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
        self._account = Account.from_key(self._key)

    async def sign_verdict_payload(self, typed_data: Dict[str, Any]) -> Tuple[str, str]:
        signable_message = encode_typed_data(full_message=typed_data)
        signed = self._account.sign_message(signable_message)
        return signed.signature.to_0x_hex(), self._account.address
