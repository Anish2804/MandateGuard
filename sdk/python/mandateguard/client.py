import time
import uuid
from typing import Optional
import httpx
from web3 import Web3
from eth_account import Account
from mandateguard.models import PaymentVerdictResult

ACCOUNT_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "uint8", "name": "verdict", "type": "uint8"},
                    {"internalType": "uint256", "name": "chainId", "type": "uint256"},
                    {"internalType": "address", "name": "account", "type": "address"},
                    {"internalType": "address", "name": "token", "type": "address"},
                    {"internalType": "address", "name": "recipient", "type": "address"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    {"internalType": "bytes32", "name": "mandateId", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "authorizationId", "type": "bytes32"},
                    {"internalType": "uint256", "name": "expiry", "type": "uint256"},
                    {"internalType": "uint256", "name": "mandateVersion", "type": "uint256"}
                ],
                "internalType": "struct MandateGuardAccount.PaymentVerdict",
                "name": "verdict",
                "type": "tuple"
            },
            {"internalType": "bytes", "name": "signature", "type": "bytes"}
        ],
        "name": "executePayment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "mandateId", "type": "bytes32"},
            {"internalType": "address", "name": "agent", "type": "address"},
            {"internalType": "address", "name": "token", "type": "address"},
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "maxAmountPerTx", "type": "uint256"},
            {"internalType": "uint256", "name": "maxCumulativeAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"internalType": "uint256", "name": "expiry", "type": "uint256"}
        ],
        "name": "registerMandate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

class MandateGuardClient:
    """Official Python Client SDK for AI Agent Payment Authorization & Guarded Execution."""

    def __init__(
        self,
        api_key: str,
        account_address: str,
        base_url: str = "http://localhost:8000",
        rpc_url: str = "http://127.0.0.1:8545",
        default_token_address: str = "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        http_client: Optional[httpx.AsyncClient] = None
    ):
        self.api_key = api_key
        self.account_address = Web3.to_checksum_address(account_address)
        self.base_url = base_url.rstrip("/")
        self.rpc_url = rpc_url
        self.default_token = Web3.to_checksum_address(default_token_address)
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.http_client = http_client

    async def request_authorization(
        self,
        mandate_id: str,
        recipient: str,
        amount_usdc: float,
        token: Optional[str] = None,
        chain_id: int = 31337,
        idempotency_key: Optional[str] = None
    ) -> PaymentVerdictResult:
        """
        Request cryptographic payment authorization from human spending policy.
        """
        amount_base_units = int(amount_usdc * 1_000_000)
        token_addr = Web3.to_checksum_address(token or self.default_token)
        recipient_addr = Web3.to_checksum_address(recipient)
        idem_key = idempotency_key or f"agent_req_{uuid.uuid4().hex}"

        payload = {
            "mandate_id": mandate_id,
            "account": self.account_address,
            "token": token_addr,
            "recipient": recipient_addr,
            "amount": amount_base_units,
            "chain_id": chain_id,
            "idempotency_key": idem_key,
        }

        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key
        }

        if self.http_client:
            resp = await self.http_client.post("/api/v1/authorize", json=payload, headers=headers)
        else:
            async with httpx.AsyncClient(base_url=self.base_url) as client:
                resp = await client.post("/api/v1/authorize", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

        return PaymentVerdictResult(
            allowed=(data["verdict"] == 1),
            verdict=data["verdict"],
            verdict_label=data["verdict_label"],
            mandate_id=data["mandate_id"],
            authorization_id=data["authorization_id"],
            account=data["account"],
            token=data["token"],
            recipient=data["recipient"],
            amount=data["amount"],
            chain_id=data["chain_id"],
            expiry=data["expiry"],
            mandate_version=data["mandate_version"],
            signature=data.get("signature"),
            authorizer_signer=data.get("authorizer_signer"),
            reason=data.get("reason"),
            raw_response=data
        )

    def execute_payment_on_chain(
        self,
        verdict: PaymentVerdictResult,
        signer_private_key: str
    ) -> str:
        """
        Submit signed ALLOW verdict to smart account on-chain.
        Returns the mined transaction hash.
        """
        if not verdict.allowed or not verdict.signature:
            raise ValueError(f"Cannot execute non-allowed verdict: {verdict.reason}")

        submitter = Account.from_key(signer_private_key)
        contract = self.w3.eth.contract(address=Web3.to_checksum_address(verdict.account), abi=ACCOUNT_ABI)

        mandate_id_bytes = bytes.fromhex(verdict.mandate_id[2:] if verdict.mandate_id.startswith("0x") else verdict.mandate_id)
        auth_id_bytes = bytes.fromhex(verdict.authorization_id[2:] if verdict.authorization_id.startswith("0x") else verdict.authorization_id)
        sig_bytes = bytes.fromhex(verdict.signature[2:] if verdict.signature.startswith("0x") else verdict.signature)

        verdict_tuple = (
            verdict.verdict,
            verdict.chain_id,
            Web3.to_checksum_address(verdict.account),
            Web3.to_checksum_address(verdict.token),
            Web3.to_checksum_address(verdict.recipient),
            verdict.amount,
            mandate_id_bytes,
            auth_id_bytes,
            verdict.expiry,
            verdict.mandate_version
        )

        nonce = self.w3.eth.get_transaction_count(submitter.address)
        tx = contract.functions.executePayment(
            verdict_tuple,
            sig_bytes
        ).build_transaction({
            "from": submitter.address,
            "nonce": nonce,
            "gas": 400000,
            "gasPrice": self.w3.eth.gas_price
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, signer_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt["status"] != 1:
            raise RuntimeError(f"On-chain execution reverted: {tx_hash.hex()}")

        return self.w3.to_hex(tx_hash)

    async def settle(self, authorization_id: str, tx_hash: str) -> bool:
        """Notify authorization backend that on-chain transaction has been mined."""
        headers = {"X-API-Key": self.api_key}
        payload = {
            "authorization_id": authorization_id,
            "tx_hash": tx_hash
        }
        if self.http_client:
            resp = await self.http_client.post("/api/v1/settle", json=payload, headers=headers)
        else:
            async with httpx.AsyncClient(base_url=self.base_url) as client:
                resp = await client.post("/api/v1/settle", json=payload, headers=headers)
        return resp.status_code == 200
