import pytest
from app.adapters.solana_adapter import (
    SolanaMandateGuardAdapter,
    SQUADS_V4_PROGRAM_ID,
    MANDATEGUARD_SOLANA_PROGRAM_ID,
)

def test_solana_pda_derivation():
    pda_info = SolanaMandateGuardAdapter.derive_mandate_pda(
        owner_pubkey="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        mandate_id="mandate_solana_test_001"
    )
    assert pda_info["pda_address"].startswith("PDA_")
    assert pda_info["bump"] == 254
    assert pda_info["program_id"] == MANDATEGUARD_SOLANA_PROGRAM_ID

def test_solana_borsh_serialization():
    verdict_bytes = SolanaMandateGuardAdapter.serialize_borsh_verdict(
        verdict=1,
        token_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC mint on Solana
        recipient="4Nd1m1iBnnstb5hXU9HwN2hK8c4Z6A5B2F7E1C3D8E9F",
        amount=50_000_000,
        mandate_id="mandate_solana_001",
        authorization_id="auth_solana_001",
        expiry=1893456000
    )
    assert len(verdict_bytes) == (1 + 8 + 8 + 32 + 32 + 32 + 32)
    assert verdict_bytes[0] == 1 # ALLOW

def test_ed25519_instruction_and_squads_cpi_formatting():
    verdict_bytes = b"sample_verdict_bytes_32_len____"
    ix = SolanaMandateGuardAdapter.format_ed25519_instruction(
        verdict_bytes=verdict_bytes,
        authorizer_pubkey="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    )
    assert ix["program_id"] == "Ed25519SigVerify111111111111111111111111111"
    assert ix["message_size"] == len(verdict_bytes)

    cpi = SolanaMandateGuardAdapter.format_squads_v4_cpi(
        vault_address="Vault11111111111111111111111111111111111111",
        recipient_ata="Ata111111111111111111111111111111111111111",
        amount=100_000_000
    )
    assert cpi["squads_program"] == SQUADS_V4_PROGRAM_ID
    assert cpi["instruction"] == "execute_transaction"
    assert cpi["amount"] == 100_000_000
