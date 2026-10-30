"""
MandateGuard — Solana & Squads Native Prototype Adapter (Requirement 10)
========================================================================
Demonstrates Solana-native Program-Derived Address (PDA) derivation,
Borsh serialization for spending mandates, Ed25519 instruction payload construction
for native instruction introspection, and Squads Protocol v4 CPI parameter mapping.
"""

import struct
import hashlib
from typing import Dict, Any, Tuple

# Squads Protocol v4 Program ID on Solana Mainnet/Devnet
SQUADS_V4_PROGRAM_ID = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
MANDATEGUARD_SOLANA_PROGRAM_ID = "MndtGrd111111111111111111111111111111111111"

class SolanaMandateGuardAdapter:
    """
    Adapter demonstrating Solana-native cryptographic and account architecture.
    """

    @staticmethod
    def derive_mandate_pda(owner_pubkey: str, mandate_id: str, program_id: str = MANDATEGUARD_SOLANA_PROGRAM_ID) -> Dict[str, Any]:
        """
        Derives the Program-Derived Address (PDA) for a spending mandate.
        Seed: [b"mandate", owner_pubkey_bytes, mandate_id_bytes]
        """
        owner_bytes = owner_pubkey.encode("utf-8")[:32].ljust(32, b"\x00")
        mandate_bytes = mandate_id.encode("utf-8")[:32].ljust(32, b"\x00")
        
        # Deterministic PDA seed hash
        pda_preimage = b"mandate" + owner_bytes + mandate_bytes + program_id.encode("utf-8")
        pda_hash = hashlib.sha256(pda_preimage).hexdigest()
        
        return {
            "pda_address": f"PDA_{pda_hash[:32]}",
            "seeds": ["mandate", owner_pubkey[:16], mandate_id[:16]],
            "bump": 254,
            "program_id": program_id
        }

    @staticmethod
    def serialize_borsh_verdict(
        verdict: int,
        token_mint: str,
        recipient: str,
        amount: int,
        mandate_id: str,
        authorization_id: str,
        expiry: int
    ) -> bytes:
        """
        Serializes a PaymentVerdict into compact Borsh binary format for Solana runtime.
        Schema:
        - verdict: u8 (1 byte)
        - amount: u64 little-endian (8 bytes)
        - expiry: i64 little-endian (8 bytes)
        - token_mint: 32 bytes
        - recipient: 32 bytes
        - mandate_id: 32 bytes
        - authorization_id: 32 bytes
        """
        mint_bytes = token_mint.encode("utf-8")[:32].ljust(32, b"\x00")
        recip_bytes = recipient.encode("utf-8")[:32].ljust(32, b"\x00")
        m_bytes = mandate_id.encode("utf-8")[:32].ljust(32, b"\x00")
        auth_bytes = authorization_id.encode("utf-8")[:32].ljust(32, b"\x00")

        header = struct.pack("<BQQ", verdict, amount, expiry)
        return header + mint_bytes + recip_bytes + m_bytes + auth_bytes

    @staticmethod
    def format_ed25519_instruction(verdict_bytes: bytes, authorizer_pubkey: str) -> Dict[str, Any]:
        """
        Builds the transaction instruction descriptor for Solana's native Ed25519 Program
        (Ed25519SigVerify111111111111111111111111111) used for instruction introspection.
        """
        return {
            "program_id": "Ed25519SigVerify111111111111111111111111111",
            "authorizer_pubkey": authorizer_pubkey,
            "message_size": len(verdict_bytes),
            "signature_offset": 16,
            "message_data_hex": verdict_bytes.hex()
        }

    @staticmethod
    def format_squads_v4_cpi(vault_address: str, recipient_ata: str, amount: int) -> Dict[str, Any]:
        """
        Builds the Cross-Program Invocation (CPI) payload from MandateGuard -> Squads v4 Vault.
        """
        return {
            "squads_program": SQUADS_V4_PROGRAM_ID,
            "instruction": "execute_transaction",
            "vault": vault_address,
            "destination": recipient_ata,
            "amount": amount,
            "cpi_authority": "MandateGuard_PDA"
        }
