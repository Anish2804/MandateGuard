import pytest
from web3 import Web3
from eth_account import Account
from app.core.signer import (
    sign_payment_verdict,
    recover_signer_from_verdict,
    build_typed_message,
)

# Test private key
TEST_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
EXPECTED_SIGNER = Account.from_key(TEST_PRIVATE_KEY).address

def test_signature_and_recovery_consistency():
    chain_id = 31337
    account = "0x1111111111111111111111111111111111111111"
    token = "0x2222222222222222222222222222222222222222"
    recipient = "0x3333333333333333333333333333333333333333"
    amount = 25_000_000
    mandate_id = "0x" + "a" * 64
    authorization_id = "0x" + "b" * 64
    expiry = 1893456000
    mandate_version = 1

    sig, signer_addr, auth_id_hex = sign_payment_verdict(
        verdict=1,
        chain_id=chain_id,
        account=account,
        token=token,
        recipient=recipient,
        amount=amount,
        mandate_id=mandate_id,
        authorization_id=authorization_id,
        expiry=expiry,
        mandate_version=mandate_version,
        private_key=TEST_PRIVATE_KEY,
    )

    assert signer_addr.lower() == EXPECTED_SIGNER.lower()
    assert sig.startswith("0x")

    # Recover signer
    recovered = recover_signer_from_verdict(
        verdict=1,
        chain_id=chain_id,
        account=account,
        token=token,
        recipient=recipient,
        amount=amount,
        mandate_id=mandate_id,
        authorization_id=authorization_id,
        expiry=expiry,
        mandate_version=mandate_version,
        signature=sig,
    )

    assert recovered.lower() == EXPECTED_SIGNER.lower()

def test_recovery_fails_if_any_parameter_is_tampered():
    chain_id = 31337
    account = "0x1111111111111111111111111111111111111111"
    token = "0x2222222222222222222222222222222222222222"
    recipient = "0x3333333333333333333333333333333333333333"
    amount = 25_000_000
    mandate_id = "0x" + "a" * 64
    authorization_id = "0x" + "b" * 64
    expiry = 1893456000
    mandate_version = 1

    sig, _, _ = sign_payment_verdict(
        verdict=1,
        chain_id=chain_id,
        account=account,
        token=token,
        recipient=recipient,
        amount=amount,
        mandate_id=mandate_id,
        authorization_id=authorization_id,
        expiry=expiry,
        mandate_version=mandate_version,
        private_key=TEST_PRIVATE_KEY,
    )

    # Tamper with amount
    recovered_tampered_amount = recover_signer_from_verdict(
        verdict=1,
        chain_id=chain_id,
        account=account,
        token=token,
        recipient=recipient,
        amount=amount + 1,
        mandate_id=mandate_id,
        authorization_id=authorization_id,
        expiry=expiry,
        mandate_version=mandate_version,
        signature=sig,
    )
    assert recovered_tampered_amount.lower() != EXPECTED_SIGNER.lower()

    # Tamper with recipient
    recovered_tampered_recipient = recover_signer_from_verdict(
        verdict=1,
        chain_id=chain_id,
        account=account,
        token=token,
        recipient="0x9999999999999999999999999999999999999999",
        amount=amount,
        mandate_id=mandate_id,
        authorization_id=authorization_id,
        expiry=expiry,
        mandate_version=mandate_version,
        signature=sig,
    )
    assert recovered_tampered_recipient.lower() != EXPECTED_SIGNER.lower()
