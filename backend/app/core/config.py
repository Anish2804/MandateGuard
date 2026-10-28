import os
from pydantic_settings import BaseSettings
from pydantic import Field, model_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "MandateGuard Authorization Service"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Network / Chain
    CHAIN_ID: int = Field(default=31337, description="Target EVM Chain ID")
    RPC_URL: str = Field(default="http://127.0.0.1:8545", description="EVM RPC Node URL")
    VERIFY_ON_CHAIN_SETTLEMENT: bool = Field(default=True, description="Verify transaction receipt on EVM chain before settling")
    
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
    
    # Environment mode
    ENVIRONMENT: str = Field(default="development", description="'development', 'staging', 'production'")
    
    # Policy defaults
    DEFAULT_EXPIRY_SECONDS: int = 3600  # 1 hour
    
    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.ENVIRONMENT.lower() == "production":
            DEFAULT_TEST_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
            if self.AUTHORIZER_PRIVATE_KEY.lower() == DEFAULT_TEST_KEY.lower():
                raise ValueError("FATAL CONFIG ERROR: Insecure default Anvil authorizer key cannot be used in production.")
            if self.CHAIN_ID == 31337:
                raise ValueError("FATAL CONFIG ERROR: Local chain ID 31337 cannot be used in production.")
            if self.SIGNER_TYPE.lower() == "kms" and not self.AWS_KMS_KEY_ID:
                raise ValueError("FATAL CONFIG ERROR: AWS_KMS_KEY_ID must be specified when SIGNER_TYPE is 'kms' in production.")
            if not self.RPC_URL or "127.0.0.1" in self.RPC_URL or "localhost" in self.RPC_URL:
                raise ValueError("FATAL CONFIG ERROR: A valid production RPC_URL must be configured.")
        return self

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }

settings = Settings()
