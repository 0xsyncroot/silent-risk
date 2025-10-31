"""
Passport API Endpoints

Provides endpoints for users to retrieve passport claim data
after risk analysis completion.

Flow:
1. User completes risk analysis (via /risk/analyze)
2. Worker generates passport commitment
3. User retrieves claim data (via /passport/claim-data/{wallet})
4. User generates ZK proof in browser
5. User mints passport from anonymous wallet

Author: Silent Risk Team
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.api.models import (
    PassportClaimData,
    PassportStatusResponse,
    PassportStatus,
    ErrorResponse
)
from app.services.cache import cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/passport", tags=["passport"])


@router.get(
    "/claim-data/{wallet_address}",
    response_model=PassportClaimData,
    responses={
        404: {"model": ErrorResponse, "description": "No passport data found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Get passport claim data",
    description="""
    Retrieve passport claim data for ZK proof generation.
    
    **Security Notice:**
    - The 'secret' field is PRIVATE - user must keep it safe!
    - User should generate ZK proof in browser (client-side)
    - User should mint passport from a fresh anonymous wallet
    - Original wallet address should NEVER be revealed on-chain
    
    **Prerequisites:**
    - Risk analysis must be completed for this wallet
    - Passport commitment must be generated (automatic after analysis)
    - Data is cached for 24 hours after analysis
    
    **Next Steps:**
    1. Use returned data to generate ZK proof (frontend)
    2. Call PassportNFT.mintPassport() with proof from anonymous wallet
    3. Use passport to interact with DAOs/protocols
    """
)
async def get_passport_claim_data(wallet_address: str) -> PassportClaimData:
    """
    Get passport claim data for user
    
    Args:
        wallet_address: Ethereum wallet address (must be analyzed)
        
    Returns:
        PassportClaimData: Complete data for ZK proof generation
        
    Raises:
        HTTPException 404: If no passport data found
        HTTPException 500: If error retrieving data
    """
    try:
        # Normalize address
        wallet_address = wallet_address.lower()
        
        logger.info(f"Fetching passport claim data for {wallet_address[:10]}...")
        
        # Get passport data from cache
        cache_key = f"passport:claim:{wallet_address}"
        cached_data = await cache.redis.get(cache_key)
        
        if not cached_data:
            logger.warning(f"No passport data found for {wallet_address[:10]}...")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "passport_not_found",
                    "message": "No passport data found for this wallet. Please complete risk analysis first.",
                    "wallet": wallet_address
                }
            )
        
        # Parse cached data
        try:
            # Cached data is stringified dict
            data_dict = eval(cached_data)
            
            # Add instructions
            data_dict["instructions"] = {
                "step_1": "Keep 'secret' and 'wallet_address' PRIVATE - never share!",
                "step_2": "Use frontend to generate ZK proof with this data",
                "step_3": "Mint passport from a fresh anonymous wallet (Wallet B)",
                "step_4": "Use passport with DAOs - they verify risk without knowing your wallet",
                "privacy": "Your original wallet will NEVER be revealed on-chain",
                "security": "Store 'secret' securely - you'll need it for the ZK proof"
            }
            
            claim_data = PassportClaimData(**data_dict)
            
            logger.info(
                f"Passport data retrieved successfully",
                extra={
                    "wallet": wallet_address[:10] + "...",
                    "commitment": claim_data.commitment[:20]
                }
            )
            
            return claim_data
            
        except Exception as parse_error:
            logger.error(f"Failed to parse passport data: {parse_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error": "data_parse_error",
                    "message": "Failed to parse passport data",
                    "details": str(parse_error)
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error retrieving passport data",
            extra={"wallet": wallet_address[:10] + "...", "error": str(e)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Failed to retrieve passport data",
                "details": str(e)
            }
        )


@router.get(
    "/status/{wallet_address}",
    response_model=PassportStatusResponse,
    summary="Check passport status",
    description="""
    Check if passport data is ready for a wallet.
    
    **Use Cases:**
    - Check if risk analysis is complete
    - Check if passport commitment is generated
    - Determine if user can claim passport
    
    **Response Statuses:**
    - `ready_to_claim`: Passport data ready, user can claim
    - `not_generated`: Analysis not complete or no passport
    - `generation_failed`: Passport generation encountered error
    """
)
async def check_passport_status(wallet_address: str) -> PassportStatusResponse:
    """
    Check passport generation status
    
    Args:
        wallet_address: Ethereum wallet address
        
    Returns:
        PassportStatusResponse: Current passport status
    """
    try:
        wallet_address = wallet_address.lower()
        
        logger.debug(f"Checking passport status for {wallet_address[:10]}...")
        
        # Check if passport data exists in cache
        cache_key = f"passport:claim:{wallet_address}"
        has_passport = await cache.redis.exists(cache_key)
        
        # Check if analysis exists
        analysis_key = f"wallet:analysis:{wallet_address}"
        has_analysis = await cache.redis.exists(analysis_key)
        
        if has_passport:
            return PassportStatusResponse(
                wallet_address=wallet_address,
                has_analysis=True,
                has_passport_data=True,
                passport_status=PassportStatus.READY_TO_CLAIM,
                can_claim=True,
                message="Passport data ready. You can claim your passport."
            )
        elif has_analysis:
            # Analysis exists but no passport - check why
            analysis_data = await cache.redis.get(analysis_key)
            
            # Try to parse and check passport status
            try:
                analysis_dict = eval(analysis_data) if analysis_data else {}
                passport_info = analysis_dict.get("passport", {})
                passport_status_str = passport_info.get("status", "not_generated")
                
                if passport_status_str == "generation_failed":
                    return PassportStatusResponse(
                        wallet_address=wallet_address,
                        has_analysis=True,
                        has_passport_data=False,
                        passport_status=PassportStatus.GENERATION_FAILED,
                        can_claim=False,
                        message=f"Passport generation failed: {passport_info.get('error', 'Unknown error')}"
                    )
            except:
                pass
            
            return PassportStatusResponse(
                wallet_address=wallet_address,
                has_analysis=True,
                has_passport_data=False,
                passport_status=PassportStatus.NOT_GENERATED,
                can_claim=False,
                message="Risk analysis complete, but passport not generated yet. Please try again."
            )
        else:
            return PassportStatusResponse(
                wallet_address=wallet_address,
                has_analysis=False,
                has_passport_data=False,
                passport_status=PassportStatus.NOT_GENERATED,
                can_claim=False,
                message="No risk analysis found. Please analyze your wallet first."
            )
    
    except Exception as e:
        logger.error(
            f"Error checking passport status",
            extra={"wallet": wallet_address[:10] + "...", "error": str(e)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Failed to check passport status",
                "details": str(e)
            }
        )

