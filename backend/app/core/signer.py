import os
from typing import Dict, Any, Tuple
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_typed_data
from app.core.config import settings

def get_eip712_domain(chain_id: int, verifying_contract: str) -> Dict[str, Any]:
    return {
        "name": "MandateGuard",
        "version": "1",
        "chainId": chain_id,
        "verifyingContract": Web3.to_checksum_address(verifying_contract),
    }

EIP712_TYPES = {
    "EIP712Domain": [
        {"name": "name", "type": "string"},
        {"name": "version", "type": "string"},
        {"name": "chainId", "type": "uint256"},
        {"name": "verifyingContract", "type": "address"},
    ],
    "PaymentVerdict": [
        {"name": "verdict", "type": "uint8"},
        {"name": "chainId", "type": "uint256"},
        {"name": "account", "type": "address"},
        {"name": "token", "type": "address"},
        {"name": "recipient", "type": "address"},
        {"name": "amount", "type": "uint256"},
        {"name": "mandateId", "type": "bytes32"},
        {"name": "authorizationId", "type": "bytes32"},
        {"name": "expiry", "type": "uint256"},
        {"name": "mandateVersion", "type": "uint256"},
    ],
}

def format_bytes32(val: str) -> bytes:
    """Normalize a hex string or text into 32 bytes."""
    if isinstance(val, bytes):
        if len(val) == 32:
            return val
        return val.ljust(32, b"\x00")[:32]
    val_str = str(val)
    if val_str.startswith("0x"):
        clean_hex = val_str[2:]
        if len(clean_hex) <= 64:
            clean_hex = clean_hex.rjust(64, "0")
        return bytes.fromhex(clean_hex[:64])
    # Fallback to keccak256 hash if text
    return Web3.keccak(text=val_str)

def build_typed_message(
    verdict: int,
    chain_id: int,
    account: str,
    token: str,
    recipient: str,
    amount: int,
    mandate_id: str,
    authorization_id: str,
    expiry: int,
    mandate_version: int,
) -> Dict[str, Any]:
    domain = get_eip712_domain(chain_id, account)
    
    mandate_bytes = format_bytes32(mandate_id)
    auth_bytes = format_bytes32(authorization_id)
    
    message = {
        "verdict": int(verdict),
        "chainId": int(chain_id),
        "account": Web3.to_checksum_address(account),
        "token": Web3.to_checksum_address(token),
        "recipient": Web3.to_checksum_address(recipient),
        "amount": int(amount),
        "mandateId": mandate_bytes,
        "authorizationId": auth_bytes,
        "expiry": int(expiry),
        "mandateVersion": int(mandate_version),
    }
    
    return {
        "types": EIP712_TYPES,
        "primaryType": "PaymentVerdict",
        "domain": domain,
        "message": message,
    }

def sign_payment_verdict(
    verdict: int,
    chain_id: int,
    account: str,
    token: str,
    recipient: str,
    amount: int,
    mandate_id: str,
    authorization_id: str,
    expiry: int,
    mandate_version: int,
    private_key: str = None,
) -> Tuple[str, str, str]:
    """
    Sign an EIP-712 payment verdict.
    Returns: (signature_hex, authorizer_address, authorization_id_hex)
    """
    key = private_key or settings.AUTHORIZER_PRIVATE_KEY
    signer_account = Account.from_key(key)
    
    full_data = build_typed_message(
        verdict=verdict,
        chain_id=chain_id,
        account=account,
        token=token,
        recipient=recipient,
        amount=amount,
        mandate_id=mandate_id,
        authorization_id=authorization_id,
        expiry=expiry,
        mandate_version=mandate_version,
    )
    
    encoded_msg = encode_typed_data(full_message=full_data)
    signed = Account.sign_message(encoded_msg, private_key=key)
    
    sig_hex = "0x" + signed.signature.hex()
    auth_id_hex = "0x" + format_bytes32(authorization_id).hex()
    
    return sig_hex, signer_account.address, auth_id_hex

def recover_signer_from_verdict(
    verdict: int,
    chain_id: int,
    account: str,
    token: str,
    recipient: str,
    amount: int,
    mandate_id: str,
    authorization_id: str,
    expiry: int,
    mandate_version: int,
    signature: str,
) -> str:
    """Recover the signer address from a signed EIP-712 verdict."""
    full_data = build_typed_message(
        verdict=verdict,
        chain_id=chain_id,
        account=account,
        token=token,
        recipient=recipient,
        amount=amount,
        mandate_id=mandate_id,
        authorization_id=authorization_id,
        expiry=expiry,
        mandate_version=mandate_version,
    )
    encoded_msg = encode_typed_data(full_message=full_data)
    recovered_addr = Account.recover_message(encoded_msg, signature=signature)
    return Web3.to_checksum_address(recovered_addr)
