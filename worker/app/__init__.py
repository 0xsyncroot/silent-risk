"""
Silent Risk Worker Service

This service handles heavy computation tasks including:
- Blockchain data indexing and analysis
- Risk score calculation with ML models
- FHE encryption and smart contract interaction
- Strategy validation with Concrete-ML

Architecture:
- Celery for distributed task processing
- Redis for result backend and caching
- Web3.py for blockchain interaction
- Concrete-ML for privacy-preserving ML
"""

__version__ = "0.1.0"
__author__ = "Silent Risk Team"

