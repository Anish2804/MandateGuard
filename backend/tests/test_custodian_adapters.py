import pytest
from eth_account.messages import encode_typed_data
from eth_account import Account
from app.core.signer import build_typed_message, format_bytes32
from app.adapters.custodian_adapters import (
    TurnkeySignerAdapter,
    FireblocksSignerAdapter,
    PrivyWalletAdapter,
    CoinbaseCDPAdapter,
)

SAMPLE_PARAMS = {
    "verdict": 1,
    "chain_id": 84532,
    "account": "0xB07e049cc3245e8a765bA9bfb537CF5D5fFd4D68",
    "token": "0x9CA71737B76EE51d2366C53CC8CdF21DC5246097",
    "recipient": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "amount": 50_000_000,
    "mandate_id": "0x" + "aa" * 32,
    "authorization_id": "0x" + "bb" * 32,
    "expiry": 1893456000,
    "mandate_version": 1,
}

@pytest.mark.asyncio
async def test_custodian_adapters_signature_correctness_and_mock_flag():
    adapters = [
        TurnkeySignerAdapter(),
        FireblocksSignerAdapter(),
        PrivyWalletAdapter(),
        CoinbaseCDPAdapter(),
    ]

    typed_msg = build_typed_message(**SAMPLE_PARAMS)
    encoded = encode_typed_data(full_message=typed_msg)

    for adapter in adapters:
        # Requirement 9: Never present a mock as a real provider integration
        assert adapter.is_mock is True, f"{adapter.provider_name} must be explicitly flagged as mock"
        assert adapter.provider_name in ["Turnkey MPC", "Fireblocks Vault", "Privy Embedded Wallet", "Coinbase CDP"]

        sig_hex, signer_addr = await adapter.sign_verdict_payload(typed_msg)
        assert sig_hex.startswith("0x")
        assert len(sig_hex) == 132  # 65 bytes in hex + 0x

        # Cryptographically verify the recovered address matches the adapter's signer address
        recovered = Account.recover_message(encoded, signature=sig_hex)
        assert recovered.lower() == signer_addr.lower()

@pytest.mark.asyncio
async def test_custodian_adapters_tampering_detection():
    adapter = TurnkeySignerAdapter()
    typed_msg = build_typed_message(**SAMPLE_PARAMS)
    sig_hex, signer_addr = await adapter.sign_verdict_payload(typed_msg)

    # Tamper with amount
    tampered_params = dict(SAMPLE_PARAMS)
    tampered_params["amount"] = 999_999_999
    tampered_msg = build_typed_message(**tampered_params)
    tampered_encoded = encode_typed_data(full_message=tampered_msg)

    tampered_recovered = Account.recover_message(tampered_encoded, signature=sig_hex)
    assert tampered_recovered.lower() != signer_addr.lower()

def test_turnkey_and_fireblocks_schema_helpers():
    turnkey = TurnkeySignerAdapter(organization_id="org-test-123")
    stamp = turnkey.build_turnkey_stamp({"test": "activity"})
    assert stamp["X-Organization-Id"] == "org-test-123"
    assert stamp["X-Stamp-Header"].startswith("stamp_turnkey_mock_")

    fireblocks = FireblocksSignerAdapter(vault_account_id="vault-42")
    req = fireblocks.format_fireblocks_raw_request("0xdeadbeef")
    assert req["operation"] == "RAW"
    assert req["source"]["id"] == "vault-42"
    assert req["extraParameters"]["rawMessageData"]["messages"][0]["content"] == "0xdeadbeef"
