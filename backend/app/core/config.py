import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "MandateGuard Authorization Service"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Network / Chain
    CHAIN_ID: int = Field(default=31337, description="Target EVM Chain ID")
    RPC_URL: str = Field(default="http://127.0.0.1:8545", description="EVM RPC Node URL")
    
    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./mandateguard.db",
        description="Async database connection string"
    )
    
    # Cryptographic Signer
    SIGNER_TYPE: str = Field(default="local", description="'local' or 'kms'")
    AWS_KMS_KEY_ID: str = Field(default="", description="AWS KMS Key ID or ARN for production HSM signing")
    AWS_REGION: str = Field(default="us-east-1", description="AWS Region for KMS")
    AUTHORIZER_PRIVATE_KEY: str = Field(
        default="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        description="Private key for local dev signing"
    )
    
    # Contract addresses (populated after deployment)
    SMART_ACCOUNT_ADDRESS: str = Field(
        default="0x0000000000000000000000000000000000000000",
        description="Deployed MandateGuardAccount address"
    )
    MOCK_USDC_ADDRESS: str = Field(
        default="0x0000000000000000000000000000000000000000",
        description="Deployed MockUSDC token address"
    )
    FACTORY_ADDRESS: str = Field(
        default="0x70e0bA845a1A0F2DA3359C97E0285013525FFC49",
        description="Deployed MandateGuardFactory address"
    )
    
    # Policy defaults
    DEFAULT_EXPIRY_SECONDS: int = 3600  # 1 hour
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }

settings = Settings()
